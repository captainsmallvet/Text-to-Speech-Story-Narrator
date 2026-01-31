import React from 'react';
import type { DialogueLine, SpeakerConfig, Voice } from '../types';
import SpeakerControl from './SpeakerControl';
import { PlayIcon, DownloadIcon, LoadingSpinner, LibraryIcon, StopIcon } from './icons';

interface VoiceSettingsProps {
  speakerConfigs: Map<string, SpeakerConfig>;
  onSpeakerConfigChange: (speaker: string, newConfig: SpeakerConfig) => void;
  onPreviewLine: (line: DialogueLine) => Promise<void>;
  onPreviewSpeaker: (speakerName: string) => Promise<void>;
  dialogueLines: DialogueLine[];
  onGenerateFullStory: () => void;
  isGenerating: boolean;
  generatedAudio: Blob | null;
  generatedSpeakerAudio: Map<string, Blob>;
  onDownload: () => void;
  onDownloadSpeakerFile: (speaker: string) => void;
  onPlayFullStory: () => void;
  onStopFullStory: () => void;
  isPlaying: boolean;
  onOpenLibrary: () => void;
  onCloneVoice: (speakerName: string) => void;
  allVoices: Voice[];
  storyPlaybackSpeed: number;
  setStoryPlaybackSpeed: (speed: number) => void;
  storyPlaybackVolume: number;
  setStoryPlaybackVolume: (volume: number) => void;
  generationMode: 'combined' | 'separate';
  setGenerationMode: (mode: 'combined' | 'separate') => void;
  maxCharsPerBatch: number;
  setMaxCharsPerBatch: (val: number) => void;
  interBatchDelay: number;
  setInterBatchDelay: (val: number) => void;
}

