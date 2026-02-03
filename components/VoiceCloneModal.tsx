
import React, { useState } from 'react';
import Modal from './Modal';
import { PlayIcon, LoadingSpinner, SaveIcon } from './icons';
import { AVAILABLE_VOICES } from '../constants';
import type { Voice } from '../types';

interface VoiceCloneModalProps {
  onClose: () => void;
  onSave: (newVoice: Voice) => void;
  onPreview: (voice: Voice) => Promise<void>;
  speakerName: string | null;
}

const TONE_SAMPLES = [
  "Smooth, warm, and professional with a gentle airiness and a measured, calm pace",
  "Deep, resonant, and authoritative speaking with a slow, deliberate cadence",
  "Light, cheerful, and youthful with clear enunciation and a brisk, energetic tempo",
  "Mellow, soft-spoken, and comforting like a bedtime story with natural, long pauses",
  "Firm, steady, and clear with a serious broadcast quality and consistent rhythmic timing",
  "Wise, elderly, and serene with natural pauses for breath and a very relaxed, slow delivery",
  "Energetic, bright, and engaging with slightly higher pitch and a fast, persuasive flow",
  "Raspy, textured, and mature with a lot of character and a uniquely slow, gravelly drawl",
  "Clear, neutral, and academic with a moderate, steady speed that is easy to follow",
  "Intimate, whispering, and sensitive with a very slow and emotional articulation"
];

const VoiceCloneModal: React.FC<VoiceCloneModalProps> = ({ onClose, onSave, onPreview, speakerName }) => {
  const [voiceName, setVoiceName] = useState(`${speakerName || 'Custom'} Clone`);
  const [baseVoice, setBaseVoice] = useState<string>(AVAILABLE_VOICES[0].id);
  const [toneDescription, setToneDescription] = useState<string>("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchConfidence, setMatchConfidence] = useState<number>(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type === 'audio/mpeg' || file.type === 'audio/wav') {
        setUploadedFile(file);
        setAnalysisComplete(false);
        setError(null);
      } else {
        setError('Please upload a valid .mp3 or .wav file.');
      }
    }
  };

  const handleAnalyze = () => {
    setIsAnalyzing(true);
    setError(null);
    
    // Simulate AI analysis and matching process
    setTimeout(() => {
      const randomVoiceIndex = Math.floor(Math.random() * AVAILABLE_VOICES.length);
      const matchedVoice = AVAILABLE_VOICES[randomVoiceIndex];
      const randomTone = TONE_SAMPLES[Math.floor(Math.random() * TONE_SAMPLES.length)];
      const confidence = 85 + Math.floor(Math.random() * 14); 

      setBaseVoice(matchedVoice.id);
      setToneDescription(randomTone);
      setMatchConfidence(confidence);
      setIsAnalyzing(false);
      setAnalysisComplete(true);
    }, 2000);
  };

  const tempVoice: Voice = {
    id: `custom-${Date.now()}`,
    name: voiceName,
    isCustom: true,
    baseVoiceId: baseVoice,
    toneDescription: toneDescription,
  };
  
  const handlePreview = async () => {
    setIsPreviewing(true);
    try {
        await onPreview(tempVoice);
    } catch(e) {
        console.error(e);
        setError("Preview failed to generate.");
    } finally {
        setIsPreviewing(false);
    }
  };

  const handleSave = () => {
    if (!voiceName.trim()) {
        setError("Voice name cannot be empty.");
        return;
    }
    onSave(tempVoice);
  };

  return (
    <Modal title="Clone a New Voice" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label htmlFor="voice-name" className="block text-sm font-medium text-gray-300 mb-1">
            New Voice Name
          </label>
          <input
            type="text"
            id="voice-name"
            value={voiceName}
            onChange={(e) => setVoiceName(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
            <label htmlFor="voice-sample" className="block text-sm font-medium text-gray-300 mb-1">
                Upload Voice Sample (.mp3, .wav)
            </label>
            <input
                type="file"
                id="voice-sample"
                accept=".mp3,.wav"
                onChange={handleFileChange}
                className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700"
            />
            <p className="text-xs text-gray-500 mt-1">
                The audio will be analyzed to extract voice characteristics (including tempo and tone). Original file is not stored.
            </p>
        </div>

        {uploadedFile && !analysisComplete && (
          <div className="text-center py-2">
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {isAnalyzing ? (
                <>
                    <LoadingSpinner />
                    <span>Analyzing Audio Profile...</span>
                </>
              ) : (
                'Analyze Voice Profile'
              )}
            </button>
          </div>
        )}

        {analysisComplete && (
            <div className="bg-green-900/30 border border-green-600/50 rounded-lg p-3 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                    <span className="text-green-400 font-semibold text-sm">Analysis Complete</span>
                    <span className="text-xs text-gray-400">Confidence: {matchConfidence}%</span>
                </div>
                
                <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">
                        Detected Tone & Tempo Profile
                    </label>
                    <textarea
                        value={toneDescription}
                        onChange={(e) => setToneDescription(e.target.value)}
                        className="w-full bg-black/40 border border-gray-600 rounded-md p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
                        rows={3}
                    />
                </div>

                 <div>
                    <label htmlFor="base-voice" className="block text-xs font-medium text-gray-400 mb-1">
                        Matched Base Model (Adjustable)
                    </label>
                    <select
                        id="base-voice"
                        value={baseVoice}
                        onChange={(e) => setBaseVoice(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 rounded-md p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        {AVAILABLE_VOICES.map((voice) => (
                            <option key={voice.id} value={voice.id}>
                                {voice.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        )}
        
        {error && <div className="mt-2 text-red-400 bg-red-900/50 p-3 rounded-lg text-sm">{error}</div>}

        <div className="flex justify-end items-center gap-3 pt-4 border-t border-gray-700">
            <button
                onClick={handlePreview}
                disabled={!analysisComplete || isPreviewing}
                className="flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed"
            >
                {isPreviewing ? <LoadingSpinner /> : <PlayIcon className="w-5 h-5" />}
                Preview
            </button>
            <button
                onClick={handleSave}
                disabled={!analysisComplete}
                className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed"
            >
                <SaveIcon className="w-5 h-5" />
                Save Voice
            </button>
        </div>
      </div>
      <style>{`
        @keyframes fade-in {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
            animation: fade-in 0.5s ease-out forwards;
        }
      `}</style>
    </Modal>
  );
};

export default VoiceCloneModal;
