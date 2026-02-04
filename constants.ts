
import type { Voice, TextModel } from './types';

export const AVAILABLE_VOICES: Voice[] = [
  { 
    name: 'Kore (Female)', 
    id: 'Kore',
    toneDescription: 'Natural, clear, and polite female voice with a neutral tone. High fidelity and versatile for general narration.'
  },
  { 
    name: 'Puck (Male)', 
    id: 'Puck',
    toneDescription: 'Bright, energetic male voice with high vitality. Excellent for lively dialogues and enthusiastic storytelling.'
  },
  { 
    name: 'Charon (Male, Deep)', 
    id: 'Charon',
    toneDescription: 'Deep, resonant, and authoritative male voice. Provides a sense of weight and reliability, perfect for serious narrations.'
  },
  { 
    name: 'Fenrir (Male, Raspy)', 
    id: 'Fenrir',
    toneDescription: 'Mature male voice with a slight rasp and unique character. Sounds experienced and sophisticated.'
  },
  { 
    name: 'Zephyr (Female, Soft)', 
    id: 'Zephyr',
    toneDescription: 'Soft, gentle, and airy female voice. Ideal for calming content, mindfulness, or spiritual narrations.'
  },
  { 
    name: 'Enceladus (Male)', 
    id: 'Enceladus',
    toneDescription: 'Warm, friendly, and smooth male voice. Very approachable and pleasant for long-form listening.'
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
  { value: 'with a serene, wise tone, articulating every word clearly and peacefully', label: 'Dhamma: Serene & Wise' },
  { value: 'with deep kindness and warmth, speaking gently but engagingly', label: 'Dhamma: Compassionate' },
  { value: 'slowly and mindfully, with a steady, relaxed pace that is very easy to follow', label: 'Dhamma: Mindful & Steady' },
  { value: 'with a light, peaceful energy and gentle clarity to keep the listener engaged', label: 'Dhamma: Gentle Insight' },
  { value: 'patiently and soothingly, like a wise teacher explaining complex truths simply', label: 'Dhamma: Patient Teacher' },
];

export const SPEEDS = [
  { value: 'slow', label: 'Slow', adverb: 'slowly' },
  { value: 'slightly_slow', label: 'Comfortable', adverb: 'at a comfortable, relaxed pace' },
  { value: 'normal', label: 'Normal', adverb: '' },
  { value: 'slightly_fast', label: 'Slightly Fast', adverb: 'somewhat quickly' },
];

export const EXAMPLE_SCRIPT = `Narrator: Welcome to this session on the path to inner peace.
Speaker 1: Today, we will explore the concept of Mindfulness, or Sati.
Speaker 2: Is mindfulness just about sitting still?
Speaker 1: Not at all. It is about being fully present in every moment, with a heart full of kindness.
Narrator: Take a deep breath, relax your shoulders, and let the wisdom of the Dhamma wash over you.`;
