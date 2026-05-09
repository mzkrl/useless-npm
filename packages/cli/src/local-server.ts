import * as http from 'http';
import * as crypto from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getTemplate } from './template.js';

const SECRET_SEED = process.env.SECRET_SEED || '7d56c3918a1f6a9d3a5c1b7e8f0c4d2e1f3a5b7c8d9e0f1a2b3c4d5e6f7a8b9c';

// --- Gemini Rate Limit Constants ---
// Free tier: 5 RPM, 250K TPM | Tier 1: 995 RPM, 1.75M TPM
const SAFE_CHUNK_TOKENS = 180_000;   // Leave margin under 250K free tier TPM
const FREE_TIER_DELAY_MS = 13_000;   // 13s between chunks (60s / 5 RPM = 12s min)

interface ServerConfig {
  payload: string;
  language: string;
  personalKey: string;
  useCloudRun: boolean;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function splitPayloadIntoChunks(payload: string, maxTokensPerChunk: number): string[] {
  // Split by file boundaries (--- filepath ---)
  const fileBlocks = payload.split(/\n(?=--- )/);
  const chunks: string[] = [];
  let currentChunk = '';
  let currentTokens = 0;

  for (const block of fileBlocks) {
    const blockTokens = estimateTokens(block);

    // If single file exceeds chunk limit, include it alone (will be truncated by Gemini)
    if (blockTokens > maxTokensPerChunk) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
        currentTokens = 0;
      }
      chunks.push(block);
      continue;
    }

