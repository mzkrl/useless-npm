#!/usr/bin/env bun
import { intro, outro, select, text, isCancel, cancel } from '@clack/prompts';
import pc from 'picocolors';
import ora from 'ora';
import open from 'open';
import * as fs from 'fs/promises';
import * as path from 'path';
import { startLocalServer } from './local-server.js';

const MAX_PAYLOAD_SIZE = 100 * 1024; // 100 KB
const ALLOWED_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx', '.html', '.css', '.md'];
const IGNORED_DIRS = ['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', 'out'];

interface ScanResult {
  totalSize: number;
  payload: string;
}

async function scanDirectory(dir: string, result: ScanResult) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.includes(entry.name)) continue;
      await scanDirectory(path.join(dir, entry.name), result);
    } else {
      const ext = path.extname(entry.name);
      if (ALLOWED_EXTENSIONS.includes(ext)) {
        const filePath = path.join(dir, entry.name);
        try {
          const stats = await fs.stat(filePath);
          result.totalSize += stats.size;

          const content = await fs.readFile(filePath, 'utf-8');
          result.payload += `\n--- ${filePath} ---\n${content}\n`;
        } catch (e) {
          // ignore unreadable files
        }
      }
    }
  }
}

async function main() {
  console.clear();
  intro(pc.inverse(' VIBE CHECK '));

  const cwd = process.cwd();

  const spinner = ora('Scanning your garbage code...').start();

  const scanResult: ScanResult = {
    totalSize: 0,
    payload: '',
  };

  try {
    // Add package.json info if exists
    const pkgPath = path.join(cwd, 'package.json');
    const pkgData = await fs.readFile(pkgPath, 'utf-8');
    scanResult.payload += `\n--- package.json ---\n${pkgData}\n`;
    scanResult.totalSize += Buffer.byteLength(pkgData, 'utf8');
  } catch (e) { }

  await scanDirectory(cwd, scanResult);

  spinner.stop();

  const sizeKB = (scanResult.totalSize / 1024).toFixed(2);

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

  let useCloudRun = false;
  let personalKey = '';

  if (scanResult.totalSize <= MAX_PAYLOAD_SIZE) {
    const keyChoice = await select({
      message: 'Mau pake API Key Gemini sendiri atau pake jatah gw (Cloud Run)?',
      options: [
        { value: 'cloud', label: 'Pake jatah lu ngab (Cloud Run)' },
        { value: 'personal', label: 'Gw orang kaya, pake API Key sendiri' },
      ],
    });

    if (isCancel(keyChoice)) {
      cancel('Yaelah pake cancel segala.');
      process.exit(0);
    }

    if (keyChoice === 'personal') {
      const key = await text({
        message: 'Mana API Key Gemini lu?',
        placeholder: 'AIzaSy...',
      });
      if (isCancel(key)) {
        cancel('Batal deh.');
        process.exit(0);
      }
      personalKey = key as string;
    } else {
      useCloudRun = true;
    }
  } else {
    console.log(pc.red(`File lu kegedean (${sizeKB} KB)! Server gw bisa jebol nampung kode ampas lu. Modal API Key sendiri, noob!`));
    const key = await text({
      message: 'Mana API Key Gemini lu?',
      placeholder: 'AIzaSy...',
    });
    if (isCancel(key)) {
      cancel('Dasar noob!');
      process.exit(0);
    }
    personalKey = key as string;
  }

  const startingSpinner = ora(pc.magenta('Menganalisa tumpukan sampah di direktori lu... 🗑️')).start();

  // Start server
  const port = await startLocalServer({
    payload: scanResult.payload,
    language: language as string,
    personalKey,
    useCloudRun
  });

  startingSpinner.stop();

  outro(pc.green(`Server nyala di http://localhost:${port} - Buka browser lu!`));

  open(`http://localhost:${port}`);
}

main().catch(console.error);
