import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as crypto from 'crypto';

const port = process.env.PORT || 8080;
const SECRET_SEED = process.env.SECRET_SEED || 'pisangnanasalpukatdurenapelpepayaanggursemangka';  //cuekin, dumb filter
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

// --- Shared Gemini Roast Logic ---
async function generateRoast(payload: string, language: string): Promise<{ roast: string }> {
  const langStr = language === 'ID' ? 'Indonesian Tech Slang' : 'English';

  const systemInstruction = `Lu adalah senior dev dan quality assurance bersifat mesugaki yang hobi ngeroast noob. Output format wajib Markdown. Tidak boleh roast masalah versi, karena model kamu cutoff 2024 (tidak relevan). The user's requested language for the roast is ${langStr}. Analyze their project files and give a condescending, bratty, yet technically accurate review of their garbage code. Roast their dependencies, their file sizes, and their code quality. Make it sting but funny.`;

  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
    systemInstruction,
  });

  const prompt = `Here is the user's project payload:\n\n${payload}`;
  const result = await model.generateContent(prompt);
  return { roast: result.response.text() };
}

function handleGeminiError(error: any, isId: boolean): { error: string; details: string } {
  const msg = error.message || '';

  if (msg.includes('503')) {
    return {
      error: isId ? '🔥 Gemini Lagi Overload (503)' : '🔥 Gemini Overloaded (503)',
      details: isId
        ? 'Server AI-nya lagi kewalahan nampung request. Ini bukan salah lu (untuk sekali ini). Coba reload browser lu, biasanya nanti dapet giliran.'
        : 'The AI server is overwhelmed with requests. Not your fault (for once). Try reloading your browser, you might get lucky.'
    };
  }

  if (msg.includes('429') || msg.includes('quota') || msg.includes('rate')) {
    return {
      error: isId ? '📊 Kuota API Gemini Habis' : '📊 Gemini API Quota Exceeded',
      details: isId
        ? 'Jatah API Gemini server udah mentok hari ini. Coba lagi besok, atau pake API Key lu sendiri biar gak ngantri (pilih opsi BYOK di CLI).'
        : 'The server\'s Gemini API quota is maxed out today. Try again tomorrow, or use your own API Key to skip the queue (select BYOK in CLI).'
    };
  }

  if (msg.includes('400') || msg.includes('INVALID_ARGUMENT')) {
    return {
      error: isId ? '📦 Kode Lu Kegedean' : '📦 Code Too Large',
      details: isId
        ? 'Kode yang lu paste kegedean buat diproses Gemini. Coba kurangin jumlah kode lu.'
        : 'The code you pasted is too large for Gemini to process. Try reducing the amount of code.'
    };
  }

  return {
    error: isId ? '💀 Yahh, Ada yang Error' : '💀 Oops, Something Broke',
    details: isId
      ? 'Gemini-nya lagi ngambek atau ada masalah internal. Coba lagi nanti.'
      : 'Gemini is throwing a tantrum or there\'s an internal issue. Try again later.'
  };
}