    if (currentTokens + blockTokens > maxTokensPerChunk && currentChunk) {
      chunks.push(currentChunk);
      currentChunk = block;
      currentTokens = blockTokens;
    } else {
      currentChunk += (currentChunk ? '\n' : '') + block;
      currentTokens += blockTokens;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

async function detectTier(genAI: GoogleGenerativeAI, modelName: string): Promise<'free' | 'paid'> {
  // Try a tiny request — if the API responds quickly without 429, likely paid tier
  // This is a heuristic, not a guarantee
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent('Say "ok" in one word.');
    if (result.response.text()) return 'paid';
  } catch (e: any) {
    const msg = e.message || '';
    if (msg.includes('429') || msg.includes('quota')) return 'free';
  }
  return 'free'; // Default to free tier (safer, slower but works)
}

async function roastWithChunking(
  genAI: GoogleGenerativeAI,
  modelName: string,
  systemInstruction: string,
  payload: string,
  language: string,
): Promise<string> {
  const totalTokens = estimateTokens(payload);
  const isId = language === 'ID';

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction,
  });

  // --- Small payload: single request ---
  if (totalTokens <= SAFE_CHUNK_TOKENS) {
    console.log(`  📤 Single request (${totalTokens.toLocaleString()} tokens)`);
    const result = await model.generateContent(`Here is the user's project payload:\n\n${payload}`);
    return result.response.text();
  }

  // --- Large payload: chunked requests ---
  const chunks = splitPayloadIntoChunks(payload, SAFE_CHUNK_TOKENS);
  console.log(`  🔀 Chunking payload: ${totalTokens.toLocaleString()} tokens → ${chunks.length} chunks`);

  // Detect tier for delay calculation
  console.log(`  🔍 Detecting Gemini tier...`);
  const tier = await detectTier(genAI, modelName);
  const delayMs = tier === 'free' ? FREE_TIER_DELAY_MS : 1000; // Paid tier: minimal delay
  console.log(`  ${tier === 'free' ? '🆓 Free tier' : '💎 Paid tier'} detected → ${delayMs / 1000}s delay between chunks`);

  const partialReviews: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunkTokens = estimateTokens(chunks[i]);
    console.log(`  📤 Sending chunk ${i + 1}/${chunks.length} (~${chunkTokens.toLocaleString()} tokens)...`);

    const chunkInstruction = chunks.length > 1
      ? `[PART ${i + 1} OF ${chunks.length}] ${isId
        ? 'Ini sebagian dari project. Roast bagian ini aja dulu, nanti hasilnya digabung.'
        : 'This is a partial project. Roast this portion, results will be combined later.'}`
      : '';

    const prompt = `${chunkInstruction}\n\nHere is the project payload:\n\n${chunks[i]}`;
    const result = await model.generateContent(prompt);
    partialReviews.push(result.response.text());
    console.log(`  ✅ Chunk ${i + 1}/${chunks.length} done`);

    // Wait between chunks (except after the last one)
    if (i < chunks.length - 1) {
      console.log(`  ⏳ Waiting ${delayMs / 1000}s (rate limit cooldown)...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // --- Combine partial reviews ---
  if (partialReviews.length === 1) {
    return partialReviews[0];
  }

  console.log(`  🧩 Combining ${partialReviews.length} partial reviews...`);
  const combinePrompt = isId
    ? `Gabungin review-review parsial ini jadi satu review komprehensif yang koheren. Jangan ulangi poin yang sama. Tetap pake gaya mesugaki roasting:\n\n${partialReviews.map((r, i) => `--- Review Part ${i + 1} ---\n${r}`).join('\n\n')}`
    : `Combine these partial reviews into one comprehensive, coherent review. Don't repeat the same points. Keep the mesugaki roasting style:\n\n${partialReviews.map((r, i) => `--- Review Part ${i + 1} ---\n${r}`).join('\n\n')}`;

  const combineResult = await model.generateContent(combinePrompt);
  console.log(`  ✅ Combined review ready!`);
  return combineResult.response.text();
}

export async function startLocalServer(config: ServerConfig): Promise<number> {
  const port = 6769;

  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(getTemplate());
      return;
    }

    if (req.method === 'GET' && req.url === '/api/roast') {
      res.setHeader('Content-Type', 'application/json');
      try {
        if (config.personalKey) {
          // --- BYOK Mode: Smart Chunking ---
          const genAI = new GoogleGenerativeAI(config.personalKey);
          const langStr = config.language === 'ID' ? 'Indonesian Tech Slang' : 'English';
          const systemInstruction = `Lu adalah senior dev dan quality assurance mesugaki yang hobi ngeroast noob. Output format wajib Markdown. The user's requested language for the roast is ${langStr}. Analyze their project files and give a condescending, bratty, yet technically accurate review of their garbage code. Roast their dependencies, their file sizes, and their code quality. Make it sting but funny.`;

          const modelName = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
          const roast = await roastWithChunking(genAI, modelName, systemInstruction, config.payload, config.language);

          res.writeHead(200);
          res.end(JSON.stringify({ roast }));
        } else if (config.useCloudRun) {
          // --- Cloud Run Mode (unchanged) ---
          const targetUrl = process.env.CLOUD_RUN_URL || 'https://useless-npm-1085257795815.asia-southeast3.run.app/api/roast';

          const timestamp = Date.now().toString();
          const bodyPayload = JSON.stringify({
            payload: config.payload,
            language: config.language
          });

          const hmac = crypto.createHmac('sha256', SECRET_SEED);
          hmac.update(`${timestamp}:${bodyPayload}`);
          const signature = hmac.digest('hex');

          const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-vibe-timestamp': timestamp,
              'x-vibe-signature': signature
            },
            body: bodyPayload,
          });

          if (!response.ok) {
            try {
              const errorData = await response.json();
              res.writeHead(response.status);
              res.end(JSON.stringify(errorData));
            } catch (e) {
              res.writeHead(response.status);
              res.end(JSON.stringify({ error: `Cloud Run returned ${response.status} ${response.statusText}`, details: 'Btw coba direload aja ngab.' }));
            }
            return;
          }

          const data = await response.json();
          res.writeHead(200);
          res.end(JSON.stringify(data));
        } else {
          throw new Error('No valid backend configuration found.');
        }
      } catch (error: any) {
        const msg = error.message || '';
        const isId = config.language !== 'EN';
        let errObj: { error: string; details: string };

        if (msg.includes('503')) {
          errObj = {
            error: isId ? '🔥 Gemini Lagi Overload (503)' : '🔥 Gemini Overloaded (503)',
            details: isId
              ? 'Server AI-nya lagi kewalahan. Coba reload browser lu.'
              : 'The AI server is overwhelmed. Try reloading your browser.'
          };
        } else if (msg.includes('429') || msg.includes('quota') || msg.includes('rate')) {
          errObj = {
            error: isId ? '📊 Kuota API Gemini Habis' : '📊 Gemini API Quota Exceeded',
            details: isId
              ? 'Jatah API Gemini lu udah mentok. Coba lagi nanti atau upgrade plan Gemini lu.'
              : 'Your Gemini API quota is maxed out. Try again later or upgrade your Gemini plan.'
          };
        } else if (msg.includes('400') || msg.includes('INVALID_ARGUMENT')) {
          errObj = {
            error: isId ? '📦 Payload Error' : '📦 Payload Error',
            details: isId
              ? 'Ada masalah sama payload yang dikirim. Coba kurangin jumlah file di project lu.'
              : 'There was an issue with the payload. Try reducing the number of files in your project.'
          };
        } else {
          errObj = {
            error: isId ? '💀 Yahh, Ada yang Error' : '💀 Oops, Something Broke',
            details: isId
              ? 'Ada masalah internal. Coba lagi nanti.'
              : 'An internal error occurred. Try again later.'
          };
        }

        console.error(`  ❌ Error: ${msg}`);
        res.writeHead(500);
        res.end(JSON.stringify(errObj));
      }
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve(port);
    });
  });
}
