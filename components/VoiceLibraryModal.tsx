
import React, { useState, useRef } from 'react';
import Modal from './Modal';
import { PlayIcon, TrashIcon, PencilIcon, SaveIcon, LoadingSpinner, CloseIcon, DownloadIcon, UploadIcon } from './icons';
import { AVAILABLE_VOICES } from '../constants';
import type { Voice } from '../types';

interface VoiceLibraryModalProps {
  onClose: () => void;
  customVoices: Voice[];
  onUpdate: (updatedVoices: Voice[]) => void;
  onPreview: (voice: Voice) => Promise<void>;
}

const VoiceLibraryModal: React.FC<VoiceLibraryModalProps> = ({ onClose, customVoices, onUpdate, onPreview }) => {
  const [editingVoiceId, setEditingVoiceId] = useState<string | null>(null);
  const [deletingVoiceId, setDeletingVoiceId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleEdit = (voice: Voice) => {
    setEditingVoiceId(voice.id);
    setDeletingVoiceId(null);
    setNewName(voice.name);
    setImportStatus(null);
  };
  
  const handleCancelEdit = () => {
    setEditingVoiceId(null);
    setNewName('');
  };

  const handleSaveEdit = (voiceId: string) => {
    const updatedVoices = customVoices.map(v => 
      v.id === voiceId ? { ...v, name: newName } : v
    );
    onUpdate(updatedVoices);
    handleCancelEdit();
  };

  const requestDelete = (voiceId: string) => {
    setDeletingVoiceId(voiceId);
    setEditingVoiceId(null);
    setImportStatus(null);
  };

  const confirmDelete = (voiceId: string) => {
    const updatedVoices = customVoices.filter(v => v.id !== voiceId);
    onUpdate(updatedVoices);
    setDeletingVoiceId(null);
  };

  const cancelDelete = () => {
    setDeletingVoiceId(null);
  };

  const handlePreview = async (voice: Voice) => {
    setPreviewingId(voice.id);
    setImportStatus(null);
    try {
        await onPreview(voice);
    } catch(e) {
        console.error(e);
        setImportStatus({ type: 'error', message: "Failed to generate preview." });
    } finally {
        setPreviewingId(null);
    }
  };

  const handleExportBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(customVoices));
    const date = new Date().toISOString().split('T')[0];
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `voice_library_backup_${date}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    setImportStatus({ type: 'success', message: "Backup file downloaded successfully." });
  };

  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset the input value immediately so the same file can be selected again if needed
    event.target.value = '';
    setImportStatus({ type: 'success', message: "Processing file..." }); // Show temporary loading state

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const content = e.target?.result;
            if (typeof content === 'string') {
                let importedData;
                try {
                    importedData = JSON.parse(content);
                } catch (parseError) {
                     setImportStatus({ type: 'error', message: "Invalid file format. JSON parsing failed." });
                     return;
                }
                
                if (!Array.isArray(importedData)) {
                    setImportStatus({ type: 'error', message: "Invalid backup format. Expected a list of voices." });
                    return;
                }
                
                const existingIds = new Set(customVoices.map(v => v.id));
                const validPrebuiltIds = new Set(AVAILABLE_VOICES.map(v => v.id));
                const validNewVoices: Voice[] = [];
                let duplicateCount = 0;
                let invalidCount = 0;

                // Fallback base voice if missing in backup
                const defaultBaseVoice = AVAILABLE_VOICES[0].id;

                importedData.forEach((item: any) => {
                    // 1. Basic validation
                    if (!item || typeof item !== 'object' || !item.name) {
                        invalidCount++;
                        return;
                    }

                    // 2. ID normalization
                    const id = item.id ? String(item.id) : `custom-import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                    // 3. Duplicate check
                    if (existingIds.has(id)) {
                        duplicateCount++;
                        return;
                    }

                    // 4. Base Voice Validation
                    let baseVoiceId = item.baseVoiceId;
                    if (typeof baseVoiceId !== 'string' || !validPrebuiltIds.has(baseVoiceId)) {
                         baseVoiceId = defaultBaseVoice;
                    }

                    validNewVoices.push({
                        id: id,
                        name: String(item.name),
                        isCustom: true,
                        baseVoiceId: baseVoiceId
                    });
                });

                if (validNewVoices.length === 0) {
                    if (duplicateCount > 0) {
                        setImportStatus({ type: 'error', message: `No new voices added. ${duplicateCount} duplicates skipped.` });
                    } else {
                         setImportStatus({ type: 'error', message: "No valid voices found in file." });
                    }
                    return;
                }

                // Auto-merge
                const mergedVoices = [...customVoices, ...validNewVoices];
                onUpdate(mergedVoices);
                setImportStatus({ 
                    type: 'success', 
                    message: `Success! Added ${validNewVoices.length} voices. (${duplicateCount} duplicates skipped)` 
                });
            }
        } catch (err) {
            console.error("Import failed:", err);
            setImportStatus({ type: 'error', message: "An unexpected error occurred during processing." });
        }
    };

    reader.onerror = () => {
        setImportStatus({ type: 'error', message: "Failed to read the file." });
    };

    reader.readAsText(file);
  };

  const triggerImport = () => {
      setImportStatus(null);
      fileInputRef.current?.click();
  };


  return (
    <Modal title="Custom Voice Library" onClose={onClose}>
      <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 mb-4">
        {customVoices.length === 0 ? (
          <p className="text-gray-400 text-center py-4">You haven't created any custom voices yet.</p>
        ) : (
          customVoices.map(voice => (
            <div key={voice.id} className="flex items-center justify-between bg-gray-700 p-3 rounded-lg transition-colors hover:bg-gray-650">
              {editingVoiceId === voice.id ? (
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="bg-gray-600 border border-gray-500 rounded-md p-2 text-white flex-grow mr-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  autoFocus
                  placeholder="Enter new name"
                />
              ) : (
                <span className="text-white font-medium pl-1 truncate">{voice.name}</span>
              )}

              <div className="flex items-center gap-1">
                {editingVoiceId === voice.id ? (
                  <>
                    <button 
                        onClick={() => handleSaveEdit(voice.id)} 
                        className="p-2 rounded-full hover:bg-green-900/50 text-green-400 transition-colors" 
                        title="Save"
                        type="button"
                    >
                      <SaveIcon className="w-6 h-6" />
                    </button>
                    <button 
                        onClick={handleCancelEdit} 
                        className="p-2 rounded-full hover:bg-gray-600 text-gray-400 transition-colors" 
                        title="Cancel"
                        type="button"
                    >
                      <CloseIcon className="w-6 h-6" />
                    </button>
                  </>
                ) : deletingVoiceId === voice.id ? (
                    <div className="flex items-center gap-2 animate-fade-in">
                        <span className="text-red-300 text-xs font-bold uppercase tracking-wide mr-1">Delete?</span>
                        <button 
                            onClick={() => confirmDelete(voice.id)} 
                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md text-sm font-bold shadow-sm transition-colors"
                            type="button"
                        >
                            Yes
                        </button>
                        <button 
                            onClick={cancelDelete} 
                            className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1.5 rounded-md text-sm shadow-sm transition-colors"
                            type="button"
                        >
                            No
                        </button>
                    </div>
                ) : (
                  <>
                    <button 
                      onClick={() => handlePreview(voice)} 
                      className="p-2 rounded-full hover:bg-gray-600 text-cyan-400 transition-colors" 
                      title="Preview Voice"
                      disabled={previewingId === voice.id}
                      type="button"
                    >
                      {previewingId === voice.id ? <LoadingSpinner className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
                    </button>
                    <button 
                        onClick={() => handleEdit(voice)} 
                        className="p-2 rounded-full hover:bg-gray-600 text-yellow-400 transition-colors" 
                        title="Rename"
                        type="button"
                    >
                      <PencilIcon className="w-6 h-6" />
                    </button>
                    <button 
                        onClick={() => requestDelete(voice.id)} 
                        className="p-2 rounded-full hover:bg-gray-600 text-red-500 transition-colors" 
                        title="Delete"
                        type="button"
                    >
                      <TrashIcon className="w-6 h-6" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="pt-4 border-t border-gray-700">
        <div className="grid grid-cols-2 gap-4">
                <button 
                    onClick={handleExportBackup}
                    disabled={customVoices.length === 0}
                    className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-200 py-3 px-4 rounded-lg transition-colors text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed border border-gray-600"
                >
                    <DownloadIcon className="w-5 h-5" />
                    Backup Library
                </button>
                <button 
                    onClick={triggerImport}
                    className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-lg transition-colors text-sm font-bold shadow-lg shadow-indigo-900/20"
                >
                    <UploadIcon className="w-5 h-5" />
                    Import Backup
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleImportBackup}
                    accept=".json"
                    className="hidden"
                />
        </div>
        
        {importStatus && (
            <div className={`mt-4 p-3 rounded-lg text-sm text-center font-medium animate-fade-in ${
                importStatus.type === 'success' ? 'bg-green-900/40 text-green-200 border border-green-800/50' : 'bg-red-900/40 text-red-200 border border-red-800/50'
            }`}>
                {importStatus.message}
            </div>
        )}

        <p className="text-xs text-gray-500 mt-4 text-center px-2 leading-relaxed">
            Backup files (.json) contain all voice settings and are portable. 
            Original audio files are not required for restoration on other devices.
        </p>
      </div>
      <style>{`
        @keyframes fade-in {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
            animation: fade-in 0.2s ease-out forwards;
        }
      `}</style>
    </Modal>
  );
};

export default VoiceLibraryModal;