// --- Landing Page HTML ---
function getLandingPageHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vibe Check — Roast Your Code</title>
    <meta name="description" content="Paste your garbage code and let our smug AI senior dev roast it. Available as a CLI tool or right here in your browser.">
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>😂</text></svg>">
    <link href="https://fonts.googleapis.com/css?family=Press+Start+2P" rel="stylesheet">
    <link href="https://unpkg.com/nes.css@2.3.0/css/nes.min.css" rel="stylesheet" />
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <style>
        * { box-sizing: border-box; }
        body {
            background-color: #212529;
            color: #fff;
            font-family: 'Press Start 2P', cursive;
            padding: 1.5rem;
            min-height: 100vh;
            font-size: 12px;
        }
        .container { max-width: 900px; margin: 0 auto; }

        /* NES overrides for dark theme */
        .nes-container { background-color: #212529; color: #fff; border-color: #fff; }
        .nes-container.with-title > .title { background-color: #212529; color: #fff; }
        .nes-textarea { background-color: #000; color: #2a9d8f; border-color: #fff; font-family: monospace; font-size: 13px; resize: vertical; }
        .nes-select select { background-color: #000; color: #fff; font-family: 'Press Start 2P', cursive; font-size: 10px; }

        /* Header */
        .header { text-align: center; margin-bottom: 2rem; }
        .header h1 { color: #e76f51; font-size: 24px; margin-bottom: 1rem; line-height: 1.6; }
        .header .tagline { color: #e9c46a; font-size: 10px; line-height: 2; margin-bottom: 1.5rem; }

        /* Install box */
        .install-box {
            background: #000; border: 4px solid #e76f51; padding: 1rem;
            text-align: center; margin: 1.5rem 0; cursor: pointer;
            transition: border-color 0.2s;
        }
        .install-box:hover { border-color: #e9c46a; }
        .install-box code { color: #2a9d8f; font-size: 14px; }
        .install-box small { display: block; margin-top: 0.5rem; color: #666; font-size: 8px; }

        /* Form */
        .form-row { display: flex; gap: 1rem; align-items: flex-end; margin: 1rem 0; flex-wrap: wrap; }
        .form-row .nes-select { flex: 1; min-width: 150px; }
        .form-row .nes-btn { white-space: nowrap; }

        /* File Upload Zone */
        .upload-label {
            display: block; border: 4px dashed #555; padding: 1.5rem 1rem; text-align: center;
            margin: 1rem 0; cursor: pointer; transition: border-color 0.2s, background-color 0.2s;
            color: #888; font-size: 10px; line-height: 2;
        }
        .upload-label:hover, .upload-label.drag-over { border-color: #e9c46a; background-color: rgba(233, 196, 106, 0.05); }
        #file-input { display: none; }
        .file-list { text-align: left; margin-top: 0.5rem; }
        .file-item { display: flex; justify-content: space-between; align-items: center; padding: 0.3rem 0.5rem; margin: 0.2rem 0; background: #000; font-size: 9px; }
        .file-item .remove-btn { color: #e76f51; cursor: pointer; background: none; border: none; font-family: inherit; font-size: 10px; }

        /* Size Counter */
        .size-counter { text-align: right; font-size: 9px; margin-top: 0.5rem; color: #888; }
        .size-counter.warn { color: #e9c46a; }
        .size-counter.over { color: #e76f51; }

        /* Divider */
        .divider { text-align: center; color: #666; margin: 2rem 0; font-size: 10px; }

        /* Output */
        .roast-content { line-height: 1.8; font-size: 13px; }
        .roast-content h1, .roast-content h2, .roast-content h3 { color: #e76f51; margin-top: 2rem; margin-bottom: 1rem; }
        .roast-content p { margin-bottom: 1rem; }
        .roast-content code { background-color: #000; padding: 0.2rem 0.4rem; border-radius: 4px; color: #2a9d8f; }
        .roast-content pre { background-color: #000; padding: 1rem; border: 4px solid #fff; overflow-x: auto; margin-bottom: 1rem; }
        .roast-content pre code { background-color: transparent; color: #e9c46a; padding: 0; }
        .roast-content ul, .roast-content ol { margin-bottom: 1rem; padding-left: 1.5rem; }
        .roast-content li { margin-bottom: 0.5rem; }

        /* Loading */
        #loading { display: none; text-align: center; margin: 2rem 0; color: #e9c46a; }
        #loading-text { animation: bounce 2s ease-in-out infinite; }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        #loading .nes-progress { animation: dimPulse 2.5s ease-in-out infinite; margin-top: 1rem; }
        @keyframes dimPulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }

        /* Avatar */
        .avatar { display: none; align-items: center; gap: 20px; margin-bottom: 20px; }
        .nes-balloon { flex: 1; background-color: #212529; color: #fff; border-color: #fff; }
        .nes-balloon.from-left::before { border-right-color: #fff; }

        /* Footer */
        .footer { text-align: center; margin-top: 3rem; color: #666; font-size: 8px; line-height: 2.5; }
        .footer a { color: #e9c46a; text-decoration: none; }
        .footer a:hover { color: #e76f51; }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>🤑 Vibe Check CLI</h1>
            <p class="tagline">Senior dev AI yang hobi ngeroast kode sampah lu.<br>Smug. Bratty. Technically accurate.</p>
        </div>

        <!-- Install CTA -->
        <div class="install-box" onclick="navigator.clipboard.writeText('npm i -g @jdze/vibe-check').then(()=>{this.querySelector('small').textContent='✅ Copied!'})">
            <code>npm i -g @jdze/vibe-check</code>
            <small>📋 click to copy</small>
        </div>

        <!-- Divider -->
        <div class="divider">─── ✦ atau mau langsung roast di sini? ✦ ───</div>

        <!-- Web Roast Form -->
        <div class="nes-container with-title is-dark">
            <p class="title">Web Roast Preview</p>
            <p style="font-size: 10px; color: #e9c46a; margin-bottom: 1rem; line-height: 2;">
                Males buka terminal? Sini paste kode sampah lu, biar gw roast langsung di sini. 😏
            </p>
            <textarea class="nes-textarea" id="code-input" rows="8" placeholder="// Paste kode sampah lu di sini...&#10;// Atau upload file di bawah ↓" oninput="updateSizeCounter()"></textarea>

            <!-- File Upload -->
            <input type="file" id="file-input" multiple onchange="onFileSelected(this.files)" />
            <label for="file-input" class="upload-label" id="upload-zone"
                ondragover="event.preventDefault(); this.classList.add('drag-over');"
                ondragenter="event.preventDefault();"
                ondragleave="this.classList.remove('drag-over');"
                ondrop="event.preventDefault(); this.classList.remove('drag-over'); onFileSelected(event.dataTransfer.files);">
                📁 Drag & drop file / klik buat upload<br>
                <small style="color: #555;">JS, TS, Python, Go, Rust, Java, etc.</small>
            </label>
            <div class="file-list" id="file-list"></div>

            <!-- Size Counter -->
            <div class="size-counter" id="size-counter">0 / 100 KB</div>

            <div class="form-row">
                <div class="nes-select is-dark">
                    <select id="lang-select">
                        <option value="ID">🇮🇩 Indonesian Slang</option>
                        <option value="EN">🇺🇸 English</option>
                    </select>
                </div>
                <button type="button" class="nes-btn is-error" id="roast-btn" onclick="submitRoast()">
                    🔥 Roast Me!
                </button>
            </div>
        </div>

        <!-- Loading -->
        <div id="loading">
            <p id="loading-text">Scanning your garbage...</p>
            <progress class="nes-progress is-warning" value="30" max="100" id="loading-bar"></progress>
        </div>

        <!-- Result -->
        <div id="result-section" style="display: none;">
            <div class="avatar" id="header-avatar">
                <i class="nes-octocat animate"></i>
                <div class="nes-balloon from-left">
                    <p>Nih gw udah periksa kode lu yang ampas itu...</p>
                </div>
            </div>
            <div class="nes-container with-title is-dark">
                <p class="title">Roast Result</p>
                <div id="roast-output" class="roast-content"></div>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p>Built with 💀 by <a href="https://github.com/mzkrl" target="_blank">@mzkrl</a></p>
            <p>Full roast experience? Use the CLI → <code style="color: #2a9d8f;">npx @jdze/vibe-check</code></p>
        </div>
    </div>

    <script>
        var loadingMessages = [
            "Scanning your garbage...",
            "Reading your spaghetti code... 🍝",
            "Counting your sins... and your unused imports.",
            "Judging your variable names... yikes.",
            "Consulting the ancient scrolls of Stack Overflow...",
            "Your code is so bad, my AI needs therapy after this. 💀",
            "Warming up the roast... medium rare or well done?",
            "Checking if 'it works on my machine' is valid... it's not.",
            "Loading insults database... 99% full.",
            "Fetching the burn unit... they're gonna need it. 🔥",
            "AI-nya lagi mikir kenapa lu bikin kode kayak gini...",
            "Even GitHub Copilot refused to autocomplete this. 💀",
            "Gemini is questioning its existence after reading this...",
        ];

        var msgIndex = 0;
        var progressVal = 10;
        var msgInterval = null;
        var MAX_PAYLOAD_KB = 100;
        var MAX_PAYLOAD_BYTES = MAX_PAYLOAD_KB * 1024;
        var uploadedFiles = {};

        function startLoadingAnimation() {
            var loadingEl = document.getElementById('loading-text');
            var loadingBar = document.getElementById('loading-bar');
            loadingEl.style.transition = 'opacity 0.3s ease';
            progressVal = 10;
            loadingBar.value = progressVal;
            msgInterval = setInterval(function() {
                msgIndex = (msgIndex + 1) % loadingMessages.length;
                loadingEl.style.opacity = '0';
                setTimeout(function() {
                    loadingEl.textContent = loadingMessages[msgIndex];
                    loadingEl.style.opacity = '1';
                }, 300);
                if (progressVal < 90) {
                    progressVal += Math.random() * 8 + 2;
                    if (progressVal > 90) progressVal = 90;
                    loadingBar.value = Math.floor(progressVal);
                }
            }, 3000);
        }

        function stopLoadingAnimation() {
            if (msgInterval) { clearInterval(msgInterval); msgInterval = null; }
        }

        function onFileSelected(files) {
            for (var i = 0; i < files.length; i++) {
                var file = files[i];
                if (file.size > MAX_PAYLOAD_BYTES) continue;
                (function(f) {
                    var reader = new FileReader();
                    reader.onload = function(e) {
                        uploadedFiles[f.name] = e.target.result;
                        renderFileList();
                        updateSizeCounter();
                    };
                    reader.readAsText(f);
                })(file);
            }
        }

        function removeFile(name) {
            delete uploadedFiles[name];
            renderFileList();
            updateSizeCounter();
        }

        function renderFileList() {
            var list = document.getElementById('file-list');
            var names = Object.keys(uploadedFiles);
            if (names.length === 0) { list.innerHTML = ''; return; }
            var html = '';
            for (var i = 0; i < names.length; i++) {
                var n = names[i];
                var kb = (uploadedFiles[n].length / 1024).toFixed(1);
                html += '<div class="file-item"><span>📄 ' + n + ' (' + kb + ' KB)</span>';
                html += '<button class="remove-btn" onclick="removeFile(this.dataset.name)" data-name="' + n.replace(/"/g, '&quot;') + '">✕</button></div>';
            }
            list.innerHTML = html;
        }

        function getTotalPayload() {
            var paste = document.getElementById('code-input').value;
            var combined = '';
            if (paste.trim()) combined += '--- pasted code ---\\n' + paste + '\\n';
            var names = Object.keys(uploadedFiles);
            for (var i = 0; i < names.length; i++) {
                combined += '\\n--- ' + names[i] + ' ---\\n' + uploadedFiles[names[i]] + '\\n';
            }
            return combined;
        }

        function updateSizeCounter() {
            var total = new Blob([getTotalPayload()]).size;
            var kb = (total / 1024).toFixed(1);
            var counter = document.getElementById('size-counter');
            var btn = document.getElementById('roast-btn');
            counter.textContent = kb + ' / ' + MAX_PAYLOAD_KB + ' KB';
            counter.className = 'size-counter';
            if (total > MAX_PAYLOAD_BYTES) {
                counter.classList.add('over');
                counter.textContent += ' ⚠️ Over limit! Pake CLI buat project gede: npx @jdze/vibe-check';
                btn.disabled = true;
            } else if (total > MAX_PAYLOAD_BYTES * 0.8) {
                counter.classList.add('warn');
                btn.disabled = false;
            } else {
                btn.disabled = false;
            }
        }

        function submitRoast() {
            var payload = getTotalPayload().trim();
            var language = document.getElementById('lang-select').value;
            var isId = language === 'ID';

            if (!payload || payload.length < 20) {
                alert(isId ? 'Lu belum paste/upload kode apapun. Minimal kasih sesuatu dong.' : 'Paste or upload some code first. Give me something to work with.');
                return;
            }

            document.getElementById('roast-btn').disabled = true;
            document.getElementById('roast-btn').textContent = '⏳ Roasting...';
            document.getElementById('loading').style.display = 'block';
            document.getElementById('result-section').style.display = 'none';
            document.getElementById('roast-output').innerHTML = '';
            startLoadingAnimation();

            fetch('/api/web-roast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ payload: payload, language: language }),
            })
            .then(function(res) { return res.json(); })
            .then(function(data) {
                stopLoadingAnimation();
                document.getElementById('loading').style.display = 'none';
                document.getElementById('result-section').style.display = 'block';
                document.getElementById('header-avatar').style.display = 'flex';

                if (data.error) {
                    document.getElementById('roast-output').innerHTML =
                        '<p style="color:#e76f51;">' + data.error + '</p>' +
                        '<p>' + (data.details || '') + '</p>';
                } else {
                    document.getElementById('roast-output').innerHTML = marked.parse(data.roast);
                }
            })
            .catch(function(err) {
                stopLoadingAnimation();
                document.getElementById('loading').style.display = 'none';
                document.getElementById('result-section').style.display = 'block';
                document.getElementById('roast-output').innerHTML =
                    '<p style="color:#e76f51;">💀 Connection Failed</p>' +
                    '<p>' + err.message + '</p>';
            })
            .finally(function() {
                document.getElementById('roast-btn').disabled = false;
                document.getElementById('roast-btn').textContent = '🔥 Roast Me!';
                updateSizeCounter();
            });
        }
    </script>
</body>
</html>`;
}

// --- App ---
const app = new Elysia()
  .use(cors())
  .get('/', ({ set }) => {
    set.headers['content-type'] = 'text/html';
    return getLandingPageHTML();
  })
  .onBeforeHandle(({ request, headers, body, set }) => {
    // Bypass auth for CORS preflight, GET routes, and web-roast (no HMAC needed)
    if (request.method === 'OPTIONS' || request.method === 'GET') return;
    if (new URL(request.url).pathname === '/api/web-roast') return;

    const lang = (body as any)?.language;
    const isId = lang !== 'EN';

    // Validate HMAC Signature
    const timestamp = headers['x-vibe-timestamp'];
    const signature = headers['x-vibe-signature'];

    if (!timestamp || !signature) {
      set.status = 401;
      return {
        error: isId ? '🚫 Akses Ditolak' : '🚫 Access Denied',
        details: isId
          ? 'Request lu gak punya header autentikasi yang valid. Pastiin lu pake CLI resmi (@jdze/vibe-check) buat nge-roast, jangan asal nembak endpoint ya ngab.'
          : 'Your request is missing authentication headers. Make sure you\'re using the official CLI (@jdze/vibe-check), don\'t just hit the endpoint raw, noob.'
      };
    }

    const now = Date.now();
    const requestTime = parseInt(timestamp, 10);

    if (isNaN(requestTime)) {
      set.status = 400;
      return {
        error: isId ? '⏱️ Timestamp Gak Valid' : '⏱️ Invalid Timestamp',
        details: isId
          ? 'Format timestamp request lu aneh. Coba update CLI lu ke versi terbaru: npm i -g @jdze/vibe-check@latest'
          : 'Your request timestamp is malformed. Try updating your CLI: npm i -g @jdze/vibe-check@latest'
      };
    }

    const timeDiff = Math.abs(now - requestTime);

    if (timeDiff > 300000) {
      set.status = 403;
      return {
        error: isId ? '⌛ Request Kedaluwarsa' : '⌛ Request Expired',
        details: isId
          ? 'Request lu udah expired (lebih dari 5 menit). Coba jalanin ulang vibe-check dari awal.'
          : 'Your request has expired (over 5 minutes old). Try running vibe-check again from scratch.'
      };
    }

    const bodyPayload = JSON.stringify(body);
    const hmac = crypto.createHmac('sha256', SECRET_SEED);
    hmac.update(`${timestamp}:${bodyPayload}`);
    const expectedSignature = hmac.digest('hex');

    if (signature.length !== expectedSignature.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      set.status = 403;
      return {
        error: isId ? '🔐 Signature Gak Cocok' : '🔐 Signature Mismatch',
        details: isId
          ? 'Tanda tangan digital request lu gak valid. Kemungkinan lu pake versi CLI yang outdated atau ada yang modif requestnya. Update CLI: npm i -g @jdze/vibe-check@latest'
          : 'Your request signature is invalid. You might be using an outdated CLI version or the request was tampered with. Update CLI: npm i -g @jdze/vibe-check@latest'
      };
    }
  })
  // --- CLI Roast (HMAC-authenticated) ---
  .post(
    '/api/roast',
    async ({ request, body, set }) => {
      const { payload, language } = body;
      const isId = language !== 'EN';

      const ip = getClientIp(request.headers as any);
      const { allowed, remaining } = checkRateLimit(ip);

      if (!allowed) {
        set.status = 429;
        return {
          error: isId ? '🛑 Jatah Roasting Habis!' : '🛑 Roast Quota Exhausted!',
          details: isId
            ? `IP lu udah pake ${RATE_LIMIT_PER_IP}x jatah roasting gratis hari ini. Kuota di-reset tiap tengah malam UTC. Kalo mau unlimited, pake API Key Gemini lu sendiri (pilih opsi BYOK di CLI).`
            : `Your IP has used all ${RATE_LIMIT_PER_IP} free roasts for today. Quota resets at midnight UTC. For unlimited roasts, use your own Gemini API Key (select BYOK option in CLI).`
        };
      }

      try {
        const result = await generateRoast(payload, language);
        return { ...result, remaining };
      } catch (error: any) {
        set.status = 500;
        return handleGeminiError(error, isId);
      }
    },
    {
      body: t.Object({
        payload: t.String(),
        language: t.String(),
      }),
    }
  )
  // --- Web Roast (no HMAC, rate-limited, max 100KB payload) ---
  .post(
    '/api/web-roast',
    async ({ request, body, set }) => {
      const { payload, language } = body;
      const isId = language !== 'EN';

      // Payload size guard (web pastes shouldn't be huge)
      if (payload.length > 100_000) {
        set.status = 413;
        return {
          error: isId ? '📦 Kode Lu Kegedean' : '📦 Code Too Large',
          details: isId
            ? 'Max 100KB kode buat web roast. Mau roast project gede? Pake CLI: npm i -g @jdze/vibe-check'
            : 'Max 100KB code for web roast. Want to roast a full project? Use the CLI: npm i -g @jdze/vibe-check'
        };
      }

      const ip = getClientIp(request.headers as any);
      const { allowed, remaining } = checkRateLimit(ip);

      if (!allowed) {
        set.status = 429;
        return {
          error: isId ? '🛑 Jatah Roasting Habis!' : '🛑 Roast Quota Exhausted!',
          details: isId
            ? `IP lu udah pake ${RATE_LIMIT_PER_IP}x jatah roasting gratis hari ini. Kuota di-reset tiap tengah malam UTC. Sabar ya.`
            : `Your IP has used all ${RATE_LIMIT_PER_IP} free roasts for today. Quota resets at midnight UTC. Be patient.`
        };
      }

      try {
        const result = await generateRoast(payload, language);
        return { ...result, remaining };
      } catch (error: any) {
        set.status = 500;
        return handleGeminiError(error, isId);
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
