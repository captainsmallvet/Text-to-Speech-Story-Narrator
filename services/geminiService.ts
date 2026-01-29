
import { GoogleGenAI, Modality } from "@google/genai";
import type { DialogueLine, SpeakerConfig } from '../types';
import { decode, createWavBlob, createSilentAudio } from '../utils/audio';

const getAi = () => {
  const savedKey = localStorage.getItem('gemini_api_key');
  const apiKey = savedKey || (window as any).process?.env?.API_KEY || "";
  return new GoogleGenAI({ apiKey });
};

// Helper: Sleep function to prevent rate limiting
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

    // Prioritize sentence endings
    const sentenceEndMatch = searchArea.match(/[.!?]["']?(?=\s|$)/g);
    if (sentenceEndMatch) {
        const lastPunctuation = searchArea.lastIndexOf(sentenceEndMatch[sentenceEndMatch.length - 1]);
        if (lastPunctuation !== -1) {
            cutIndex = lastPunctuation + 1;
        }
    }

    // Fallback to clauses
    if (cutIndex === -1) {
         const clauseEndMatch = searchArea.match(/[,;:]["']?(?=\s|$)/g);
         if (clauseEndMatch) {
            const lastClause = searchArea.lastIndexOf(clauseEndMatch[clauseEndMatch.length - 1]);
            if (lastClause !== -1) {
                cutIndex = lastClause + 1;
            }
         }
    }

    // Fallback to spaces
    if (cutIndex === -1) {
      cutIndex = searchArea.lastIndexOf(' ');
    }

    // Hard cut if no spaces (very long word)
    if (cutIndex === -1 || cutIndex === 0) {
      cutIndex = maxLength;
    }

    chunks.push(remainingText.substring(0, cutIndex).trim());
    remainingText = remainingText.substring(cutIndex).trim();
  }

  return chunks;
};

// Internal function to call API with Retry Logic
const callGeminiTTS = async (text: string, voice: string, seed?: number, attempt: number = 1): Promise<Uint8Array | null> => {
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
        // Handle 500 Internal Error or 429 Rate Limit by retrying
        if (attempt <= 3) {
            console.warn(`Attempt ${attempt} failed. Retrying in ${attempt * 1000}ms... Error: ${error.message}`);
            await delay(attempt * 1000); // Exponential backoff: 1s, 2s, 3s
            return callGeminiTTS(text, voice, seed, attempt + 1);
        }
        console.error("Final API Error after retries:", error);
        throw error; // Re-throw if all retries fail
    }
};

// Generates raw PCM data (Uint8Array)
export const generateRawAudio = async (text: string, voice: string, seed?: number): Promise<Uint8Array | null> => {
  if (!text || !text.trim()) return null;
  // Add a small delay before every request to avoid "Too Many Requests" when looping tight
  await delay(100); 
  return await callGeminiTTS(text, voice, seed);
};

export const generateSingleLineSpeech = async (text: string, voice: string, seed?: number): Promise<Blob | null> => {
    const pcmData = await generateRawAudio(text, voice, seed);
    if (pcmData) {
        return createWavBlob([pcmData]);
    }
    return null;
};

export const generateMultiLineSpeech = async (
  dialogueLines: DialogueLine[],
  speakerConfigs: Map<string, SpeakerConfig>
): Promise<Blob | null> => {
  
  if (dialogueLines.length === 0) return null;
  
  // Reduced from 1800 to 1000 to prevent 500 Internal Errors on complex sentences
  const MAX_BATCH_CHARS = 1000; 

  try {
    const audioChunks: Uint8Array[] = [];
    let currentSpeaker: string | null = null;
    let currentBatchText: string = "";
    
    const processBatch = async (text: string, speaker: string) => {
        if (!speaker || !text.trim()) return;
        
        const config = speakerConfigs.get(speaker);
        if (config) {
            const textToSpeak = `${config.promptPrefix} ${text}`.trim();
            // Critical: Wait for the chunk to be generated before proceeding (serial processing)
            // Parallel processing causes 500 errors on long scripts.
            const pcm = await generateRawAudio(textToSpeak, config.voice, config.seed);
            if (pcm) {
                audioChunks.push(pcm);
                // Force a small delay between heavy batches to let the server breathe
                await delay(300);
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
            // If adding this line exceeds the limit, process the current batch first
            if (currentBatchText) {
                await processBatch(currentBatchText, currentSpeaker!);
                currentBatchText = "";
            }
            
            // Check if the line itself is huge
            const lineChunks = splitTextSafely(line.text, MAX_BATCH_CHARS);
            if (lineChunks.length === 1) {
                 // Fits now (because currentBatchText was cleared)
                currentBatchText = lineChunks[0];
            } else {
                // Line is huge, split it and process parts immediately
                for (let i = 0; i < lineChunks.length - 1; i++) {
                    await processBatch(lineChunks[i], currentSpeaker!);
                }
                // Keep the last chunk as the start of the next batch
                currentBatchText = lineChunks[lineChunks.length - 1];
            }
        }
    }
    
    // Process final remaining batch
    if (currentSpeaker && currentBatchText) {
        await processBatch(currentBatchText, currentSpeaker);
    }
    
    if (audioChunks.length === 0) return null;
    
    // Create Blob at the very end to save RAM during the loop
    return createWavBlob(audioChunks);

  } catch (error) {
    console.error("Error generating story audio:", error);
    throw error;
  }
};

export const generateSeparateSpeakerSpeech = async (
  dialogueLines: DialogueLine[],
  speakerConfigs: Map<string, SpeakerConfig>
): Promise<Map<string, Blob>> => {
  const speakerAudioMap = new Map<string, Blob>();
  
  for (const [speaker, config] of speakerConfigs.entries()) {
    const lines = dialogueLines.filter(line => line.speaker === speaker);
    if (lines.length === 0) continue;

    const audioChunks: Uint8Array[] = [];
    const MAX_BATCH_CHARS = 1000; // Reduced limit
    let currentBatchText = "";

    const processBatch = async (text: string) => {
        if (!text.trim()) return;
        const textToSpeak = `${config.promptPrefix} ${text}`.trim();
        const pcm = await generateRawAudio(textToSpeak, config.voice, config.seed);
        if (pcm) {
            audioChunks.push(pcm);
            await delay(200); // Throttling
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
