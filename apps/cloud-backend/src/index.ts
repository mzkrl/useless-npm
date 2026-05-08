import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { GoogleGenerativeAI } from '@google/generative-ai';

const port = process.env.PORT || 8080;
const API_KEY = process.env.GEMINI_API_KEY || '';

if (!API_KEY) {
  console.warn('WARNING: GEMINI_API_KEY environment variable is not set.');
}

const genAI = new GoogleGenerativeAI(API_KEY);

const app = new Elysia()
  .use(cors())
  .post(
    '/api/roast',
    async ({ body, set }) => {
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

        return { roast: text };
      } catch (error: any) {
        set.status = 500;
        let errorMessage = 'Gagal nge-roast, Gemini-nya lagi ngambek atau kuota API habis.';
        if (error.message && error.message.includes('503')) {
          errorMessage = 'Gemini API lagi High Demand (503). Coba reload browser lu barangkali beruntung.';
        }
        return { error: errorMessage, details: error.message };
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
