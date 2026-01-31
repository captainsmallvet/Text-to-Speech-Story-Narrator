import React, { useState } from 'react';
import type { SpeakerConfig, Voice } from '../types';
import { AVAILABLE_VOICES, EMOTIONS, SPEEDS } from '../constants';
import { PlayIcon, LoadingSpinner, VoiceCloneIcon, StopIcon } from './icons';

interface SpeakerControlProps {
  speakerName: string;
  config: SpeakerConfig;
  onConfigChange: (newConfig: SpeakerConfig) => void;
  onPreview: () => Promise<void>;
  onStop: () => void;
  onCloneVoice: () => void;
  allVoices: Voice[];
  isCurrentlyPlaying: boolean;
}

const SpeakerControl: React.FC<SpeakerControlProps> = ({ 
  speakerName, 
  config, 
  onConfigChange, 
  onPreview, 
  onStop,
  onCloneVoice, 
  allVoices,
  isCurrentlyPlaying
}) => {
  const [isPreviewing, setIsPreviewing] = useState(false);
  const customVoices = allVoices.filter(v => v.isCustom);

  const handlePreviewClick = async () => {
    setIsPreviewing(true);
    try {
      await onPreview();
    } catch (error) {
      console.error(`Preview failed for ${speakerName}:`, error);
    } finally {
      setIsPreviewing(false);
    }
  };

  const randomizeSeed = () => {
    onConfigChange({ ...config, seed: Math.floor(Math.random() * 1000000) });
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 transition-all hover:border-cyan-500">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
        <h3 className="text-lg font-semibold text-cyan-400">{speakerName}</h3>
        <div className="flex items-center gap-2 flex-wrap">
           <button
            onClick={onCloneVoice}
            title="Clone a new voice"
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-3 rounded-md transition-colors duration-300 text-xs shadow-lg shadow-indigo-900/20"
          >
            <VoiceCloneIcon className="w-4 h-4" />
            <span>Clone Voice</span>
          </button>
          
          <div className="flex items-center gap-1 bg-gray-900/50 p-1 rounded-lg">
            <button
              onClick={handlePreviewClick}
              disabled={isPreviewing}
              className={`flex items-center gap-2 ${
                isCurrentlyPlaying ? 'bg-cyan-700' : 'bg-cyan-600 hover:bg-cyan-700'
              } text-white font-bold py-1.5 px-3 rounded-md transition-colors duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed text-xs`}
            >
              {isPreviewing ? (
                <>
                  <LoadingSpinner className="w-4 h-4" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <PlayIcon className="w-4 h-4" />
                  <span>Preview Full</span>
                </>
              )}
            </button>
            <button
              onClick={onStop}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-1.5 px-3 rounded-md transition-colors duration-300 text-xs"
              title="Stop Preview"
            >
              <StopIcon className="w-4 h-4" />
              <span>Stop</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label htmlFor={`voice-${speakerName}`} className="block text-xs font-medium text-gray-400 mb-1">
            Voice Model
          </label>
          <select
            id={`voice-${speakerName}`}
            value={config.voice}
            onChange={(e) => onConfigChange({ ...config, voice: e.target.value })}
            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <optgroup label="Pre-built Voices">
                {AVAILABLE_VOICES.map((voice: Voice) => (
                <option key={voice.id} value={voice.id}>
                    {voice.name}
                </option>
                ))}
            </optgroup>
            {customVoices.length > 0 && (
                <optgroup label="Custom Voices">
                    {customVoices.map((voice: Voice) => (
                    <option key={voice.id} value={voice.id}>
                        {voice.name} (Custom)
                    </option>
                    ))}
                </optgroup>
            )}
          </select>
        </div>
        <div>
          <label htmlFor={`emotion-${speakerName}`} className="block text-xs font-medium text-gray-400 mb-1">
            Emotion / Style
          </label>
          <select
            id={`emotion-${speakerName}`}
            value={config.emotion}
            onChange={(e) => onConfigChange({ ...config, emotion: e.target.value })}
            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {EMOTIONS.map(emotion => (
              <option key={emotion.value} value={emotion.value}>{emotion.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`speed-${speakerName}`} className="block text-xs font-medium text-gray-400 mb-1">
            Narrator Speed
          </label>
          <select
            id={`speed-${speakerName}`}
            value={config.speed}
            onChange={(e) => onConfigChange({ ...config, speed: e.target.value })}
            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {SPEEDS.map(speed => (
              <option key={speed.value} value={speed.value}>{speed.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`seed-${speakerName}`} className="block text-xs font-medium text-gray-400 mb-1">
            Voice Seed (Variation)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              id={`seed-${speakerName}`}
              value={config.seed}
              onChange={(e) => onConfigChange({ ...config, seed: parseInt(e.target.value) || 0 })}
              className="flex-grow bg-gray-700 border border-gray-600 rounded-md p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
            <button
                onClick={randomizeSeed}
                title="Randomize Voice Take"
                className="bg-gray-600 hover:bg-gray-500 text-white p-2 rounded-md transition-colors"
            >
                🎲
            </button>
          </div>
        </div>
        
        {/* New Tone Description Field */}
        <div className="md:col-span-2 lg:col-span-4">
          <label htmlFor={`tone-${speakerName}`} className="block text-xs font-medium text-emerald-400 mb-1">
            Voice Tone / Aesthetic (แนะนำ: ระบุเพื่อความนุ่มนวล ลดเสียงแตก/แหลม)
          </label>
          <input
            type="text"
            id={`tone-${speakerName}`}
            value={config.toneDescription || ''}
            onChange={(e) => onConfigChange({ ...config, toneDescription: e.target.value })}
            placeholder="e.g. clear, deep, soft, warm, friendly tone..."
            className="w-full bg-black/40 border border-gray-700 rounded-md p-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

         <div className="md:col-span-2 lg:col-span-4">
            <label htmlFor={`volume-${speakerName}`} className="block text-xs font-medium text-gray-400 mb-1">
                Volume: <span className="font-mono text-cyan-300">{Number(config.volume).toFixed(1)}x</span>
            </label>
            <input
                type="range"
                id={`volume-${speakerName}`}
                min="0"
                max="1.5"
                step="0.1"
                value={config.volume}
                onChange={(e) => onConfigChange({ ...config, volume: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
        </div>
      </div>
    </div>
  );
};

export default SpeakerControl;