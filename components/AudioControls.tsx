
import React, { useState, useEffect, useRef } from 'react';

interface AudioControlsProps {
  audioBuffer: AudioBuffer | null;
  onFinished?: () => void;
}

const AudioControls: React.FC<AudioControlsProps> = ({ audioBuffer, onFinished }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, []);

  const togglePlayback = () => {
    if (isPlaying) {
      pausePlayback();
    } else {
      startPlayback();
    }
  };

  const startPlayback = () => {
    if (!audioBuffer) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }

    const ctx = audioContextRef.current;
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    
    source.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      pauseTimeRef.current = 0;
      if (onFinished) onFinished();
    };

    const offset = pauseTimeRef.current;
    source.start(0, offset);
    sourceRef.current = source;
    startTimeRef.current = ctx.currentTime - offset;
    setIsPlaying(true);
  };

  const pausePlayback = () => {
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current = null;
      if (audioContextRef.current) {
        pauseTimeRef.current = audioContextRef.current.currentTime - startTimeRef.current;
      }
    }
    setIsPlaying(false);
  };

  const stopPlayback = () => {
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current = null;
    }
    setIsPlaying(false);
    pauseTimeRef.current = 0;
  };

  return (
    <div className="flex items-center gap-4 py-4">
      <button
        onClick={togglePlayback}
        disabled={!audioBuffer}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
          !audioBuffer 
            ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
        }`}
      >
        {isPlaying ? (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
        ) : (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        )}
      </button>
      
      <div className="flex-1">
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-indigo-500 transition-all duration-100" 
            style={{ width: `${audioBuffer ? (pauseTimeRef.current / audioBuffer.duration) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="text-xs font-mono text-slate-400">
        {audioBuffer ? `${Math.round(pauseTimeRef.current)}s / ${Math.round(audioBuffer.duration)}s` : "0s / 0s"}
      </div>
    </div>
  );
};

export default AudioControls;
