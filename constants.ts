
import type { Voice, TextModel } from './types';

export const AVAILABLE_VOICES: Voice[] = [
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

export const EXAMPLE_SCRIPT = `Struggling with a chaotic mind??? This isn't just ancient wisdom; it's the Buddha's precise, step-by-step path to ending suffering and finding unshakeable inner peace, starting today.
Hello and welcome.
Today we're diving into the Buddhist path to inner peace.
But I want you to think of this less as a religion
and more like a practical training manual for your own mind.
It's a step-by-step guide for cultivating a real lasting sense of well-being.
So let's get started.
You know,
it's a question I think a lot of us ask ourselves.
In a world that just feels so chaotic sometimes.
How do we actually find a stable center?
Well, this ancient path scribed in the Tripitaka or the Pali Canon
offers a surprisingly clear step-by-step approach.
And it all begins by looking directly at a fundamental truth of our experience.
This quote really gets to the heart of it.
The whole path starts with one core observation.
Life involves suffering.
And look,
we're not just talking about big, major tragedies.
It's also that subtle background noise of dissatisfaction,
the stress that comes from just wanting things to be different than they are.
The moment we can acknowledge this reality,
we can actually start to do something about it.
So, where do we even begin?
You might think it starts with some complex meditation, right?
But nope,
it's actually something way more fundamental.
Before we can even begin to train the mind,
we need to build a stable, solid foundation for it to rest on.
And that starts with giving and morality.
The very first step is Dana, which means generosity.
Dana or giving is considered the easiest way to condition the mind.
It requires little time and effort,
resulting in a refined, clear, and light mind,
achieving a certain level of ease.
True giving is giving with sincere goodwill to the recipient,
without expecting anything in return,
either directly or indirectly,
from the recipient or from others.
The purer the giving, the greater the results.`;
