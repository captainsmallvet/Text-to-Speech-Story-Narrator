
import { GoogleGenAI, Modality } from "@google/genai";
import type { DialogueLine, SpeakerConfig } from '../types';
import { decode, createWavBlob } from '../utils/audio';
import { DEFAULT_TONE } from '../constants';

// Always use process.env.API_KEY directly in the named parameter for GoogleGenAI.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
        if (lastPunctuation !== -1) cutIndex = lastPunctuation + 1;
    }
    if (cutIndex === -1) {
         const clauseEndMatch = searchArea.match(/[,;:]["']?(?=\s|$)/g);
         if (clauseEndMatch) {
            const lastClause = searchArea.lastIndexOf(clauseEndMatch[clauseEndMatch.length - 1]);
            if (lastClause !== -1) cutIndex = lastClause + 1;
         }
    }
    if (cutIndex === -1) cutIndex = searchArea.lastIndexOf(' ');
    if (cutIndex === -1 || cutIndex === 0) cutIndex = maxLength;
    chunks.push(remainingText.substring(0, cutIndex).trim());
    remainingText = remainingText.substring(cutIndex).trim();
  }
  return chunks;
};

const callGeminiTTS = async (
    text: string, 
    voice: string, 
    seed?: number, 
    tone?: string,
    attempt: number = 1,
    onStatusUpdate?: (msg: string) => void,
    checkAborted?: () => boolean,
    progressLabel: string = ""
): Promise<Uint8Array | null> => {
    if (checkAborted && checkAborted()) throw new Error("USER_ABORTED");

    try {
        const toneToUse = tone || DEFAULT_TONE;
        const qualityReinforcement = `Synthesize this in a professional, mellow broadcast style. Tone description: ${toneToUse}. Ensure the audio is smooth, warm, and non-fatiguing, with controlled high frequencies to avoid piercing or sibilant artifacts. Maintain a perfectly consistent pace.`;
        
        const finalPrompt = `${qualityReinforcement} Text: ${text}`;

        // Using ai instance directly with generateContent for TTS.
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: finalPrompt }] }],
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

        // The audio data is returned as raw PCM bytes in the response candidates.
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) return decode(base64Audio);
        throw new Error("No audio data returned from API.");
    } catch (error: any) {
        const errorMsg = error.message || "";
        
        if (errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("429")) {
            let waitSeconds = 60;
            const match = errorMsg.match(/retry in ([\d.]+)s/i);
            if (match && match[1]) waitSeconds = Math.ceil(parseFloat(match[1])) + 2;
            
            if (waitSeconds > 600) {
                const hours = (waitSeconds / 3600).toFixed(1);
                throw new Error(`DAILY_QUOTA_EXCEEDED|${hours}`);
            }

            for (let i = waitSeconds; i > 0; i--) {
                if (checkAborted && checkAborted()) throw new Error("USER_ABORTED");
                if (onStatusUpdate) {
                    onStatusUpdate(`${progressLabel}\n\n⚠️ คิวเต็ม (Rate Limit)... รอเริ่มใหม่ใน ${i} วินาที\n(คุณสามารถกดหยุดเพื่อบันทึกงานส่วนที่เสร็จแล้วได้ทันที)`);
                }
                await delay(1000);
            }
            
            return callGeminiTTS(text, voice, seed, tone, attempt, onStatusUpdate, checkAborted, progressLabel);
        }

        if (attempt <= 3 && (errorMsg.includes("500") || errorMsg.includes("Internal Error"))) {
            if (onStatusUpdate) onStatusUpdate(`${progressLabel}\n\n⚠️ Server ขัดข้อง... กำลังลองใหม่รอบที่ ${attempt}/3`);
            await delay(attempt * 2000);
            return callGeminiTTS(text, voice, seed, tone, attempt + 1, onStatusUpdate, checkAborted, progressLabel);
        }

        throw error;
    }
};

