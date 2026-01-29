
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

// Enhanced Internal function with Daily Quota Detection
const callGeminiTTS = async (
    text: string, 
    voice: string, 
    seed?: number, 
    attempt: number = 1,
    onStatusUpdate?: (msg: string) => void,
    checkAborted?: () => boolean
): Promise<Uint8Array | null> => {
    if (checkAborted && checkAborted()) throw new Error("USER_ABORTED");

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
            let waitSeconds = 60;
            const match = errorMsg.match(/retry in ([\d.]+)s/i);
            if (match && match[1]) {
                waitSeconds = Math.ceil(parseFloat(match[1])) + 2;
            }
            
            // ตรวจสอบว่าเป็นโควต้ารายวันหรือไม่ (ถ้ารอนานเกิน 10 นาที)
            if (waitSeconds > 600) {
                const hours = (waitSeconds / 3600).toFixed(1);
                throw new Error(`DAILY_QUOTA_EXCEEDED|${hours}`);
            }

            console.warn(`Quota exhausted. Waiting ${waitSeconds} seconds...`);
            
            // LIVE COUNTDOWN LOOP
            for (let i = waitSeconds; i > 0; i--) {
                if (checkAborted && checkAborted()) throw new Error("USER_ABORTED");
                if (onStatusUpdate) {
                    onStatusUpdate(`คิวเต็ม (Rate Limit)... รอเริ่มใหม่ใน ${i} วินาที`);
                }
                await delay(1000);
            }
            
            if (onStatusUpdate) onStatusUpdate("กำลังลองใหม่ทันที...");
            return callGeminiTTS(text, voice, seed, attempt, onStatusUpdate, checkAborted);
        }

        if (attempt <= 3 && (errorMsg.includes("500") || errorMsg.includes("Internal Error"))) {
            if (onStatusUpdate) onStatusUpdate(`Server ขัดข้อง... ลองใหม่รอบที่ ${attempt}/3`);
            await delay(attempt * 2000);
            return callGeminiTTS(text, voice, seed, attempt + 1, onStatusUpdate, checkAborted);
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
  onStatusUpdate?: (msg: string) => void,
  checkAborted?: () => boolean
): Promise<Blob | null> => {
  
  if (dialogueLines.length === 0) return null;
  const MAX_BATCH_CHARS = 2500; 

  try {
    const audioChunks: Uint8Array[] = [];
    let currentSpeaker: string | null = null;
    let currentBatchText: string = "";
    let processedChars = 0;
    const totalChars = dialogueLines.reduce((acc, l) => acc + l.text.length, 0);
    
    const processBatch = async (text: string, speaker: string) => {
        if (checkAborted && checkAborted()) throw new Error("USER_ABORTED");
        if (!speaker || !text.trim()) return;
        
        const config = speakerConfigs.get(speaker);
        if (config) {
            const percent = Math.round((processedChars / totalChars) * 100);
            if (onStatusUpdate) onStatusUpdate(`กำลังพากย์เสียง: ${speaker} (${percent}%)`);
            
            const textToSpeak = `${config.promptPrefix} ${text}`.trim();
            const pcm = await callGeminiTTS(textToSpeak, config.voice, config.seed, 1, onStatusUpdate, checkAborted);
            if (pcm) {
                audioChunks.push(pcm);
                processedChars += text.length;
                await delay(300);
            }
        }
    };

    for (const line of dialogueLines) {
        if (checkAborted && checkAborted()) throw new Error("USER_ABORTED");
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
            for (let i = 0; i < lineChunks.length; i++) {
                await processBatch(lineChunks[i], currentSpeaker!);
            }
        }
    }
    
    if (currentSpeaker && currentBatchText) {
        await processBatch(currentBatchText, currentSpeaker);
    }
    
    if (audioChunks.length === 0) return null;
    return createWavBlob(audioChunks);

  } catch (error: any) {
    if (error.message === "USER_ABORTED") return null;
    throw error;
  }
};

export const generateSeparateSpeakerSpeech = async (
  dialogueLines: DialogueLine[],
  speakerConfigs: Map<string, SpeakerConfig>,
  onStatusUpdate?: (msg: string) => void,
  checkAborted?: () => boolean
): Promise<Map<string, Blob>> => {
  const speakerAudioMap = new Map<string, Blob>();
  const MAX_BATCH_CHARS = 2500; 

  for (const [speaker, config] of speakerConfigs.entries()) {
    if (checkAborted && checkAborted()) throw new Error("USER_ABORTED");
    const lines = dialogueLines.filter(line => line.speaker === speaker);
    if (lines.length === 0) continue;

    const audioChunks: Uint8Array[] = [];
    let currentBatchText = "";

    const processBatch = async (text: string) => {
        if (checkAborted && checkAborted()) throw new Error("USER_ABORTED");
        if (!text.trim()) return;
        if (onStatusUpdate) onStatusUpdate(`สร้างไฟล์แยก: ${speaker}...`);
        const textToSpeak = `${config.promptPrefix} ${text}`.trim();
        const pcm = await callGeminiTTS(textToSpeak, config.voice, config.seed, 1, onStatusUpdate, checkAborted);
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
            for (let i = 0; i < lineChunks.length; i++) {
                await processBatch(lineChunks[i]);
            }
        }
    }
    
    if (currentBatchText) await processBatch(currentBatchText);
    if (audioChunks.length > 0) speakerAudioMap.set(speaker, createWavBlob(audioChunks));
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
