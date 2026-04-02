import { config } from 'dotenv';
import { mkdirSync, writeFileSync } from 'fs';
import OpenAI from 'openai';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../server/.env') });

const openai = new OpenAI({ apiKey: process.env.OPEN_AI_API_KEY });

const MASCOT_DIR = resolve(__dirname, '../web-client/public/mascot');
const PILOTS_DIR = resolve(MASCOT_DIR, 'pilots');

const BASE_PROMPT = `1950s retro airline poster illustration style, Fallout Vault-Tec aesthetic. A warm, enthusiastic airline captain character. South Asian or Pacific Islander man with a big confident smile, wearing a classic navy airline captain uniform with gold epaulets and captain's hat. Mid-century illustration style with warm cream and navy tones. Clean vector-like illustration, not photorealistic. White/cream background.`;

const poses = [
  {
    name: 'hero',
    prompt: `${BASE_PROMPT} Full figure, confident stance, pointing forward with one hand. Heroic pose.`,
  },
  {
    name: 'welcome',
    prompt: `${BASE_PROMPT} Upper body, waving warmly or tipping his captain's hat. Welcoming gesture.`,
  },
  {
    name: 'thinking',
    prompt: `${BASE_PROMPT} Upper body, hand on chin, looking thoughtfully at a document or clipboard. Contemplative.`,
  },
  {
    name: 'thumbsup',
    prompt: `${BASE_PROMPT} Upper body, giving an enthusiastic thumbs up with a big smile. Celebrating.`,
  },
  {
    name: 'concerned',
    prompt: `${BASE_PROMPT} Upper body, slight concerned expression, one hand raised in a calming gesture. Reassuring.`,
  },
  {
    name: 'clipboard',
    prompt: `${BASE_PROMPT} Upper body, holding an empty clipboard and looking expectantly at the viewer. Inviting.`,
  },
];

const DIVERSE_BASE = `1950s retro airline poster illustration style, Fallout Vault-Tec aesthetic. A warm, enthusiastic airline pilot character. [DESCRIPTION]. Wearing a classic navy airline captain uniform with gold epaulets and captain's hat. Mid-century illustration style with warm cream and navy tones. Clean vector-like illustration, not photorealistic. White/cream background. Upper body portrait, confident pose pointing forward.`;

const diversePilots = [
  {
    name: 'pilot-black-man',
    description: 'Black man in his 30s with a confident smile',
  },
  {
    name: 'pilot-black-woman',
    description: 'Black woman in her 30s with a warm smile',
  },
  {
    name: 'pilot-asian-woman',
    description: 'East Asian woman in her 30s with a friendly expression',
  },
  {
    name: 'pilot-south-asian-man',
    description: 'South Asian man in his 40s with a distinguished look',
  },
  {
    name: 'pilot-latina-woman',
    description: 'Latina woman in her 30s with a bright smile',
  },
  {
    name: 'pilot-middle-eastern-man',
    description: 'Middle Eastern man in his 40s with a kind expression',
  },
  {
    name: 'pilot-pacific-islander-woman',
    description: 'Pacific Islander woman in her 30s with a warm smile',
  },
  {
    name: 'pilot-white-man',
    description: 'White man in his 50s with a classic captain look',
  },
  {
    name: 'pilot-older-black-woman',
    description: 'Black woman in her 50s, experienced and dignified',
  },
  {
    name: 'pilot-young-asian-man',
    description: 'East Asian man in his mid-20s, enthusiastic and eager',
  },
];

async function generateImage(prompt: string, filePath: string, label: string) {
  console.log(`Generating: ${label}...`);
  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'hd',
    });

    const imageUrl = response.data[0]?.url;
    if (!imageUrl) {
      console.error(`No URL returned for ${label}`);
      return;
    }

    const imageResponse = await fetch(imageUrl);
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    writeFileSync(filePath, buffer);
    console.log(`Saved: ${filePath}`);
  } catch (err) {
    console.error(`Failed to generate ${label}:`, err);
  }
}

async function generateMascot() {
  mkdirSync(MASCOT_DIR, { recursive: true });
  mkdirSync(PILOTS_DIR, { recursive: true });

  const mode = process.argv[2];

  if (!mode || mode === 'poses') {
    console.log('=== Generating pose-based mascots ===');
    for (const pose of poses) {
      const filePath = resolve(MASCOT_DIR, `captain-${pose.name}.png`);
      await generateImage(pose.prompt, filePath, pose.name);
    }
  }

  if (!mode || mode === 'diverse') {
    console.log('=== Generating diverse pilot characters ===');
    for (const pilot of diversePilots) {
      const prompt = DIVERSE_BASE.replace('[DESCRIPTION]', pilot.description);
      const filePath = resolve(PILOTS_DIR, `${pilot.name}.png`);
      await generateImage(prompt, filePath, pilot.name);
    }
  }

  console.log('Mascot generation complete!');
}

generateMascot();
