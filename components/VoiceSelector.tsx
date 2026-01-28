
import React from 'react';
import { VoiceName } from '../types';

interface VoiceSelectorProps {
  selected: VoiceName;
  onSelect: (voice: VoiceName) => void;
  label?: string;
}

const VOICES = [
  { name: VoiceName.Kore, description: 'Balanced, Clear' },
  { name: VoiceName.Puck, description: 'Lively, Energetic' },
  { name: VoiceName.Charon, description: 'Deep, Resonant' },
  { name: VoiceName.Zephyr, description: 'Soft, Warm' },
  { name: VoiceName.Fenrir, description: 'Authoritative, Firm' },
];

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({ selected, onSelect, label }) => {
  return (
    <div className="flex flex-col gap-2">
      {label && <label className="text-sm font-medium text-slate-400 uppercase tracking-wider">{label}</label>}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {VOICES.map((v) => (
          <button
            key={v.name}
            onClick={() => onSelect(v.name)}
            className={`p-3 rounded-xl border-2 transition-all text-left ${
              selected === v.name
                ? 'border-indigo-500 bg-indigo-500/10 text-white'
                : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="font-bold">{v.name}</div>
            <div className="text-xs opacity-70">{v.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
};
