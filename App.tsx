
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ScriptEditor from './components/ScriptEditor';
import VoiceSettings from './components/VoiceSettings';
import VoiceCloneModal from './components/VoiceCloneModal';
import VoiceLibraryModal from './components/VoiceLibraryModal';
import { generateSingleLineSpeech, generateMultiLineSpeech, generateSeparateSpeakerSpeech, performTextReasoning } from './services/geminiService';
import { playAudio, downloadAudio, setOnPlaybackStateChange, stopAudio } from './utils/audio';
import type { DialogueLine, SpeakerConfig, Voice, TextModel } from './types';
import { AVAILABLE_VOICES, EXAMPLE_SCRIPT, SPEEDS, EMOTIONS, TEXT_MODELS } from './constants';

const APP_VERSION = "v1.5.0 (AI Reasoning Edition)";
const LAST_UPDATED = "Nov 20, 2025 14:00";
const DEFAULT_SEED = 949222;

const App: React.FC = () => {
  const [scriptText, setScriptText] = useState<string>('');
  const [dialogueLines, setDialogueLines] = useState<DialogueLine[]>([]);
  const [speakerConfigs, setSpeakerConfigs] = useState<Map<string, SpeakerConfig>>(new Map());
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
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
  
  // New Global Settings
  const [textModelId, setTextModelId] = useState<string>(TEXT_MODELS[0].id);

  const allVoices = useMemo(() => [...AVAILABLE_VOICES, ...customVoices], [customVoices]);

  const handleSpeakerConfigChange = useCallback((speaker: string, newConfig: SpeakerConfig) => {
    setSpeakerConfigs(prevConfigs => {
      const newConfigs = new Map(prevConfigs);
      newConfigs.set(speaker, newConfig);
      return newConfigs;
    });
  }, []);

  const handlePlayFullStory = useCallback(async () => {
    if (!generatedStoryAudio) return;
    await playAudio(generatedStoryAudio, { 
      speed: storyPlaybackSpeed, 
      volume: storyPlaybackVolume 
    });
  }, [generatedStoryAudio, storyPlaybackSpeed, storyPlaybackVolume]);

  const handleOpenCloneModal = useCallback((speakerName: string) => {
    setActiveSpeakerForClone(speakerName);
    setIsCloneModalOpen(true);
  }, []);

  useEffect(() => {
    setOnPlaybackStateChange(setIsPlaying);
  }, []);

  useEffect(() => {
    const savedScript = localStorage.getItem('tts-script');
    const savedConfigs = localStorage.getItem('tts-speakerConfigs');
    const savedCustomVoices = localStorage.getItem('tts-customVoices');
    const savedTextModelId = localStorage.getItem('tts-textModelId');
    
    if (savedScript) setScriptText(savedScript);
    else setScriptText(EXAMPLE_SCRIPT);

    if (savedTextModelId) setTextModelId(savedTextModelId);

    if (savedConfigs) {
      try {
        const parsedConfigs: [string, any][] = JSON.parse(savedConfigs) as any;
        if (Array.isArray(parsedConfigs)) {
          const migratedConfigs = new Map<string, SpeakerConfig>(parsedConfigs.map(([speaker, config]) => {
              return [speaker, {
                  voice: config.voice || AVAILABLE_VOICES[0].id,
                  promptPrefix: config.promptPrefix || '',
                  emotion: config.emotion || 'none',
                  volume: config.volume || 1,
                  speed: config.speed || 'normal',
                  seed: config.seed !== undefined ? config.seed : DEFAULT_SEED,
              }];
          }));
          setSpeakerConfigs(migratedConfigs);
        }
      } catch (e: any) {
        console.error("Failed to parse speaker configs", e);
      }
    }
    if (savedCustomVoices) {
        try {
            const parsedData = JSON.parse(savedCustomVoices) as any;
            if (Array.isArray(parsedData)) {
                const migratedVoices: Voice[] = parsedData
                    .filter((voice: any) => voice && voice.id && voice.name)
                    .map((voice: any) => ({
                        id: voice.id,
                        name: voice.name,
                        isCustom: true,
                        baseVoiceId: voice.baseVoiceId || AVAILABLE_VOICES[0].id,
                    }));
                setCustomVoices(migratedVoices);
            }
        } catch (e: any) {
            console.error("Failed to parse custom voices", e);
        }
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
      let currentSpeaker: string = '';
      let text: string = '';
      if (match) {
        currentSpeaker = match[1].trim();
        text = match[2].trim();
        lastSpeaker = currentSpeaker;
      } else {
        if (!lastSpeaker) lastSpeaker = 'Speaker 1';
        currentSpeaker = lastSpeaker;
        text = trimmedLine;
      }
      if (currentSpeaker && text) {
        newDialogueLines.push({ id: `${index}-${currentSpeaker}`, speaker: currentSpeaker, text });
        newSpeakers.add(currentSpeaker);
      }
    });
    setDialogueLines(newDialogueLines);
    setSpeakerConfigs(prevConfigs => {
      const newConfigs = new Map<string, SpeakerConfig>(prevConfigs);
      let voiceIndex = 0;
      newSpeakers.forEach(speaker => {
        if (!newConfigs.has(speaker)) {
          newConfigs.set(speaker, {
            voice: AVAILABLE_VOICES[voiceIndex % AVAILABLE_VOICES.length].id,
            promptPrefix: '',
            emotion: 'none',
            volume: 1,
            speed: 'normal',
            seed: DEFAULT_SEED,
          });
          voiceIndex++;
        }
      });
      Array.from(newConfigs.keys()).forEach((speaker: string) => {
        if (!newSpeakers.has(speaker)) newConfigs.delete(speaker);
      });
      return newConfigs;
    });
  }, [scriptText]);
  
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSaveProgress = () => {
    localStorage.setItem('tts-script', scriptText);
    localStorage.setItem('tts-speakerConfigs', JSON.stringify(Array.from(speakerConfigs.entries())));
    localStorage.setItem('tts-customVoices', JSON.stringify(customVoices));
    localStorage.setItem('tts-textModelId', textModelId);
    showToast("Progress saved successfully!");
  };

  const constructFullPrefix = (config: SpeakerConfig) => {
    const speedAdverb = SPEEDS.find(s => s.value === config.speed)?.adverb ?? '';
    const emotionDesc = config.emotion !== 'none' ? config.emotion : '';

    if (!speedAdverb && !emotionDesc) return '';

    let fullPrefix = 'Please speak ';
    if (speedAdverb && emotionDesc) {
        fullPrefix += `${speedAdverb} and ${emotionDesc}:`;
    } else if (speedAdverb) {
        fullPrefix += `${speedAdverb}:`;
    } else if (emotionDesc) {
        fullPrefix += `${emotionDesc}:`;
    }
    return fullPrefix;
  };

  const handlePreviewLine = useCallback(async (line: DialogueLine) => {
    const config = speakerConfigs.get(line.speaker);
    if (!config) return;
    const voiceInfo = allVoices.find(v => v.id === config.voice);
    if (!voiceInfo) return;
    const voiceToUse = (voiceInfo.isCustom && voiceInfo.baseVoiceId) ? voiceInfo.baseVoiceId : voiceInfo.id;
    const fullPrefix = constructFullPrefix(config);
    const textToSpeak = `${fullPrefix} ${line.text}`.trim();

    try {
      const audioBlob = await generateSingleLineSpeech(textToSpeak, voiceToUse, config.seed);
      if (audioBlob) {
        await playAudio(audioBlob, { volume: Number(config.volume) });
      }
    } catch (error: any) {
      console.error(error);
      alert(`Synthesis Error: ${error.message}`);
    }
  }, [speakerConfigs, allVoices]);

  const handlePreviewSpeaker = useCallback(async (speakerName: string) => {
    const config = speakerConfigs.get(speakerName);
    if (!config) return;

    // Filter all lines belonging to this speaker
    const speakerLines = dialogueLines.filter(l => l.speaker === speakerName);
    if (speakerLines.length === 0) {
        // Default preview text if no lines exist
        await handlePreviewLine({ id: 'preview', speaker: speakerName, text: "This is a preview of my voice profile. Please add script text to hear a full performance." });
        return;
    }

    const voiceInfo = allVoices.find(v => v.id === config.voice);
    if (!voiceInfo) return;
    const voiceToUse = (voiceInfo.isCustom && voiceInfo.baseVoiceId) ? voiceInfo.baseVoiceId : voiceInfo.id;
    const fullPrefix = constructFullPrefix(config);

    const effectiveConfigs = new Map<string, SpeakerConfig>();
    effectiveConfigs.set(speakerName, { ...config, voice: voiceToUse, promptPrefix: fullPrefix });

    try {
        const audioBlob = await generateMultiLineSpeech(speakerLines, effectiveConfigs);
        if (audioBlob) {
            await playAudio(audioBlob, { volume: Number(config.volume) });
        }
    } catch (error: any) {
        console.error(error);
        alert(`Synthesis Error: ${error.message}`);
    }
  }, [speakerConfigs, dialogueLines, allVoices, handlePreviewLine]);

  const handleGenerateFullStory = async () => {
    if (dialogueLines.length === 0) return;
    setIsGenerating(true);
    setGeneratedStoryAudio(null);
    setGeneratedSpeakerAudio(new Map());

    const effectiveSpeakerConfigs = new Map<string, SpeakerConfig>();
    for (const line of dialogueLines) {
        if(!effectiveSpeakerConfigs.has(line.speaker)) {
            const config = speakerConfigs.get(line.speaker);
            if (!config) continue;
            const voiceInfo = allVoices.find(v => v.id === config.voice);
            if (!voiceInfo) continue;
            const voiceToUse = (voiceInfo.isCustom && voiceInfo.baseVoiceId) ? voiceInfo.baseVoiceId : voiceInfo.id;
            const fullPrefix = constructFullPrefix(config);
            effectiveSpeakerConfigs.set(line.speaker, { ...config, voice: voiceToUse, promptPrefix: fullPrefix });
        }
    }

    try {
        if (generationMode === 'combined') {
            const audioBlob = await generateMultiLineSpeech(dialogueLines, effectiveSpeakerConfigs);
            if (audioBlob) {
                setGeneratedStoryAudio(audioBlob);
                showToast("Full audio generated!");
            }
        } else {
            const speakerAudioMap = await generateSeparateSpeakerSpeech(dialogueLines, effectiveSpeakerConfigs);
            if (speakerAudioMap.size > 0) {
                setGeneratedSpeakerAudio(speakerAudioMap);
                showToast("Speaker files ready!");
            }
        }
    } catch (error: any) {
        console.error(error);
        alert(`Synthesis Error: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAiAction = async (action: 'idea' | 'polish' | 'translate' | 'caption') => {
      if (!scriptText.trim() && action !== 'idea') {
          showToast("Please enter some text first.");
          return;
      }

      setIsAiLoading(true);
      try {
          let prompt = "";
          let systemInstruction = "You are a specialized AI assistant for Buddhist Dhamma story narrators. Keep the tone respectful, wise, and serene.";
          
          switch (action) {
              case 'idea':
                  prompt = `Create a short, inspiring Buddhist Dhamma script outline or first few lines about "Inner Peace" or "Mindfulness". Use the format 'Speaker: Text'. Current script content: ${scriptText}`;
                  break;
              case 'polish':
                  prompt = `Improve the creative writing, flow, and vocabulary of the following script. Ensure it sounds natural for a narrator and maintains the established speaker tags. Script:\n${scriptText}`;
                  break;
              case 'translate':
                  prompt = `Translate the following script to Thai, maintaining the 'Speaker: Text' format. If it is already in Thai, translate it to English. Script:\n${scriptText}`;
                  break;
              case 'caption':
                  prompt = `Generate a short, engaging summary or caption for this story. Script:\n${scriptText}`;
                  break;
          }

          const result = await performTextReasoning(prompt, textModelId, systemInstruction);
          
          if (action === 'caption') {
              alert(`AI Caption:\n\n${result}`);
          } else if (action === 'idea') {
              setScriptText(prev => prev + (prev.trim() ? "\n\n" : "") + result);
              showToast("AI Idea added!");
          } else {
              setScriptText(result);
              showToast(`AI ${action.charAt(0).toUpperCase() + action.slice(1)} complete!`);
          }
      } catch (error: any) {
          console.error(error);
          alert(`AI Tool Error: ${error.message}`);
      } finally {
          setIsAiLoading(false);
      }
  };
  
  const handleDownload = () => {
    if(!generatedStoryAudio) return;
    downloadAudio(generatedStoryAudio, `TTS_Narrator_Master_${Date.now()}`);
  };

  const handleDownloadSpeakerFile = (speakerName: string) => {
    const audioBlob = generatedSpeakerAudio.get(speakerName);
    if (!audioBlob) return;
    downloadAudio(audioBlob, `TTS_Narrator_${speakerName}_${Date.now()}`);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-6">
          <h1 className="text-4xl lg:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-600">
            Text-to-Speech Story Narrator
          </h1>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-4">
              <div className="flex items-center gap-2 bg-gray-900/50 p-2 rounded-lg border border-gray-800">
                <label htmlFor="text-model" className="text-xs font-bold text-emerald-500 uppercase tracking-widest whitespace-nowrap">
                    Text Reasoning Model:
                </label>
                <select
                    id="text-model"
                    value={textModelId}
                    onChange={(e) => {
                        setTextModelId(e.target.value);
                        localStorage.setItem('tts-textModelId', e.target.value);
                    }}
                    className="bg-gray-800 text-xs font-bold text-white border-none rounded p-1 focus:ring-1 focus:ring-emerald-500"
                >
                    {TEXT_MODELS.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                </select>
              </div>
              <p className="text-xs text-gray-500 font-mono tracking-wide">
                {APP_VERSION} | Neural Voice Engine
              </p>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-14rem)] min-h-[600px]">
          <ScriptEditor
            scriptText={scriptText}
            setScriptText={setScriptText}
            onSave={handleSaveProgress}
            onClear={() => setScriptText('')}
            error={parsingError}
            onAiAction={handleAiAction}
            isAiLoading={isAiLoading}
          />
          <VoiceSettings
            speakerConfigs={speakerConfigs}
            onSpeakerConfigChange={handleSpeakerConfigChange}
            onPreviewLine={handlePreviewLine}
            onPreviewSpeaker={handlePreviewSpeaker}
            dialogueLines={dialogueLines}
            onGenerateFullStory={handleGenerateFullStory}
            isGenerating={isGenerating}
            generatedAudio={generatedStoryAudio}
            generatedSpeakerAudio={generatedSpeakerAudio}
            onDownload={handleDownload}
            onDownloadSpeakerFile={handleDownloadSpeakerFile}
            onPlayFullStory={handlePlayFullStory}
            onStopFullStory={stopAudio}
            isPlaying={isPlaying}
            onOpenLibrary={() => setIsLibraryModalOpen(true)}
            onCloneVoice={handleOpenCloneModal}
            allVoices={allVoices}
            storyPlaybackSpeed={storyPlaybackSpeed}
            setStoryPlaybackSpeed={setStoryPlaybackSpeed}
            storyPlaybackVolume={storyPlaybackVolume}
            setStoryPlaybackVolume={setStoryPlaybackVolume}
            generationMode={generationMode}
            setGenerationMode={setGenerationMode}
          />
        </main>
      </div>
      {toastMessage && (
        <div className="fixed bottom-5 right-5 bg-teal-600 text-white py-2 px-4 rounded-lg shadow-lg animate-fade-in-out z-50 border border-teal-400/50">
          {toastMessage}
        </div>
      )}
      {isCloneModalOpen && (
        <VoiceCloneModal 
            onClose={() => setIsCloneModalOpen(false)}
            onSave={(newVoice) => {
                const updated = [...customVoices, newVoice];
                setCustomVoices(updated);
                localStorage.setItem('tts-customVoices', JSON.stringify(updated));
                if (activeSpeakerForClone) {
                    const conf = speakerConfigs.get(activeSpeakerForClone);
                    if (conf) handleSpeakerConfigChange(activeSpeakerForClone, { ...conf, voice: newVoice.id });
                }
                setIsCloneModalOpen(false);
            }}
            onPreview={async (voice) => {
                const blob = await generateSingleLineSpeech(`Voice cloning profile successfully established for ${voice.name}. Ready for synthesis.`, voice.baseVoiceId!);
                if (blob) playAudio(blob);
            }}
            speakerName={activeSpeakerForClone}
        />
      )}
      {isLibraryModalOpen && (
        <VoiceLibraryModal
            onClose={() => setIsLibraryModalOpen(false)}
            customVoices={customVoices}
            onUpdate={(updated) => {
                setCustomVoices(updated);
                localStorage.setItem('tts-customVoices', JSON.stringify(updated));
            }}
            onPreview={async (voice) => {
                const blob = await generateSingleLineSpeech(`Selecting voice profile ${voice.name} from the library. Consistency check initiated.`, voice.baseVoiceId!);
                if (blob) playAudio(blob);
            }}
        />
      )}
    </div>
  );
};

export default App;
