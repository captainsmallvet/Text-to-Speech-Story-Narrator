
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ScriptEditor from './components/ScriptEditor';
import VoiceSettings from './components/VoiceSettings';
import VoiceCloneModal from './components/VoiceCloneModal';
import VoiceLibraryModal from './components/VoiceLibraryModal';
import Modal from './components/Modal';
import { generateSingleLineSpeech, generateMultiLineSpeech, generateSeparateSpeakerSpeech, performTextReasoning } from './services/geminiService';
import { playAudio, downloadAudio, setOnPlaybackStateChange, stopAudio } from './utils/audio';
import type { DialogueLine, SpeakerConfig, Voice, TextModel } from './types';
import { AVAILABLE_VOICES, EXAMPLE_SCRIPT, SPEEDS, EMOTIONS, TEXT_MODELS, DEFAULT_TONE } from './constants';
import { CopyIcon, LoadingSpinner } from './components/icons';

const APP_VERSION = "v1.9.25 (Stability Fix)";
const LAST_UPDATED = "Nov 21, 2025 04:00";

const INITIAL_DEFAULT_SEEDS = [949222, 949225, 949226, 949222, 949225];

const App: React.FC = () => {
  const isAbortingRef = useRef(false);
  const [scriptText, setScriptText] = useState<string>('');
  const [dialogueLines, setDialogueLines] = useState<DialogueLine[]>([]);
  const [speakerConfigs, setSpeakerConfigs] = useState<Map<string, SpeakerConfig>>(new Map());
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationStatus, setGenerationStatus] = useState<string>('');
  const [aiLoadingAction, setAiLoadingAction] = useState<'idea' | 'polish' | 'translate' | 'caption' | null>(null);
  const [infoModal, setInfoModal] = useState<{ title: string; content: string; type?: 'info' | 'error' | 'success' } | null>(null);
  const [generatedStoryAudio, setGeneratedStoryAudio] = useState<Blob | null>(null);
  const [generatedSpeakerAudio, setGeneratedSpeakerAudio] = useState<Map<string, Blob>>(new Map());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [generationMode, setGenerationMode] = useState<'combined' | 'separate'>('combined');
  const [storyPlaybackSpeed, setStoryPlaybackSpeed] = useState(1);
  const [storyPlaybackVolume, setStoryPlaybackVolume] = useState(1);
  const [customVoices, setCustomVoices] = useState<Voice[]>([]);
  const [isCloneModalOpen, setIsCloneModalOpen] = useState<boolean>(false);
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState<boolean>(false);
  const [activeSpeakerForClone, setActiveSpeakerForClone] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [statusCopySuccess, setStatusCopySuccess] = useState(false);
  const [textModelId, setTextModelId] = useState<string>(TEXT_MODELS[0].id);
  const [maxCharsPerBatch, setMaxCharsPerBatch] = useState<number>(3000);
  const [interBatchDelay, setInterBatchDelay] = useState<number>(120);

  const allVoices = useMemo(() => [...AVAILABLE_VOICES, ...customVoices], [customVoices]);

  const showInfoModal = (title: string, content: string, type: 'info' | 'error' | 'success' = 'info') => {
      setInfoModal({ title, content, type });
  };

  const handleSpeakerConfigChange = useCallback((speaker: string, newConfig: SpeakerConfig) => {
    setSpeakerConfigs(prevConfigs => {
      const nextConfigs = new Map(prevConfigs);
      nextConfigs.set(speaker, newConfig);
      return nextConfigs;
    });
  }, []);

  const handlePlayFullStory = useCallback(async () => {
    if (!generatedStoryAudio) return;
    await playAudio(generatedStoryAudio, { 
      speed: storyPlaybackSpeed, 
      volume: storyPlaybackVolume 
    });
  }, [generatedStoryAudio, storyPlaybackSpeed, storyPlaybackVolume]);

  const createDefaultSeeds = (baseOverride?: number) => {
    if (baseOverride !== undefined) {
      return [baseOverride, baseOverride + 1, baseOverride + 2, baseOverride + 3, baseOverride + 4];
    }
    return [...INITIAL_DEFAULT_SEEDS];
  };

  useEffect(() => {
    setOnPlaybackStateChange(setIsPlaying);
    const savedScript = localStorage.getItem('tts-script');
    const savedConfigs = localStorage.getItem('tts-speakerConfigs');
    const savedCustomVoices = localStorage.getItem('tts-customVoices');
    const savedTextModelId = localStorage.getItem('tts-textModelId');
    const savedMaxChars = localStorage.getItem('tts-maxCharsPerBatch');
    const savedDelay = localStorage.getItem('tts-interBatchDelay');

    if (savedScript) setScriptText(savedScript);
    else setScriptText(EXAMPLE_SCRIPT);
    
    if (savedTextModelId) setTextModelId(savedTextModelId);
    if (savedMaxChars) setMaxCharsPerBatch(parseInt(savedMaxChars) || 3000);
    if (savedDelay) setInterBatchDelay(parseInt(savedDelay) || 120);

    if (savedCustomVoices) {
        try {
            const parsedData = JSON.parse(savedCustomVoices);
            if (Array.isArray(parsedData)) {
                const migratedVoices: Voice[] = parsedData.filter((v: any) => v && v.id).map((v: any) => ({
                    id: v.id, 
                    name: v.name, 
                    isCustom: true, 
                    baseVoiceId: v.baseVoiceId || AVAILABLE_VOICES[0].id,
                    toneDescription: v.toneDescription || ''
                }));
                setCustomVoices(migratedVoices);
            }
        } catch (e) { console.error("Error loading custom voices:", e); }
    }

    if (savedConfigs) {
      try {
        const parsedConfigs: [string, any][] = JSON.parse(savedConfigs);
        if (Array.isArray(parsedConfigs)) {
          const migratedConfigs = new Map<string, SpeakerConfig>(parsedConfigs.map(([speaker, config]) => {
              let seeds = config.seeds;
              if (!seeds || !Array.isArray(seeds)) {
                  seeds = createDefaultSeeds(config.seed);
              }
              return [speaker, {
                  voice: config.voice || AVAILABLE_VOICES[0].id,
                  promptPrefix: config.promptPrefix || '',
                  emotion: config.emotion || 'none',
                  volume: config.volume || 1,
                  speed: config.speed || 'normal', 
                  seeds: seeds,
                  toneDescription: config.toneDescription || '',
              }];
          }));
          setSpeakerConfigs(migratedConfigs);
        }
      } catch (e) { console.error("Error loading speaker configs:", e); }
    }
  }, []);

  useEffect(() => {
    const lines = scriptText.split('\n');
    const newDialogueLines: DialogueLine[] = [];
    const newSpeakers = new Set<string>();
    let lastSpeaker: string | null = null;
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (trimmedLine === '') return;
      const match = trimmedLine.match(/^([^:]+):\s*(.*)$/);
      let currentSpeaker = match ? match[1].trim() : (lastSpeaker || 'Speaker 1');
      let text = match ? match[2].trim() : trimmedLine;
      if (match) lastSpeaker = currentSpeaker;
      if (currentSpeaker && text) {
        newDialogueLines.push({ id: `${index}-${currentSpeaker}`, speaker: currentSpeaker, text });
        newSpeakers.add(currentSpeaker);
      }
    });
    setDialogueLines(newDialogueLines);
    setSpeakerConfigs(prevConfigs => {
      const newConfigs = new Map<string, SpeakerConfig>();
      let voiceIndex = 0;
      newSpeakers.forEach(speaker => {
        if (prevConfigs.has(speaker)) {
            newConfigs.set(speaker, prevConfigs.get(speaker)!);
        } else {
          const defaultVoice = AVAILABLE_VOICES[voiceIndex % AVAILABLE_VOICES.length];
          newConfigs.set(speaker, {
            voice: defaultVoice.id,
            promptPrefix: '', 
            emotion: 'none', 
            volume: 1, 
            speed: 'normal', 
            seeds: createDefaultSeeds(voiceIndex === 0 ? undefined : (INITIAL_DEFAULT_SEEDS[0] + (voiceIndex * 10))),
            toneDescription: '',
          });
        }
        voiceIndex++;
      });
      return newConfigs;
    });
  }, [scriptText]);
  
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSaveProgress = () => {
    localStorage.setItem('tts-script', scriptText);
    localStorage.setItem('tts-speakerConfigs', JSON.stringify(Array.from(speakerConfigs.entries())));
    localStorage.setItem('tts-customVoices', JSON.stringify(customVoices));
    localStorage.setItem('tts-textModelId', textModelId);
    localStorage.setItem('tts-maxCharsPerBatch', maxCharsPerBatch.toString());
    localStorage.setItem('tts-interBatchDelay', interBatchDelay.toString());
    showToast("Progress saved successfully!");
  };

  const constructFullPrefix = (config: SpeakerConfig) => {
    const speedAdverb = SPEEDS.find(s => s.value === config.speed)?.adverb ?? '';
    const emotionDesc = config.emotion !== 'none' ? config.emotion : '';
    if (!speedAdverb && !emotionDesc) return '';
    let fullPrefix = 'Please speak ';
    if (speedAdverb && emotionDesc) fullPrefix += `${speedAdverb} and ${emotionDesc}:`;
    else if (speedAdverb) fullPrefix += `${speedAdverb}:`;
    else if (emotionDesc) fullPrefix += `${emotionDesc}:`;
    return fullPrefix;
  };

  const handlePreviewSpeaker = async (speaker: string) => {
    const lines = dialogueLines.filter(l => l.speaker === speaker);
    if (lines.length === 0) return;
    
    setIsGenerating(true);
    isAbortingRef.current = false;
    setGenerationStatus('กำลังเตรียมข้อมูลสำหรับพรีวิว...');
    
    try {
      const config = speakerConfigs.get(speaker);
      if (!config) throw new Error("Speaker config not found.");
      
      const voiceInfo = allVoices.find(v => v.id === config.voice);
      const voiceToUse = (voiceInfo?.isCustom && voiceInfo.baseVoiceId) ? voiceInfo.baseVoiceId : (voiceInfo?.id || AVAILABLE_VOICES[0].id);
      
      const combinedTone = `${voiceInfo?.toneDescription || ''} ${config.toneDescription || ''}`.trim();

      // Fix: Ensure config is correctly spread after narrowing to avoid "Spread types may only be created from object types" error
      const effectiveConfigs = new Map([[speaker, { 
        ...(config as SpeakerConfig), 
        voice: voiceToUse, 
        promptPrefix: constructFullPrefix(config),
        toneDescription: combinedTone
      }]]);

      const audioBlob = await generateMultiLineSpeech(
        lines, 
        effectiveConfigs, 
        (msg) => setGenerationStatus(msg), 
        () => isAbortingRef.current, 
        maxCharsPerBatch, 
        interBatchDelay
      );
      
      if (audioBlob) {
        await playAudio(audioBlob);
      }
    } catch (error: any) {
      showInfoModal("พรีวิวขัดข้อง", `ไม่สามารถพรีวิวเสียงได้: ${error.message}`, 'error');
    } finally {
      setIsGenerating(false);
      setGenerationStatus('');
    }
  };

  const handleGenerateFullStory = async () => {
    if (dialogueLines.length === 0) return;
    setIsGenerating(true);
    isAbortingRef.current = false;
    setGenerationStatus('กำลังเตรียมข้อมูล...');
    setGeneratedStoryAudio(null);
    setGeneratedSpeakerAudio(new Map());

    const effectiveSpeakerConfigs = new Map<string, SpeakerConfig>();
    for (const line of dialogueLines) {
        if(!effectiveSpeakerConfigs.has(line.speaker)) {
            const config = speakerConfigs.get(line.speaker);
            if (!config) continue;
            const voiceInfo = allVoices.find(v => v.id === config.voice);
            const voiceToUse = (voiceInfo?.isCustom && voiceInfo.baseVoiceId) ? voiceInfo.baseVoiceId : (voiceInfo?.id || AVAILABLE_VOICES[0].id);
            
            const combinedTone = `${voiceInfo?.toneDescription || ''} ${config.toneDescription || ''}`.trim();

            // Fix: Ensure config is correctly spread after narrowing to avoid potential "Spread types" error
            effectiveSpeakerConfigs.set(line.speaker, { 
              ...(config as SpeakerConfig), 
              voice: voiceToUse, 
              promptPrefix: constructFullPrefix(config),
              toneDescription: combinedTone
            });
        }
    }

    try {
        const checkAborted = () => isAbortingRef.current;
        if (generationMode === 'combined') {
            const audioBlob = await generateMultiLineSpeech(dialogueLines, effectiveSpeakerConfigs, (msg) => setGenerationStatus(msg), checkAborted, maxCharsPerBatch, interBatchDelay);
            if (audioBlob) {
                setGeneratedStoryAudio(audioBlob);
                if (isAbortingRef.current) showToast("Stopped! Partial audio saved.");
                else showToast("Full audio generated!");
            }
        } else {
            const speakerAudioMap = await generateSeparateSpeakerSpeech(dialogueLines, effectiveSpeakerConfigs, (msg) => setGenerationStatus(msg), checkAborted, maxCharsPerBatch, interBatchDelay);
            if (speakerAudioMap && speakerAudioMap.size > 0) {
                setGeneratedSpeakerAudio(speakerAudioMap);
                if (isAbortingRef.current) showToast("Stopped! Partial speaker files saved.");
                else showToast("Speaker files ready!");
            }
        }
    } catch (error: any) {
        if (error.message.startsWith("DAILY_QUOTA_EXCEEDED")) {
            const hours = error.message.split('|')[1];
            showInfoModal("โควต้ารายวันหมดแล้ว", `โควต้า Google Gemini ของคุณหมดลงแล้วสำหรับวันนี้ กรุณารอประมาณ ${hours} ชั่วโมง หรือเปลี่ยนไปใช้ API Key ชุดอื่นครับ`, 'error');
        } else {
            showInfoModal("เกิดข้อผิดพลาด", `ระบบหยุดทำงาน: ${error.message}`, 'error');
        }
    } finally {
      setIsGenerating(false);
      setGenerationStatus('');
    }
  };

  const handleAiAction = async (action: 'idea' | 'polish' | 'translate' | 'caption') => {
      if (!scriptText.trim() && action !== 'idea') {
          showToast("Please enter some text first.");
          return;
      }
      setAiLoadingAction(action);
      try {
          let prompt = "";
          let systemInstruction = "You are a specialized AI assistant for Dhamma story narrators. Keep the tone respectful, wise, and serene.";
          switch (action) {
              case 'idea': prompt = `Create a short, inspiring Buddhist Dhamma script outline or first few lines about "Inner Peace" or "Mindfulness". Use the format 'Speaker: Text'. Current script content: ${scriptText}`; break;
              case 'polish': prompt = `Improve the creative writing, flow, and vocabulary of the following script. Ensure it sounds natural for a narrator and maintains the established speaker tags. Script:\n${scriptText}`; break;
              case 'translate': prompt = `Translate the following script to Thai, maintaining the 'Speaker: Text' format. If it is already in Thai, translate it to English. Script:\n${scriptText}`; break;
              case 'caption': prompt = `Generate a short, engaging summary or caption for this story. Make it catchy and emotional for social media. Script:\n${scriptText}`; break;
          }
          const result = await performTextReasoning(prompt, textModelId, systemInstruction);
          const finalResult = result.trim();
          if (!finalResult) throw new Error("AI returned an empty response.");
          if (action === 'caption') showInfoModal("AI Generated Caption", finalResult, 'success');
          else if (action === 'idea') { setScriptText(prev => prev + (prev.trim() ? "\n\n" : "") + finalResult); showToast("AI Idea added!"); }
          else { setScriptText(finalResult); showToast(`AI ${action.charAt(0).toUpperCase() + action.slice(1)} complete!`); }
      } catch (error: any) {
          showInfoModal("AI Tool Error", error.message, 'error');
      } finally { setAiLoadingAction(null); }
  };

  const handleCopyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) { console.error(err); }
  };

  const handleCopyStatus = async () => {
    try {
      await navigator.clipboard.writeText(generationStatus);
      setStatusCopySuccess(true);
      setTimeout(() => setStatusCopySuccess(false), 2000);
    } catch (err) { console.error(err); }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-10">
          <h1 className="text-4xl lg:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-600">
            Text-to-Speech Story Narrator
          </h1>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-4 text-xs">
              <div className="flex items-center gap-2 bg-gray-900/50 p-2 rounded-lg border border-gray-800">
                <label className="font-bold text-emerald-500 uppercase tracking-widest whitespace-nowrap">Model:</label>
                <select
                    value={textModelId} onChange={(e) => { setTextModelId(e.target.value); localStorage.setItem('tts-textModelId', e.target.value); }}
                    className="bg-gray-800 text-white border-none rounded p-1 outline-none"
                >
                    {TEXT_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <p className="text-gray-500 font-mono">{APP_VERSION} | Neural Voice Engine</p>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-14rem)] min-h-[600px]">
          <ScriptEditor
            scriptText={scriptText} setScriptText={setScriptText} onSave={handleSaveProgress} onClear={() => setScriptText('')}
            error={parsingError} onAiAction={handleAiAction} aiLoadingAction={aiLoadingAction}
          />
          <VoiceSettings
            speakerConfigs={speakerConfigs} onSpeakerConfigChange={handleSpeakerConfigChange}
            onPreviewLine={(l) => {
                const config = speakerConfigs.get(l.speaker);
                if (!config) return Promise.resolve();
                const seedToUse = config.seeds[0];
                const prefix = constructFullPrefix(config);
                const voiceInfo = allVoices.find(v => v.id === config.voice);
                const combinedTone = `${voiceInfo?.toneDescription || ''} ${config.toneDescription || ''}`.trim();
                return generateSingleLineSpeech(`${prefix} ${l.text}`, config.voice, seedToUse, combinedTone).then(b => b && playAudio(b));
            }}
            onPreviewSpeaker={handlePreviewSpeaker}
            dialogueLines={dialogueLines} onGenerateFullStory={handleGenerateFullStory} isGenerating={isGenerating}
            generatedAudio={generatedStoryAudio} generatedSpeakerAudio={generatedSpeakerAudio}
            onDownload={() => generatedStoryAudio && downloadAudio(generatedStoryAudio, `Story_Master_${Date.now()}`)}
            onDownloadSpeakerFile={(s) => generatedSpeakerAudio.get(s) && downloadAudio(generatedSpeakerAudio.get(s)!, `Voice_${s}`)}
            onPlayFullStory={handlePlayFullStory} onStopFullStory={stopAudio} isPlaying={isPlaying}
            onOpenLibrary={() => setIsLibraryModalOpen(true)} onCloneVoice={(s) => { setActiveSpeakerForClone(s); setIsCloneModalOpen(true); }}
            allVoices={allVoices} storyPlaybackSpeed={storyPlaybackSpeed} setStoryPlaybackSpeed={setStoryPlaybackSpeed}
            storyPlaybackVolume={storyPlaybackVolume} setStoryPlaybackVolume={setStoryPlaybackVolume}
            generationMode={generationMode} setGenerationMode={setGenerationMode}
            maxCharsPerBatch={maxCharsPerBatch} setMaxCharsPerBatch={setMaxCharsPerBatch}
            interBatchDelay={interBatchDelay} setInterBatchDelay={setInterBatchDelay}
          />
        </main>
      </div>

      {isGenerating && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-gray-900 border border-emerald-500/30 rounded-2xl p-8 max-w-lg w-full text-center shadow-2xl space-y-6 animate-fade-in">
                  <div className="relative inline-block">
                    <LoadingSpinner className="w-16 h-16 text-emerald-500" />
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-emerald-300">AI</div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-white">ระบบกำลังประมวลผลเสียง</h3>
                    <div className="bg-black/40 rounded-lg p-4 border border-gray-800 text-left min-h-[120px] relative group">
                        <p className="text-emerald-400 font-mono text-sm whitespace-pre-line leading-relaxed pr-10">
                            {generationStatus || "กำลังเตรียมพากย์เสียง..."}
                        </p>
                        <button
                          onClick={handleCopyStatus}
                          className={`absolute top-2 right-2 p-2 rounded-lg transition-all border ${
                            statusCopySuccess 
                            ? "bg-emerald-600 text-white border-emerald-400" 
                            : "bg-gray-800/80 text-gray-400 border-gray-700 hover:text-emerald-400 hover:border-emerald-500"
                          }`}
                          title="คัดลอกสถานะปัจจุบัน"
                        >
                          {statusCopySuccess ? (
                            <span className="text-[10px] font-bold">Copied!</span>
                          ) : (
                            <CopyIcon className="w-4 h-4" />
                          )}
                        </button>
                    </div>
                  </div>
                  <p className="text-gray-400 text-xs leading-relaxed">
                      * คุณสามารถกดหยุดเพื่อบันทึกไฟล์เสียงเฉพาะส่วนที่สร้างเสร็จแล้วได้ทันที
                  </p>
                  <button 
                    onClick={() => { isAbortingRef.current = true; }}
                    className="w-full bg-orange-600/20 hover:bg-orange-600 text-orange-400 hover:text-white border border-orange-500/30 py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <span>⏹ หยุดและเก็บส่วนที่เสร็จแล้ว (Finish Partial)</span>
                  </button>
              </div>
          </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-5 right-5 bg-gray-900 text-white py-3 px-4 rounded-xl shadow-2xl animate-fade-in-out z-50 border border-gray-700 flex items-center gap-3">
          <span className="flex-grow">{toastMessage}</span>
          <button onClick={() => { handleCopyText(toastMessage); showToast("Copied!"); }} className="p-1.5 hover:bg-gray-700 rounded-md text-gray-400"><CopyIcon className="w-4 h-4" /></button>
        </div>
      )}

      {isCloneModalOpen && (
        <VoiceCloneModal 
            onClose={() => setIsCloneModalOpen(false)}
            onSave={(nv) => { 
                const updatedCustomVoices = [...customVoices, nv]; 
                setCustomVoices(updatedCustomVoices); 
                localStorage.setItem('tts-customVoices', JSON.stringify(updatedCustomVoices)); 
                
                if (activeSpeakerForClone) {
                    setSpeakerConfigs(prev => {
                        const next = new Map(prev);
                        const current = next.get(activeSpeakerForClone);
                        // Fix: Explicitly narrowing current to avoid "Spread types may only be created from object types"
                        if (current) {
                            next.set(activeSpeakerForClone, {
                                ...(current as SpeakerConfig),
                                voice: nv.id,
                                toneDescription: '' // Reset override field when changing voice
                            });
                        }
                        return next;
                    });
                }
                setIsCloneModalOpen(false); 
            }}
            onPreview={async (v) => generateSingleLineSpeech(`Voice DNA analyzed. ${v.toneDescription || ''}`, v.baseVoiceId!).then(b => b && playAudio(b))}
            speakerName={activeSpeakerForClone}
        />
      )}

      {isLibraryModalOpen && (
        <VoiceLibraryModal
            onClose={() => setIsLibraryModalOpen(false)} customVoices={customVoices}
            onUpdate={(u) => { setCustomVoices(u); localStorage.setItem('tts-customVoices', JSON.stringify(u)); }}
            onPreview={async (v) => generateSingleLineSpeech(`Previewing voice ${v.name}. ${v.toneDescription || ''}`, v.baseVoiceId!).then(b => b && playAudio(b))}
        />
      )}

      {infoModal && (
        <Modal title={infoModal.title} onClose={() => setInfoModal(null)}>
          <div className="space-y-4">
            <div className={`p-4 rounded-lg border max-h-64 overflow-y-auto ${infoModal.type === 'error' ? 'bg-red-900/20 border-red-800' : infoModal.type === 'success' ? 'bg-emerald-900/20 border-emerald-800' : 'bg-gray-900 border-gray-700'}`}>
              <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">{infoModal.content}</p>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => handleCopyText(infoModal.content)} className={`flex items-center gap-2 font-bold py-2 px-4 rounded-lg transition-all ${copySuccess ? "bg-teal-600 text-white" : "bg-indigo-600 hover:bg-indigo-700 text-white"}`}>
                <CopyIcon className="w-5 h-5" /> {copySuccess ? "Copied!" : "Copy Content"}
              </button>
              <button onClick={() => setInfoModal(null)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">Close</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default App;
