
import type { Voice, TextModel } from './types';

export const AVAILABLE_VOICES: Voice[] = [
  { 
    name: 'Mimas (Male, Meditative)', 
    id: 'Mimas',
    toneDescription: 'Extremely calm, deep, and steady male voice. Perfect for meditation, Dhamma contemplation, and slow-paced wisdom sharing with zero harshness.'
  },
  { 
    name: 'Iapetus (Male, Warm Wisdom)', 
    id: 'Iapetus',
    toneDescription: 'A melodic and mature male voice with natural warmth. Excellent for storytelling with a peaceful soul and compassionate guidance.'
  },
  { 
    name: 'Charon (Male, Deep)', 
    id: 'Charon',
    toneDescription: 'Deep, resonant, and authoritative male voice. Provides a sense of weight and reliability, perfect for serious and profound narrations.'
  },
  { 
    name: 'Enceladus (Male, Smooth)', 
    id: 'Enceladus',
    toneDescription: 'Warm, friendly, and smooth male voice. Very approachable and pleasant for long-form listening and gentle teaching.'
  },
  { 
    name: 'Kore (Female)', 
    id: 'Kore',
    toneDescription: 'Natural, clear, and polite female voice with a neutral tone. High fidelity and versatile for general narration.'
  },
  { 
    name: 'Zephyr (Female, Soft)', 
    id: 'Zephyr',
    toneDescription: 'Soft, gentle, and airy female voice. Ideal for calming content, mindfulness, or spiritual narrations.'
  },
  { 
    name: 'Puck (Male)', 
    id: 'Puck',
    toneDescription: 'Bright, energetic male voice with high vitality. Excellent for lively dialogues and enthusiastic storytelling.'
  },
  { 
    name: 'Fenrir (Male, Raspy)', 
    id: 'Fenrir',
    toneDescription: 'Mature male voice with a slight rasp and unique character. Sounds experienced and sophisticated.'
  },
];

export const DEFAULT_TONE = "";

export const TEXT_MODELS: TextModel[] = [
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Fast)', description: 'Best for simple logic and quick tasks' },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (Smart)', description: 'Best for complex reasoning and creative writing' },
  { id: 'gemini-flash-latest', name: 'Gemini Flash Latest', description: 'Up-to-date version of the Flash model' },
  { id: 'gemini-flash-lite-latest', name: 'Gemini Flash Lite', description: 'Lightweight and extremely fast' },
];

export const EMOTIONS = [
  { value: 'none', label: 'Default / None' },
  { value: 'happily', label: 'Happy' },
  { value: 'cheerfully', label: 'Cheerful' },
  { value: 'calmly', label: 'Calm' },
  { value: 'seriously', label: 'Serious' },
  { value: 'with a very serene, wise tone, reflecting on deep truths with peaceful pauses', label: 'Dhamma: Deep Reflection' },
  { value: 'with profound kindness and compassionate energy, speaking slowly and gently', label: 'Dhamma: Compassionate Guidance' },
  { value: 'in a steady, meditative flow, maintaining perfect equanimity in every word', label: 'Dhamma: Meditative Flow' },
  { value: 'with a soft, airy whisper-like quality to induce deep relaxation and focus', label: 'Dhamma: Peaceful Stillness' },
  { value: 'articulating every syllable clearly and mindfully, like a teacher explaining the path', label: 'Dhamma: Mindful Clarity' },
];

export const SPEEDS = [
  { value: 'slow', label: 'Slow (Best for Dhamma)', adverb: 'slowly' },
  { value: 'slightly_slow', label: 'Comfortable', adverb: 'at a comfortable, relaxed pace' },
  { value: 'normal', label: 'Normal', adverb: '' },
  { value: 'slightly_fast', label: 'Slightly Fast', adverb: 'somewhat quickly' },
];

export const EXAMPLE_SCRIPT = `Narrator: Welcome to this session on the path to inner peace.
Speaker 1: Today, we will explore the concept of Mindfulness, or Sati.
Speaker 2: Is mindfulness just about sitting still?
Speaker 1: Not at all. It is about being fully present in every moment, with a heart full of kindness.
Narrator: Take a deep breath, relax your shoulders, and let the wisdom of the Dhamma wash over you.`;
