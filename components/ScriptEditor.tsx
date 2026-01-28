
import React, { useState } from 'react';
import { SaveIcon, TrashIcon, CopyIcon, LoadingSpinner } from './icons';

interface ScriptEditorProps {
  scriptText: string;
  setScriptText: (text: string) => void;
  onSave: () => void;
  onClear: () => void;
  error: string | null;
  onAiAction: (action: 'idea' | 'polish' | 'translate' | 'caption') => Promise<void>;
  aiLoadingAction: 'idea' | 'polish' | 'translate' | 'caption' | null;
}

const ScriptEditor: React.FC<ScriptEditorProps> = ({ 
  scriptText, 
  setScriptText, 
  onSave, 
  onClear, 
  error, 
  onAiAction, 
  aiLoadingAction 
}) => {
  const [copySuccess, setCopySuccess] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(scriptText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const isAnyAiLoading = aiLoadingAction !== null;

  return (
    <div className="flex flex-col h-full bg-gray-800 rounded-lg p-4 shadow-lg">
      <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
        <h2 className="text-xl font-bold text-cyan-300">Story Script</h2>
        <div className="flex items-center gap-2 flex-wrap">
           <button
            onClick={handleCopy}
            className={`flex items-center gap-2 font-bold py-2 px-4 rounded-lg transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                copySuccess 
                ? "bg-teal-600 text-white hover:bg-teal-700" 
                : "bg-gray-600 hover:bg-gray-700 text-white"
            }`}
          >
            <CopyIcon className="w-5 h-5" />
            {copySuccess ? "Copied!" : "Copy"}
          </button>
           <button
            onClick={onClear}
            className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            <TrashIcon className="w-5 h-5" />
            Clear
          </button>
          <button
            onClick={onSave}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <SaveIcon className="w-5 h-5" />
            Save Progress
          </button>
        </div>
      </div>

      <div className="bg-gray-900/40 p-2 rounded-lg mb-3 flex items-center gap-2 flex-wrap border border-gray-700/50">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-2">AI Tools:</span>
          
          <button 
            disabled={isAnyAiLoading}
            onClick={() => onAiAction('idea')}
            className={`text-xs font-bold py-1.5 px-3 rounded-md border transition-all flex items-center gap-2 ${
              aiLoadingAction === 'idea' 
              ? 'bg-emerald-600 text-white border-emerald-500' 
              : 'bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border-emerald-500/30'
            }`}
          >
            {aiLoadingAction === 'idea' ? <LoadingSpinner className="w-3 h-3" /> : '💡'} 
            Idea
          </button>

          <button 
            disabled={isAnyAiLoading}
            onClick={() => onAiAction('polish')}
            className={`text-xs font-bold py-1.5 px-3 rounded-md border transition-all flex items-center gap-2 ${
              aiLoadingAction === 'polish' 
              ? 'bg-amber-600 text-white border-amber-500' 
              : 'bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 border-amber-500/30'
            }`}
          >
            {aiLoadingAction === 'polish' ? <LoadingSpinner className="w-3 h-3" /> : '✨'} 
            Polish
          </button>

          <button 
            disabled={isAnyAiLoading}
            onClick={() => onAiAction('translate')}
            className={`text-xs font-bold py-1.5 px-3 rounded-md border transition-all flex items-center gap-2 ${
              aiLoadingAction === 'translate' 
              ? 'bg-blue-600 text-white border-blue-500' 
              : 'bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border-blue-500/30'
            }`}
          >
            {aiLoadingAction === 'translate' ? <LoadingSpinner className="w-3 h-3" /> : '🌍'} 
            Translate
          </button>

          <button 
            disabled={isAnyAiLoading}
            onClick={() => onAiAction('caption')}
            className={`text-xs font-bold py-1.5 px-3 rounded-md border transition-all flex items-center gap-2 ${
              aiLoadingAction === 'caption' 
              ? 'bg-purple-600 text-white border-purple-500' 
              : 'bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 border-purple-500/30'
            }`}
          >
            {aiLoadingAction === 'caption' ? <LoadingSpinner className="w-3 h-3" /> : '📝'} 
            Caption
          </button>
      </div>

      <div className="text-sm text-gray-400 mb-2 space-y-1">
        <p>
            Format: <code className="bg-gray-700 p-1 rounded">Speaker Name: Dialogue...</code>
        </p>
      </div>
      <textarea
        rows={6}
        value={scriptText}
        onChange={(e) => setScriptText(e.target.value)}
        placeholder="Paste your script here..."
        className="w-full flex-grow bg-gray-900 border border-gray-700 rounded-lg p-3 text-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500"
      />
      {error && <div className="mt-2 text-red-400 bg-red-900/50 p-3 rounded-lg">{error}</div>}
    </div>
  );
};

export default ScriptEditor;
