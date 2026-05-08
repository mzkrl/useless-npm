import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getTemplate } from './template.js';

interface ServerConfig {
  payload: string;
  language: string;
  personalKey: string;
  useCloudRun: boolean;
}

export async function startLocalServer(config: ServerConfig): Promise<number> {
  const port = 6769;

  const app = new Elysia()
    .use(cors())
    .get('/', () => {
      return new Response(getTemplate(), {
        headers: { 'Content-Type': 'text/html' }
      });
    })
    .get('/api/roast', async () => {
      try {
        if (config.personalKey) {
          // Direct Gemini call
          const genAI = new GoogleGenerativeAI(config.personalKey);
          const langStr = config.language === 'ID' ? 'Indonesian Tech Slang' : 'English';
          const systemInstruction = `Lu adalah senior dev mesugaki yang hobi ngeroast noob. Output format wajib Markdown. The user's requested language for the roast is ${langStr}. Analyze their project files and give a condescending, bratty, yet technically accurate review of their garbage code. Roast their dependencies, their file sizes, and their code quality. Make it sting but funny.`;

          const model = genAI.getGenerativeModel({
            model: process.env.GEMINI_MODEL || 'gemini-2.5-pro',
            systemInstruction,
          });

          const prompt = `Here is the user's project payload:\n\n${config.payload}`;
          const result = await model.generateContent(prompt);
          return { roast: result.response.text() };
        } else if (config.useCloudRun) {
          // Send to Cloud Run backend
          const targetUrl = process.env.CLOUD_RUN_URL || 'http://localhost:8080/api/roast'; //duh le billing kenonaktif

          const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              payload: config.payload,
              language: config.language
            }),
          });

          if (!response.ok) {
            try {
              const errorData = await response.json();
              return errorData; // Return the backend error JSON so frontend can show it
            } catch (e) {
              return { error: `Cloud Run returned ${response.status} ${response.statusText}`, details: 'Btw coba direload aja ngab.' };
            }
          }

          const data = await response.json();
          return data;
        } else {
          throw new Error('No valid backend configuration found.');
        }
      } catch (error: any) {
        let errorMessage = 'Gagal nge-roast via local.';
        if (error.message && error.message.includes('503')) {
          errorMessage = 'Gemini API lagi High Demand (503). Coba reload browser lu barangkali beruntung.';
        }
        return { error: errorMessage, details: error.message };
      }
    });

  app.listen(port);
  return port;
}
