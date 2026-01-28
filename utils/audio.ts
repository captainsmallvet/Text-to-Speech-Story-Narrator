
// Function to create silent audio data of a specific length (in bytes)
// To save memory, we can return a small zero-filled buffer and repeat it in the Blob construction if needed, 
// but for exact byte alignment in PCM, we create specific chunks.
export const createSilentAudio = (byteLength: number): Uint8Array => {
  return new Uint8Array(byteLength);
};

// Base64 decoding function (kept for legacy support if needed, but primary flow is now binary)
export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

let currentAudioElement: HTMLAudioElement | null = null;
let onPlaybackStateChange: ((isPlaying: boolean) => void) | null = null;
let audioCtx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;

// Fix: Added to support audio visualization
export const getAnalyser = () => analyser;

export const setOnPlaybackStateChange = (callback: (isPlaying: boolean) => void) => {
    onPlaybackStateChange = callback;
};

const updatePlaybackState = (isPlaying: boolean) => {
    if (onPlaybackStateChange) {
        onPlaybackStateChange(isPlaying);
    }
};

export const playAudio = async (audioData: Blob | string, options: { volume?: number, speed?: number } = {}): Promise<void> => {
  try {
    stopAudio(); // Stop any existing playback

    let audioUrl: string;
    if (typeof audioData === 'string') {
        // Fallback for legacy base64 strings (small files)
        audioUrl = `data:audio/wav;base64,${audioData}`;
    } else {
        // Create an Object URL for the Blob (efficient for large files)
        audioUrl = URL.createObjectURL(audioData);
    }

    const audio = new Audio(audioUrl);
    const { volume = 1.0, speed = 1.0 } = options;
    
    // Fix: Setup AudioContext and Analyser for visualizer support
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.connect(audioCtx.destination);
    }

    if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }

    const source = audioCtx.createMediaElementSource(audio);
    source.connect(analyser);

    audio.volume = Math.max(0, Math.min(1, volume));
    audio.playbackRate = speed;

    audio.onended = () => {
        updatePlaybackState(false);
        if (typeof audioData !== 'string') {
            URL.revokeObjectURL(audioUrl); // Cleanup
        }
        currentAudioElement = null;
    };

    audio.onerror = (e) => {
        console.error("Audio playback error:", e);
        updatePlaybackState(false);
        alert("Failed to play audio. The file might be corrupted or too large.");
    };

    currentAudioElement = audio;
    await audio.play();
    updatePlaybackState(true);

  } catch (error) {
    console.error("Failed to play audio:", error);
    updatePlaybackState(false);
  }
};

export const stopAudio = (): void => {
    if (currentAudioElement) {
        currentAudioElement.pause();
        currentAudioElement.currentTime = 0;
        currentAudioElement = null;
        updatePlaybackState(false);
    }
};

export const downloadAudio = (audioData: Blob | string, filename: string): void => {
  let blob: Blob;
  if (typeof audioData === 'string') {
      const byteCharacters = atob(audioData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      // Assume raw PCM if string, wrap in wav. If it's already wav base64, this might double header, 
      // but in our app flow strings are usually raw PCM from legacy functions.
      // However, to be safe with the new flow, we prefer Blobs.
      blob = createWavBlob([byteArray]); 
  } else {
      blob = audioData;
  }
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.wav`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Helper to create a WAV Blob from an array of PCM chunks
// This avoids creating a single massive Uint8Array in memory.
export const createWavBlob = (pcmChunks: Uint8Array[], sampleRate: number = 24000): Blob => {
    const numChannels = 1;
    const bitsPerSample = 16;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const byteRate = sampleRate * blockAlign;
    
    // Calculate total data size
    const dataSize = pcmChunks.reduce((acc, chunk) => acc + chunk.length, 0);
    
    const headerBuffer = new ArrayBuffer(44);
    const view = new DataView(headerBuffer);

    // RIFF header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');

    // fmt chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);

    // data chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Return a Blob constructed from the header and the raw PCM chunks.
    // This effectively concatenates them without using contiguous RAM.
    return new Blob([headerBuffer, ...pcmChunks], { type: 'audio/wav' });
};

const writeString = (view: DataView, offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
};
