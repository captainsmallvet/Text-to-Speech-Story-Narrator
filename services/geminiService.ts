
import { GoogleGenAI, Modality } from "@google/genai";
import type { DialogueLine, SpeakerConfig } from '../types';
import { decode, createWavBlob, createSilentAudio } from '../utils/audio';

const getAi = () => {
  const savedKey = localStorage.getItem('gemini_api_key');
  const apiKey = savedKey || (window as any).process?.env?.API_KEY || "";
  return new GoogleGenAI({ apiKey });
};

// Helper: Sleep function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Safely split text into smaller chunks
const splitTextSafely = (text: string, maxLength: number): string[] => {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let remainingText = text;

  while (remainingText.length > 0) {
    if (remainingText.length <= maxLength) {
      chunks.push(remainingText);
      break;
    }

    const searchArea = remainingText.substring(0, maxLength);
    let cutIndex = -1;

    const sentenceEndMatch = searchArea.match(/[.!?]["']?(?=\s|$)/g);
    if (sentenceEndMatch) {
        const lastPunctuation = searchArea.lastIndexOf(sentenceEndMatch[sentenceEndMatch.length - 1]);
        if (lastPunctuation !== -1) {
            cutIndex = lastPunctuation + 1;
        }
    }

    if (cutIndex === -1) {
         const clauseEndMatch = searchArea.match(/[,;:]["']?(?=\s|$)/g);
         if (clauseEndMatch) {
            const lastClause = searchArea.lastIndexOf(clauseEndMatch[clauseEndMatch.length - 1]);
            if (lastClause !== -1) {
                cutIndex = lastClause + 1;
            }
         }
    }

    if (cutIndex === -1) {
      cutIndex = searchArea.lastIndexOf(' ');
    }

    if (cutIndex === -1 || cutIndex === 0) {
      cutIndex = maxLength;
    }

    chunks.push(remainingText.substring(0, cutIndex).trim());
    remainingText = remainingText.substring(cutIndex).trim();
  }

  return chunks;
};

// Enhanced Internal function with Smart Quota Handling
const callGeminiTTS = async (
    text: string, 
    voice: string, 
    seed?: number, 
    attempt: number = 1,
    onStatusUpdate?: (msg: string) => void
): Promise<Uint8Array | null> => {
    const ai = getAi();
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                seed: seed,
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voice },
                    },
                },
            },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
            return decode(base64Audio);
        }
        return null;
    } catch (error: any) {
        const errorMsg = error.message || "";
        
        // Handle RESOURCE_EXHAUSTED (Quota Exceeded)
        if (errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("429")) {
            // Extract wait time if possible, default to 60s for safety in free tier
            let waitTime = 60000;
            const match = errorMsg.match(/retry in ([\d.]+)s/i);
            if (match && match[1]) {
                waitTime = (parseFloat(match[1]) + 2) * 1000; // Add 2s buffer
            }
            
            if (onStatusUpdate) {
                onStatusUpdate(`ติดขีดจำกัดความถี่ (Quota Limit)... กำลังรอ ${Math.ceil(waitTime/1000)} วินาที`);
            }
            
            console.warn(`Quota exhausted. Waiting ${waitTime}ms...`);
            await delay(waitTime);
            return callGeminiTTS(text, voice, seed, attempt, onStatusUpdate);
        }

        // Handle Internal Error 500 with normal retry
        if (attempt <= 3 && (errorMsg.includes("500") || errorMsg.includes("Internal Error"))) {
            if (onStatusUpdate) onStatusUpdate(`เกิดข้อผิดพลาดที่ Server... กำลังลองใหม่รอบที่ ${attempt}`);
            await delay(attempt * 2000);
            return callGeminiTTS(text, voice, seed, attempt + 1, onStatusUpdate);
        }

        throw error;
    }
};

export const generateSingleLineSpeech = async (text: string, voice: string, seed?: number): Promise<Blob | null> => {
    const pcmData = await callGeminiTTS(text, voice, seed);
    if (pcmData) {
        return createWavBlob([pcmData]);
    }
    return null;
};