const VoiceSettings: React.FC<VoiceSettingsProps> = ({
  speakerConfigs,
  onSpeakerConfigChange,
  onPreviewLine,
  onPreviewSpeaker,
  dialogueLines,
  onGenerateFullStory,
  isGenerating,
  generatedAudio,
  generatedSpeakerAudio,
  onDownload,
  onDownloadSpeakerFile,
  onPlayFullStory,
  onStopFullStory,
  isPlaying,
  onOpenLibrary,
  onCloneVoice,
  allVoices,
  storyPlaybackSpeed,
  setStoryPlaybackSpeed,
  storyPlaybackVolume,
  setStoryPlaybackVolume,
  generationMode,
  setGenerationMode,
  maxCharsPerBatch,
  setMaxCharsPerBatch,
  interBatchDelay,
  setInterBatchDelay,
}) => {
  const speakers = Array.from(speakerConfigs.keys());

  const handleMaxCharsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = parseInt(e.target.value) || 0;
    if (val > 5000) val = 5000;
    setMaxCharsPerBatch(val);
  };

  const handleDelayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = parseInt(e.target.value) || 0;
    setInterBatchDelay(val);
  };

  return (
    <div className="flex flex-col h-full bg-gray-800 rounded-lg p-4 shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-cyan-300">Voice Mapping & Settings</h2>
        <button
          onClick={onOpenLibrary}
          className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-lg"
        >
          <LibraryIcon className="w-5 h-5" />
          Voice Library
        </button>
      </div>
      
      {speakers.length === 0 ? (
        <div className="flex-grow flex items-center justify-center text-gray-500">
          <p>No speakers detected. Type in the script to begin.</p>
        </div>
      ) : (
        <div className="flex-grow overflow-y-auto space-y-4 pr-2">
          {speakers.map((speaker) => (
            <SpeakerControl
              key={speaker}
              speakerName={speaker}
              config={speakerConfigs.get(speaker)!}
              onConfigChange={(newConfig) => onSpeakerConfigChange(speaker, newConfig)}
              onPreview={async () => {
                await onPreviewSpeaker(speaker);
              }}
              onStop={onStopFullStory}
              onCloneVoice={() => onCloneVoice(speaker)}
              allVoices={allVoices}
              isCurrentlyPlaying={isPlaying}
            />
          ))}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-700 flex flex-col gap-3">
        <div className="mb-1">
          <label className="block text-sm font-medium text-gray-300 mb-2">Synthesis Target</label>
          <div className="flex gap-2 rounded-lg bg-gray-900/50 p-1">
            <button
              onClick={() => setGenerationMode('combined')}
              className={`w-full py-2 px-3 rounded-md text-sm font-semibold transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 ${generationMode === 'combined' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-700'}`}
            >
              Master Story
            </button>
            <button
              onClick={() => setGenerationMode('separate')}
              className={`w-full py-2 px-3 rounded-md text-sm font-semibold transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 ${generationMode === 'separate' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-700'}`}
            >
              Individual Files
            </button>
          </div>
        </div>

        <button
          onClick={onGenerateFullStory}
          disabled={isGenerating || speakers.length === 0}
          className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed shadow-lg shadow-red-900/20"
        >
          {isGenerating ? (
            <>
              <LoadingSpinner />
              <span>Synthesizing Final Master...</span>
            </>
          ) : (
            "Generate All Audio"
          )}
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-gray-900/60 p-3 rounded-lg border border-gray-700/50">
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="batch-chars" className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Batch Size (Chars)
                </label>
              </div>
              <input
                id="batch-chars"
                type="number"
                min="100"
                max="5000"
                step="100"
                value={maxCharsPerBatch}
                onChange={handleMaxCharsChange}
                className="w-full bg-black border border-gray-700 rounded px-2 py-1 text-sm font-mono text-emerald-400 outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <div className="bg-gray-900/60 p-3 rounded-lg border border-gray-700/50">
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="batch-delay" className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Inter-batch Delay (Sec)
                </label>
              </div>
              <input
                id="batch-delay"
                type="number"
                min="0"
                max="600"
                step="5"
                value={interBatchDelay}
                onChange={handleDelayChange}
                className="w-full bg-black border border-gray-700 rounded px-2 py-1 text-sm font-mono text-amber-400 outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
        </div>
        <p className="text-[10px] text-gray-500 leading-tight px-1">
          * แนะนำ: 4,500 ตัวอักษร และเว้นระยะ 120 วินาที เพื่อรักษาเสถียรภาพของคุณภาพเสียงในแต่ละชุด (ระบบจะสุ่มบวกเพิ่ม 1-10s อัตโนมัติ)
        </p>

        {generatedAudio && (
          <div className="space-y-3 bg-gray-900/50 p-3 rounded-lg border border-gray-700 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex gap-3">
                <button
                  onClick={onPlayFullStory}
                  disabled={isPlaying}
                  className="w-1/2 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed shadow-md"
                >
                  <PlayIcon className="w-5 h-5" />
                  Play
                </button>
                <button
                  onClick={onStopFullStory}
                  disabled={!isPlaying}
                  className="w-1/2 flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed shadow-md"
                >
                  <StopIcon className="w-5 h-5 fill-transparent" />
                  Stop
                </button>
              </div>
              <button
                onClick={onDownload}
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300 shadow-md"
              >
                <DownloadIcon className="w-5 h-5" />
                Download Master
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                 <div>
                    <label htmlFor="story-speed" className="block text-sm font-medium text-gray-300 mb-1">
                        Master Speed: <span className="font-mono">{Number(storyPlaybackSpeed).toFixed(1)}x</span>
                    </label>
                    <input
                        type="range"
                        id="story-speed"
                        min="0.5"
                        max="2"
                        step="0.1"
                        value={storyPlaybackSpeed}
                        onChange={(e) => setStoryPlaybackSpeed(parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                </div>
                <div>
                    <label htmlFor="story-volume" className="block text-sm font-medium text-gray-300 mb-1">
                        Master Volume: <span className="font-mono">{Number(storyPlaybackVolume).toFixed(1)}x</span>
                    </label>
                    <input
                        type="range"
                        id="story-volume"
                        min="0"
                        max="1.5"
                        step="0.1"
                        value={storyPlaybackVolume}
                        onChange={(e) => setStoryPlaybackVolume(parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                </div>
            </div>
          </div>
        )}
        {generatedSpeakerAudio.size > 0 && (
           <div className="space-y-3 bg-gray-900/50 p-3 rounded-lg border border-gray-700">
            <h4 className="text-md font-semibold text-gray-300 mb-2">Individual Speaker Files</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
              {Array.from(generatedSpeakerAudio.entries()).map(([speaker, audioData]) => (
                audioData && <div key={speaker} className="flex justify-between items-center bg-gray-700/50 p-2 rounded-md hover:bg-gray-700 transition-colors">
                    <span className="text-gray-200 font-medium">{speaker}</span>
                    <button
                        onClick={() => onDownloadSpeakerFile(speaker)}
                        className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded-md transition-colors duration-300 text-sm shadow-sm"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        Download
                    </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes fade-in {
            from { opacity: 0; transform: translateY(5px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
            animation: fade-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default VoiceSettings;