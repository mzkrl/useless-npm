import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as crypto from 'crypto';

const port = process.env.PORT || 8080;
const VIBE_CHECK_SECRET_SEED = 'vibe-check-super-secret-seed-12345';
const API_KEY = process.env.GEMINI_API_KEY || '';
const RATE_LIMIT_PER_IP = 7; // Max requests per IP per day

if (!API_KEY) {
  console.warn('WARNING: GEMINI_API_KEY environment variable is not set.');
}

const genAI = new GoogleGenerativeAI(API_KEY);

// --- In-memory Rate Limiter ---
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function getClientIp(headers: Record<string, string | undefined>): string {
  return headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetAt) {
    // New window: reset at next midnight UTC
    const tomorrow = new Date();
    tomorrow.setUTCHours(24, 0, 0, 0);
    rateLimitStore.set(ip, { count: 1, resetAt: tomorrow.getTime() });
    return { allowed: true, remaining: RATE_LIMIT_PER_IP - 1 };
  }

  if (entry.count >= RATE_LIMIT_PER_IP) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_PER_IP - entry.count };
}

// Periodically clean up expired entries (every 1 hour)
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(ip);
  }
}, 60 * 60 * 1000);

// --- App ---
const app = new Elysia()
  .use(cors())
  .get('/', () => {
    return 'Backend is running.\n\nInstall the CLI to roast your code:\nnpm i -g @jdze/vibe-check';
  })
  .onBeforeHandle(({ request, headers, body, set }) => {
    // Bypass auth for CORS preflight and GET routes (like /)
    if (request.method === 'OPTIONS' || request.method === 'GET') return;

    // Validate HMAC Signature
    const timestamp = headers['x-vibe-timestamp'];
    const signature = headers['x-vibe-signature'];

    if (!timestamp || !signature) {
      set.status = 401;
      return {
        error: '🚫 Akses Ditolak',
        details: 'Request lu gak punya header autentikasi yang valid. Pastiin lu pake CLI resmi (@jdze/vibe-check) buat nge-roast, jangan asal nembak endpoint ya ngab.'
      };
    }

    const now = Date.now();
    const requestTime = parseInt(timestamp, 10);

    if (isNaN(requestTime)) {
      set.status = 400;
      return {
        error: '⏱️ Timestamp Gak Valid',
        details: 'Format timestamp request lu aneh. Coba update CLI lu ke versi terbaru: npm i -g @jdze/vibe-check@latest'
      };
    }

    const timeDiff = Math.abs(now - requestTime);

    if (timeDiff > 300000) {
      set.status = 403;
      return {
        error: '⌛ Request Kedaluwarsa',
        details: 'Request lu udah expired (lebih dari 5 menit). Coba jalanin ulang vibe-check dari awal.'
      };
    }

    const bodyPayload = JSON.stringify(body);
    const hmac = crypto.createHmac('sha256', VIBE_CHECK_SECRET_SEED);
    hmac.update(`${timestamp}:${bodyPayload}`);
    const expectedSignature = hmac.digest('hex');

    if (signature.length !== expectedSignature.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      set.status = 403;
      return {
        error: '🔐 Signature Gak Cocok',
        details: 'Tanda tangan digital request lu gak valid. Kemungkinan lu pake versi CLI yang outdated atau ada yang modif requestnya. Update CLI: npm i -g @jdze/vibe-check@latest'
      };
    }
  })
  .post(
    '/api/roast',
    async ({ request, body, set }) => {
      // --- Rate Limit Check ---
      const ip = getClientIp(request.headers as any);
      const { allowed, remaining } = checkRateLimit(ip);

      if (!allowed) {
        set.status = 429;
        return {
          error: '🛑 Jatah Roasting Habis!',
          details: `IP lu udah pake ${RATE_LIMIT_PER_IP}x jatah roasting gratis hari ini. Kuota di-reset tiap tengah malam UTC. Kalo mau unlimited, pake API Key Gemini lu sendiri (pilih opsi BYOK di CLI).`
        };
      }

      try {
        const { payload, language } = body;

        const langStr = language === 'ID' ? 'Indonesian Tech Slang' : 'English';

        const systemInstruction = `Lu adalah senior dev mesugaki yang hobi ngeroast noob. Output format wajib Markdown. The user's requested language for the roast is ${langStr}. Analyze their project files and give a condescending, bratty, yet technically accurate review of their garbage code. Roast their dependencies, their file sizes, and their code quality. Make it sting but funny.`;

        const model = genAI.getGenerativeModel({
          model: process.env.GEMINI_MODEL || 'gemini-3-flash-preview',
          systemInstruction,
        });

        const prompt = `Here is the user's project payload:\n\n${payload}`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        return { roast: text, remaining };
      } catch (error: any) {
        const msg = error.message || '';
        set.status = 500;

        if (msg.includes('503')) {
          return {
            error: '🔥 Gemini Lagi Overload (503)',
            details: 'Server AI-nya lagi kewalahan nampung request. Ini bukan salah lu (untuk sekali ini). Coba reload browser lu, biasanya nanti dapet giliran.'
          };
        }

        if (msg.includes('429') || msg.includes('quota') || msg.includes('rate')) {
          return {
            error: '📊 Kuota API Gemini Habis',
            details: 'Jatah API Gemini server udah mentok hari ini. Coba lagi besok, atau pake API Key lu sendiri biar gak ngantri (pilih opsi BYOK di CLI).'
          };
        }

        if (msg.includes('400') || msg.includes('INVALID_ARGUMENT')) {
          return {
            error: '📦 Project Lu Kegedean',
            details: 'Payload project lu kegedean buat diproses Gemini. Coba kurangin jumlah file atau pake API Key sendiri yang limitnya lebih gede.'
          };
        }

        return {
          error: '💀 Yahh, Ada yang Error',
          details: 'Gemini-nya lagi ngambek atau ada masalah internal. Coba lagi nanti, atau pake API Key lu sendiri biar lebih stabil.'
        };
      }
    },
    {
      body: t.Object({
        payload: t.String(),
        language: t.String(),
      }),
    }
  )
  .listen(port);

console.log(`🦊 Cloud Run backend is running at ${app.server?.hostname}:${app.server?.port}`);