export const generateMultiLineSpeech = async (
  dialogueLines: DialogueLine[],
  speakerConfigs: Map<string, SpeakerConfig>,
  onStatusUpdate?: (msg: string) => void
): Promise<Blob | null> => {
  
  if (dialogueLines.length === 0) return null;
  
  // Increased to 2500 to stay under 10 Requests Per Minute (RPM) for long stories
  const MAX_BATCH_CHARS = 2500; 

  try {
    const audioChunks: Uint8Array[] = [];
    let currentSpeaker: string | null = null;
    let currentBatchText: string = "";
    let processedChars = 0;
    const totalChars = dialogueLines.reduce((acc, l) => acc + l.text.length, 0);
    
    const processBatch = async (text: string, speaker: string) => {
        if (!speaker || !text.trim()) return;
        
        const config = speakerConfigs.get(speaker);
        if (config) {
            if (onStatusUpdate) {
                const percent = Math.round((processedChars / totalChars) * 100);
                onStatusUpdate(`กำลังสร้างเสียง: ${speaker} (${percent}%)`);
            }
            
            const textToSpeak = `${config.promptPrefix} ${text}`.trim();
            const pcm = await callGeminiTTS(textToSpeak, config.voice, config.seed, 1, onStatusUpdate);
            if (pcm) {
                audioChunks.push(pcm);
                processedChars += text.length;
                await delay(500); // Small gap for stability
            }
        }
    };

    for (const line of dialogueLines) {
        const isNewSpeaker = line.speaker !== currentSpeaker;
        if (isNewSpeaker) {
            if (currentSpeaker && currentBatchText) {
                await processBatch(currentBatchText, currentSpeaker);
            }
            currentSpeaker = line.speaker;
            currentBatchText = "";
        }
        
        const combinedText = (currentBatchText + " " + line.text).trim();
        
        if (combinedText.length <= MAX_BATCH_CHARS) {
            currentBatchText = combinedText;
        } else {
            if (currentBatchText) {
                await processBatch(currentBatchText, currentSpeaker!);
                currentBatchText = "";
            }
            
            const lineChunks = splitTextSafely(line.text, MAX_BATCH_CHARS);
            if (lineChunks.length === 1) {
                currentBatchText = lineChunks[0];
            } else {
                for (let i = 0; i < lineChunks.length - 1; i++) {
                    await processBatch(lineChunks[i], currentSpeaker!);
                }
                currentBatchText = lineChunks[lineChunks.length - 1];
            }
        }
    }
    
    if (currentSpeaker && currentBatchText) {
        await processBatch(currentBatchText, currentSpeaker);
    }
    
    if (audioChunks.length === 0) return null;
    if (onStatusUpdate) onStatusUpdate("รวมไฟล์เสียงเสร็จสิ้น...");
    return createWavBlob(audioChunks);

  } catch (error) {
    console.error("Error generating story audio:", error);
    throw error;
  }
};

export const generateSeparateSpeakerSpeech = async (
  dialogueLines: DialogueLine[],
  speakerConfigs: Map<string, SpeakerConfig>,
  onStatusUpdate?: (msg: string) => void
): Promise<Map<string, Blob>> => {
  const speakerAudioMap = new Map<string, Blob>();
  const MAX_BATCH_CHARS = 2500; 

  for (const [speaker, config] of speakerConfigs.entries()) {
    const lines = dialogueLines.filter(line => line.speaker === speaker);
    if (lines.length === 0) continue;

    const audioChunks: Uint8Array[] = [];
    let currentBatchText = "";

    const processBatch = async (text: string) => {
        if (!text.trim()) return;
        if (onStatusUpdate) onStatusUpdate(`แยกไฟล์เสียง: ${speaker}...`);
        const textToSpeak = `${config.promptPrefix} ${text}`.trim();
        const pcm = await callGeminiTTS(textToSpeak, config.voice, config.seed, 1, onStatusUpdate);
        if (pcm) {
            audioChunks.push(pcm);
            await delay(300);
        }
    };

    for (const line of lines) {
        const combinedText = (currentBatchText + " " + line.text).trim();
        if (combinedText.length <= MAX_BATCH_CHARS) {
            currentBatchText = combinedText;
        } else {
            if (currentBatchText) {
                await processBatch(currentBatchText);
                currentBatchText = "";
            }
            const lineChunks = splitTextSafely(line.text, MAX_BATCH_CHARS);
            for (let i = 0; i < lineChunks.length - 1; i++) {
                await processBatch(lineChunks[i]);
            }
            currentBatchText = lineChunks[lineChunks.length - 1];
        }
    }
    
    if (currentBatchText) {
        await processBatch(currentBatchText);
    }

    if (audioChunks.length > 0) {
        speakerAudioMap.set(speaker, createWavBlob(audioChunks));
    }
  }
  
  return speakerAudioMap;
};

export const performTextReasoning = async (
  prompt: string,
  modelId: string,
  systemInstruction?: string
): Promise<string> => {
  const ai = getAi();
  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction || "You are a creative writing assistant for story narrators."
      }
    });
    return response.text || "";
  } catch (error) {
    console.error("Text reasoning error:", error);
    throw error;
  }
};