const handleInterBatchWait = async (
    waitTimeSec: number, 
    processedChars: number, 
    totalChars: number, 
    nextSnippet: string,
    onStatusUpdate?: (msg: string) => void,
    checkAborted?: () => boolean
) => {
    if (waitTimeSec <= 0) return;
    const jitter = Math.floor(Math.random() * 10) + 1;
    const totalWait = waitTimeSec + jitter;
    const percent = totalChars > 0 ? Math.round((processedChars / totalChars) * 100) : 0;

    for (let i = totalWait; i > 0; i--) {
        if (checkAborted && checkAborted()) return;
        if (onStatusUpdate) {
            onStatusUpdate(`✅ งานที่เสร็จแล้ว: ${percent}%\n⏳ กำลังพักรอบ (Inter-batch Delay)... เหลือเวลา ${i} วินาที\n(สุ่มเพิ่ม +${jitter}s เพื่อความเสถียร)\n\n📄 ข้อความชุดถัดไป: "${nextSnippet}"`);
        }
        await delay(1000);
    }
};

export const generateSingleLineSpeech = async (text: string, voice: string, seed?: number, tone?: string): Promise<Blob | null> => {
    const pcmData = await callGeminiTTS(text, voice, seed, tone);
    if (pcmData) return createWavBlob([pcmData]);
    return null;
};

export const generateMultiLineSpeech = async (
  dialogueLines: DialogueLine[],
  speakerConfigs: Map<string, SpeakerConfig>,
  onStatusUpdate?: (msg: string) => void,
  checkAborted?: () => boolean,
  maxCharsPerBatch: number = 3000,
  interBatchDelaySec: number = 120
): Promise<Blob | null> => {
  if (dialogueLines.length === 0) return null;
  const audioChunks: Uint8Array[] = [];
  const speakerSeedIndices = new Map<string, number>();

  try {
    const totalChars = dialogueLines.reduce((acc, l) => acc + l.text.length, 0);
    let processedChars = 0;
    
    // Create batches
    const batches: {text: string, speaker: string}[] = [];
    let tempSpeaker: string | null = null;
    let tempText = "";

    for (const line of dialogueLines) {
        if (line.speaker !== tempSpeaker || (tempText + " " + line.text).length > maxCharsPerBatch) {
            if (tempSpeaker && tempText) batches.push({text: tempText, speaker: tempSpeaker});
            tempSpeaker = line.speaker;
            tempText = line.text;
            
            if (tempText.length > maxCharsPerBatch) {
                const lineChunks = splitTextSafely(tempText, maxCharsPerBatch);
                for(let i=0; i < lineChunks.length - 1; i++) {
                    batches.push({text: lineChunks[i], speaker: tempSpeaker});
                }
                tempText = lineChunks[lineChunks.length - 1];
            }
        } else {
            tempText = (tempText + " " + line.text).trim();
        }
    }
    if (tempSpeaker && tempText) batches.push({text: tempText, speaker: tempSpeaker});

    for (let i = 0; i < batches.length; i++) {
        if (checkAborted && checkAborted()) throw new Error("USER_ABORTED");
        const batch = batches[i];
        const isLast = i === batches.length - 1;
        const nextSnippet = !isLast ? batches[i+1].text.substring(0, 50) + "..." : "สิ้นสุดการทำงาน";
        
        const config = speakerConfigs.get(batch.speaker);
        if (config) {
            const seedIdx = speakerSeedIndices.get(batch.speaker) || 0;
            const seedToUse = config.seeds[seedIdx % 5];
            speakerSeedIndices.set(batch.speaker, seedIdx + 1);

            const percent = Math.round((processedChars / totalChars) * 100);
            const snippet = batch.text.length > 50 ? batch.text.substring(0, 50) + "..." : batch.text;
            
            const progressLabel = `✅ งานที่เสร็จแล้ว: ${percent}%\n🔊 กำลังพากย์: ${batch.speaker}\n📄 ข้อความปัจจุบัน: "${snippet}"`;
            
            const pcm = await callGeminiTTS(batch.text, config.voice, seedToUse, config.toneDescription, 1, onStatusUpdate, checkAborted, progressLabel);
            if (pcm) {
                audioChunks.push(pcm);
                processedChars += batch.text.length;
                if (!isLast) {
                    await handleInterBatchWait(interBatchDelaySec, processedChars, totalChars, nextSnippet, onStatusUpdate, checkAborted);
                }
            }
        }
    }
    
    return audioChunks.length > 0 ? createWavBlob(audioChunks) : null;
  } catch (error: any) {
    if (error.message === "USER_ABORTED") {
        return audioChunks.length > 0 ? createWavBlob(audioChunks) : null;
    }
    throw error;
  }
};

