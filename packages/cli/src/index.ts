#!/usr/bin/env node
import { intro, outro, select, text, isCancel, cancel, confirm, note } from '@clack/prompts';
import pc from 'picocolors';
import ora from 'ora';
import open from 'open';
import * as fs from 'fs/promises';
import { readFileSync } from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { startLocalServer } from './local-server.js';

const PACKAGE_NAME = '@jdze/vibe-check';

// Auto-read version from package.json — no more manual bumping!
function getLocalVersion(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const pkgPath = path.join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

const CURRENT_VERSION = getLocalVersion();

async function checkForUpdates(): Promise<void> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${PACKAGE_NAME}/latest`, {
      signal: AbortSignal.timeout(5000), // 5s timeout, don't block forever
    });
    if (!res.ok) return;
    const data = await res.json() as { version: string };
    const latest = data.version;

    if (latest === CURRENT_VERSION) return;

    // Compare semver (simple: split and compare numbers)
    const cur = CURRENT_VERSION.split('.').map(Number);
    const lat = latest.split('.').map(Number);
    const isOutdated = lat[0] > cur[0] ||
      (lat[0] === cur[0] && lat[1] > cur[1]) ||
      (lat[0] === cur[0] && lat[1] === cur[1] && lat[2] > cur[2]);

    if (!isOutdated) return;

    note(
      `Versi lu: ${pc.red(CURRENT_VERSION)} → Terbaru: ${pc.green(latest)}\n` +
      `Update: ${pc.cyan(`npm i -g ${PACKAGE_NAME}@latest`)}`,
      '🔔 Update Tersedia!'
    );

    const shouldUpdate = await confirm({
      message: 'Mau auto-update sekarang?',
    });

    if (isCancel(shouldUpdate) || !shouldUpdate) {
      console.log(pc.dim('Lanjut pake versi lama... dasar males update.'));
      return;
    }

    const updateSpinner = ora('Updating... sabar ya noob.').start();
    try {
      execSync(`npm i -g ${PACKAGE_NAME}@latest`, { stdio: 'pipe' });
      updateSpinner.succeed(pc.green(`Berhasil update ke v${latest}! Jalanin ulang vibe-check ya.`));
      process.exit(0);
    } catch (e) {
      updateSpinner.fail(pc.red('Gagal auto-update. Coba manual: npm i -g @jdze/vibe-check@latest'));
    }
  } catch (e) {
    // Silently fail - don't block the user if NPM registry is unreachable
  }
}
const MAX_CLOUD_RUN_SIZE = 500 * 1024;  // 500 KB — fits Gemini free tier (≈125k tokens)
const MAX_SCAN_SIZE = 10 * 1024 * 1024;  // 10 MB — max scan limit (chunking handles the rest)
const ALLOWED_EXTENSIONS = [
  // Web & JS Ecosystem
  '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.vue', '.svelte', '.html', '.css', '.scss', '.sass', '.less', '.styl', '.pug', '.hbs', '.astro',
  // Backend, Mobile & Systems
  '.py', '.go', '.rs', '.java', '.cpp', '.c', '.h', '.hpp', '.cs', '.php', '.rb', '.swift', '.kt', '.kts', '.scala', '.m', '.mm', '.dart',
  // Scripts & Configs
  '.sh', '.bash', '.zsh', '.bat', '.ps1', '.lua', '.r', '.jl', '.pl', '.ex', '.exs', '.erl', '.clj', '.fs', '.f', '.f90', '.zig', '.v', '.nim', '.cr',
  // Data, Docs & Environment
  '.json', '.yaml', '.yml', '.toml', '.xml', '.md', '.sql', '.ini', '.conf', '.cfg', '.dockerfile', '.make', '.cmake', '.gradle'
];
const IGNORED_DIRS = [
  // JS/TS Ecosystem
  'node_modules', '.next', '.nuxt', 'out', '.svelte-kit', '.astro', '.parcel-cache', '.turbo', '.vercel', '.netlify',
  // Build & Dist
  'dist', 'build', '.output', 'target', 'bin', 'obj', 'cmake-build-debug', 'cmake-build-release',
  // Python
  'venv', '.venv', 'env', '__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache', 'site-packages', '.eggs', '*.egg-info',
  // Version Control & IDE
  '.git', '.svn', '.hg', '.idea', '.vscode', '.vs', '.eclipse',
  // Misc
  'coverage', '.cache', '.tmp', 'tmp', 'temp', '.tox', '.nox', '.terraform',
  // Data & ML
  'dataset', 'datasets', '.ipynb_checkpoints', 'checkpoints', 'wandb', 'mlruns',
  // Mobile
  'Pods', '.gradle', '.dart_tool', '.pub-cache',
  // Gemini/Agent
  '.gemini', '.agents',
];
const IGNORED_FILES = [
  // Lock files
  'bun.lockb', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lock', 'uv.lock', 'Pipfile.lock', 'poetry.lock', 'composer.lock', 'Gemfile.lock', 'Cargo.lock', 'go.sum',
  // Build artifacts & maps
  '.min.js', '.min.css', '.map',
  // Environment files (never exfiltrate secrets)
  '.env', '.env.local', '.env.development', '.env.production', '.env.staging', '.env.test',
];

interface ScanResult {
  totalSize: number;
  fileCount: number;
  skippedCount: number;
  payload: string;
}

function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters for code
  return Math.ceil(text.length / 4);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function scanDirectory(dir: string, result: ScanResult, maxSize: number) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    // Stop collecting if we've exceeded max size
    if (result.totalSize >= maxSize) {
      result.skippedCount++;
      continue;
    }

    if (entry.isDirectory()) {
      if (IGNORED_DIRS.includes(entry.name)) continue;
      await scanDirectory(path.join(dir, entry.name), result, maxSize);
    } else {
      const ext = path.extname(entry.name);
      if (ALLOWED_EXTENSIONS.includes(ext)) {
        if (IGNORED_FILES.includes(entry.name)) continue;
        // Skip minified/map files
        if (entry.name.endsWith('.min.js') || entry.name.endsWith('.min.css') || entry.name.endsWith('.map')) continue;
        const filePath = path.join(dir, entry.name);
        // Avoid duplicate package.json since it's already added manually
        if (entry.name === 'package.json' && dir === process.cwd()) continue;
        try {
          const stats = await fs.stat(filePath);
          // Skip individual files larger than 256KB (probably generated/bundled)
          if (stats.size > 256 * 1024) {
            result.skippedCount++;
            continue;
          }
          // Check if adding this file would exceed max size
          if (result.totalSize + stats.size > maxSize) {
            result.skippedCount++;
            continue;
          }
          result.totalSize += stats.size;
          result.fileCount++;

          const content = await fs.readFile(filePath, 'utf-8');
          result.payload += `\n--- ${filePath} ---\n${content}\n`;
        } catch (e) {
          // ignore unreadable files
        }
      }
    }
  }
}

async function scanEnvForToken(cwd: string): Promise<string> {
  try {
    const envPath = path.join(cwd, '.env');
    const envData = await fs.readFile(envPath, 'utf-8');
    const lines = envData.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('GEMINI_API_KEY=') || trimmedLine.startsWith('API_KEY=')) {
        const eqIdx = trimmedLine.indexOf('=');
        if (eqIdx !== -1) {
          const token = trimmedLine.substring(eqIdx + 1).trim();
          // Remove surrounding quotes if they exist
          if (token) {
            return token.replace(/^["'](.+(?=["']$))["']$/, '$1');
          }
        }
      }
    }
  } catch (e) {
    // ignore
  }
  return '';
}

async function getPersonalKey(isId: boolean, cwd: string): Promise<string> {
  const envToken = await scanEnvForToken(cwd);

  if (envToken) {
    const useEnv = await select({
      message: isId
        ? 'Gw liat ada token tuh di .env lu, mau pake ini ga? 😋'
        : 'I see a token in your .env, wanna use it? 😋',
      options: [
        { value: 'yes', label: isId ? 'Iya, pake itu aja' : 'Yes, use it' },
        { value: 'no', label: isId ? 'Nggak, gw masukin manual' : 'No, I will enter manually' }
      ]
    });

    if (isCancel(useEnv)) {
      cancel(isId ? 'Batal deh.' : 'Cancelled.');
      process.exit(0);
    }

    if (useEnv === 'yes') {
      return envToken;
    }
  }

  const key = await text({
    message: isId ? 'Mana API Key Gemini lu?' : 'Enter your Gemini API Key:',
    placeholder: 'AIzaSy...',
  });

  if (isCancel(key)) {
    cancel(isId ? 'Batal deh.' : 'Cancelled.');
    process.exit(0);
  }

  return key as string;
}

async function main() {
  console.clear();
  intro(pc.inverse(' VIBE CHECK '));

  // Check for updates before anything else
  await checkForUpdates();

  const cwd = process.cwd();

  const spinner = ora('Scanning your garbage code...').start();

  const scanResult: ScanResult = {
    totalSize: 0,
    fileCount: 0,
    skippedCount: 0,
    payload: '',
  };

  try {
    // Add package.json info if exists
    const pkgPath = path.join(cwd, 'package.json');
    const pkgData = await fs.readFile(pkgPath, 'utf-8');
    scanResult.payload += `\n--- package.json ---\n${pkgData}\n`;
    scanResult.totalSize += Buffer.byteLength(pkgData, 'utf8');
    scanResult.fileCount++;
  } catch (e) { }

  // First pass: scan with generous limit to measure total
  await scanDirectory(cwd, scanResult, MAX_SCAN_SIZE);

  spinner.stop();

  // --- Scan Stats ---
  const tokens = estimateTokens(scanResult.payload);
  const statsMsg = [
    `📁 ${scanResult.fileCount} files scanned`,
    `📦 ${formatSize(scanResult.totalSize)} payload`,
    `🔤 ~${tokens.toLocaleString()} tokens (est.)`,
    scanResult.skippedCount > 0 ? `⏭️  ${scanResult.skippedCount} files skipped (too large/over limit)` : '',
  ].filter(Boolean).join('\n');

  note(statsMsg, '📊 Scan Results');

  const language = await select({
    message: 'Pilih bahasa buat di-roast:',
    options: [
      { value: 'ID', label: 'Indonesian Tech Slang 🇮🇩' },
      { value: 'EN', label: 'English 🇺🇸' },
    ],
  });

  if (isCancel(language)) {
    cancel('Cemen lu!');
    process.exit(0);
  }

  const isId = language === 'ID';

  let useCloudRun = false;
  let personalKey = '';

  if (scanResult.totalSize <= MAX_CLOUD_RUN_SIZE) {
    // Small enough for Cloud Run free tier
    const keyChoice = await select({
      message: isId
        ? 'Mau pake API Key Gemini sendiri atau pake jatah gw (Cloud Run)?'
        : 'Use your own Gemini API Key or use mine (Cloud Run)?',
      options: isId
        ? [
          { value: 'cloud', label: 'Pake jatah lu ngab (Cloud Run)' },
          { value: 'personal', label: 'Gw orang kaya, pake API Key sendiri' }
        ]
        : [
          { value: 'cloud', label: 'Use yours bro (Cloud Run)' },
          { value: 'personal', label: 'I am rich, use my own API Key' }
        ]
    });

    if (isCancel(keyChoice)) {
      cancel(isId ? 'Yaelah pake cancel segala.' : 'Cancelled.');
      process.exit(0);
    }

    if (keyChoice === 'personal') {
      personalKey = await getPersonalKey(isId, cwd);
    } else {
      useCloudRun = true;
    }
  } else {
    // Too big for Cloud Run — BYOK with smart chunking
    const chunkCount = Math.ceil(tokens / 180_000);
    console.log(pc.yellow(isId
      ? `⚠️  Project lu ${formatSize(scanResult.totalSize)} (~${tokens.toLocaleString()} token) — kegedean buat Cloud Run. Pake API Key sendiri ya! ${chunkCount > 1 ? `(bakal di-split jadi ${chunkCount} chunk)` : ''}`
      : `⚠️  Your project is ${formatSize(scanResult.totalSize)} (~${tokens.toLocaleString()} tokens) — too large for Cloud Run. Use your own API Key! ${chunkCount > 1 ? `(will be split into ${chunkCount} chunks)` : ''}`
    ));
    personalKey = await getPersonalKey(isId, cwd);
  }

  const startingMessage = isId
    ? 'Menganalisa tumpukan sampah di direktori lu... 🗑️'
    : 'Analyzing the garbage dump in your directory... 🗑️';
  const startingSpinner = ora(pc.magenta(startingMessage)).start();

  // Start server
  const port = await startLocalServer({
    payload: scanResult.payload,
    language: language as string,
    personalKey,
    useCloudRun
  });

  startingSpinner.stop();

  outro(pc.green(isId
    ? `Server nyala di http://localhost:${port} - Buka browser lu!`
    : `Server is running at http://localhost:${port} - Open your browser!`
  ));

  open(`http://localhost:${port}`);
}

main().catch(console.error);
