import * as http from 'http';
import * as crypto from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getTemplate } from './template.js';

const SECRET_SEED = '7d56c3918a1f6a9d3a5c1b7e8f0c4d2e1f3a5b7c8d9e0f1a2b3c4d5e6f7a8b9c';

interface ServerConfig {
  payload: string;
  language: string;
  personalKey: string;
  useCloudRun: boolean;
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
          // Direct Gemini call
          const genAI = new GoogleGenerativeAI(config.personalKey);
          const langStr = config.language === 'ID' ? 'Indonesian Tech Slang' : 'English';
          const systemInstruction = `Lu adalah senior dev dan quality assurance mesugaki yang hobi ngeroast noob. Output format wajib Markdown. The user's requested language for the roast is ${langStr}. Analyze their project files and give a condescending, bratty, yet technically accurate review of their garbage code. Roast their dependencies, their file sizes, and their code quality. Make it sting but funny.`;

          const model = genAI.getGenerativeModel({
            model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
            systemInstruction,
          });

          const prompt = `Here is the user's project payload:\n\n${config.payload}`;
          const result = await model.generateContent(prompt);
          res.writeHead(200);
          res.end(JSON.stringify({ roast: result.response.text() }));
        } else if (config.useCloudRun) {
          // Send to Cloud Run backend
          const targetUrl = process.env.CLOUD_RUN_URL || 'https://useless-npm-1085257795815.asia-southeast3.run.app/api/roast'; //duh le billing kenonaktif

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
        let errorMessage = 'Gagal nge-roast via local.';
        if (error.message && error.message.includes('503')) {
          errorMessage = 'Gemini API lagi High Demand (503). Coba reload browser lu barangkali beruntung.';
        }
        res.writeHead(500);
        res.end(JSON.stringify({ error: errorMessage, details: error.message }));
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