export const generateSeparateSpeakerSpeech = async (
  dialogueLines: DialogueLine[],
  speakerConfigs: Map<string, SpeakerConfig>,
  onStatusUpdate?: (msg: string) => void,
  checkAborted?: () => boolean,
  maxCharsPerBatch: number = 3000,
  interBatchDelaySec: number = 120
): Promise<Map<string, Blob>> => {
  const speakerAudioMap = new Map<string, Blob>();

  try {
    const speakers = Array.from(speakerConfigs.keys());
    for (let sIdx = 0; sIdx < speakers.length; sIdx++) {
      const speaker = speakers[sIdx];
      const config = speakerConfigs.get(speaker)!;
      if (checkAborted && checkAborted()) break;
      const lines = dialogueLines.filter(line => line.speaker === speaker);
      if (lines.length === 0) continue;

      const audioChunks: Uint8Array[] = [];
      const speakerBatches: string[] = [];
      let tempText = "";
      for(const line of lines) {
          if ((tempText + " " + line.text).length > maxCharsPerBatch) {
              if (tempText) speakerBatches.push(tempText);
              tempText = line.text;
              if (tempText.length > maxCharsPerBatch) {
                  const lineChunks = splitTextSafely(tempText, maxCharsPerBatch);
                  for(let i=0; i < lineChunks.length - 1; i++) speakerBatches.push(lineChunks[i]);
                  tempText = lineChunks[lineChunks.length - 1];
              }
          } else {
              tempText = (tempText + " " + line.text).trim();
          }
      }
      if (tempText) speakerBatches.push(tempText);

      for (let bIdx = 0; bIdx < speakerBatches.length; bIdx++) {
          if (checkAborted && checkAborted()) break;
          const batchText = speakerBatches[bIdx];
          const isLastBatchOverall = (sIdx === speakers.length - 1) && (bIdx === speakerBatches.length - 1);
          
          const seedToUse = config.seeds[bIdx % 5];

          let nextSnippet = "เปลี่ยนตัวละครถัดไป...";
          if (bIdx < speakerBatches.length - 1) {
              nextSnippet = speakerBatches[bIdx+1].substring(0, 50) + "...";
          } else if (sIdx < speakers.length - 1) {
              nextSnippet = `กำลังเริ่มพากย์ ${speakers[sIdx+1]}...`;
          } else {
              nextSnippet = "เสร็จสิ้น";
          }

          const snippet = batchText.length > 50 ? batchText.substring(0, 50) + "..." : batchText;
          const progressLabel = `📂 สร้างไฟล์แยก: ${speaker}\n📄 ข้อความปัจจุบัน: "${snippet}"`;
          
          const pcm = await callGeminiTTS(batchText, config.voice, seedToUse, config.toneDescription, 1, onStatusUpdate, checkAborted, progressLabel);
          if (pcm) {
              audioChunks.push(pcm);
              if (!isLastBatchOverall) {
                  await handleInterBatchWait(interBatchDelaySec, bIdx + 1, speakerBatches.length, nextSnippet, onStatusUpdate, checkAborted);
              }
          }
      }
      if (audioChunks.length > 0) speakerAudioMap.set(speaker, createWavBlob(audioChunks));
    }
  } catch (e: any) {
      if (e.message !== "USER_ABORTED") throw e;
  }
  
  return speakerAudioMap;
};

export const performTextReasoning = async (
  prompt: string,
  modelId: string,
  systemInstruction?: string
): Promise<string> => {
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
