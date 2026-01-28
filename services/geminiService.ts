
import { GoogleGenAI, Modality } from "@google/genai";
import type { DialogueLine, SpeakerConfig } from '../types';
import { decode, createWavBlob, createSilentAudio } from '../utils/audio';

const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to safely split text into chunks that fit within the limit
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

// Generates raw PCM data (Uint8Array) with seed support
export const generateRawAudio = async (text: string, voice: string, seed?: number): Promise<Uint8Array | null> => {
  if (!text || !text.trim()) return null;
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
  } catch (error) {
    console.error("Error generating audio:", error);
    if (error instanceof Error) {
        throw error;
    }
    throw new Error(`Gemini API Error: ${JSON.stringify(error as any)}`);
  }
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
  const MAX_BATCH_CHARS = 1800; 

  try {
    const audioChunks: Uint8Array[] = [];
    let currentSpeaker: string | null = null;
    let currentBatchText: string = "";
    
    const processBatch = async (text: string, speaker: string) => {
        if (!speaker || !text.trim()) return;
        
        const config = speakerConfigs.get(speaker);
        if (config) {
            const textToSpeak = `${config.promptPrefix} ${text}`.trim();
            const pcm = await generateRawAudio(textToSpeak, config.voice, config.seed);
            if (pcm) {
                audioChunks.push(pcm);
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
    const MAX_BATCH_CHARS = 1800;
    let currentBatchText = "";

    const processBatch = async (text: string) => {
        if (!text.trim()) return;
        const textToSpeak = `${config.promptPrefix} ${text}`.trim();
        const pcm = await generateRawAudio(textToSpeak, config.voice, config.seed);
        if (pcm) {
            audioChunks.push(pcm);
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
