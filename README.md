# Vibe Check CLI (@jdze/vibe-check)

[![NPM Version](https://img.shields.io/npm/v/@jdze/vibe-check.svg)](https://www.npmjs.com/)
[![Built with Bun](https://img.shields.io/badge/Bun-%23000000.svg?logo=bun&logoColor=white)](https://bun.sh)
[![Powered by Gemini](https://img.shields.io/badge/Powered%20by-Google%20Gemini-blue.svg)](https://deepmind.google/technologies/gemini/)

> *"Lu pikir kode lu udah bersih? Sini gw scan dulu, noob! 😏"*

**Vibe Check CLI** adalah *tool* CLI super *overengineered* yang bertugas meng-analisa file project dan *source code* lokal lu, lalu mengirimkannya ke Google Gemini AI untuk di-**roast habis-habisan** oleh persona AI "Mesugaki" (bocil tengil, elitist, dan toxic). 

Dibuat khusus untuk meramaikan ajang **Google Vibe Coding Competition**. Sekali mendayung: belajar *publish* NPM dapet, dapet *roasting*-an gratis, dan bikin *developer* kena mental juga dapet.

---

## ✨ Fitur Utama (Kenapa CLI ini Overengineered)

* 🎮 **Interactive Terminal UX:** Menggunakan `@clack/prompts` untuk navigasi CLI yang mulus dan elegan. Gak ada lagi *flag* terminal yang ngebosenin.
* 🧠 **Google Gemini AI (Gemini 3 Flash Preview):** *Code reviewer* lu bukan linter biasa, tapi AI dengan *prompt* super spesifik yang siap ngehina kelemahan logika dan ketergantungan lu sama `node_modules`.
* ⚖️ **Smart Pre-Scan & Dual Backend:** * CLI akan ngitung total ukuran *source code* lu sebelum nembak API. 
    * Kalo *project* lu kecil/normal: Lu bisa pake jatah API Key dari *backend* **Google Cloud Run** gw secara gratis. 
    * Kalo *project* lu segede gaban: CLI bakal ngejek lu miskin dan maksa lu masukin API Key Gemini lu sendiri (BYOK - Bring Your Own Key). Server gw ga sudi nampung *bloatware* lu! 🗑️
* 🚀 **Auto-Spin ElysiaJS Server:** Hasil *roast* ga cuma ditampilin di terminal kaku. CLI ini otomatis ngebuka `http://localhost:6769` di *browser* lu, nampilin UI retro 8-bit (NES.css) dengan animasi CSS *fade-in* yang elegan secara visual.
* 🌍 **Polyglot Roast:** Nggak cuma roaster JS/TS doang. Tool ini sanggup ngebantai kode Python, Go, Rust, Java, C++, Ruby, PHP, Swift, Kotlin, config YAML/JSON/TOML, sampai bash script.

---

## 🚀 Cara Install & Pakai

Lu gak perlu install global kalo takut laptop lu ternoda. Cukup pake `npx` atau `bunx`:

```bash
# Menggunakan npx (Node.js)
npx @jdze/vibe-check

# Atau menggunakan bunx (Rekomendasi, lebih ngebut!)
bunx @jdze/vibe-check
```

### Flow Penggunaan:

1. Jalankan *command* di atas di *root folder* proyek lu.
2. Jawab pertanyaan interaktif di terminal (Pilih bahasa *roasting*: ID/EN).
3. Tentukan mau pake API Key sendiri atau gratisan server (kalo lolos *size check*).
4. Nikmati *loading screen* yang merendahkan harga diri lu.
5. *Browser* akan otomatis terbuka. Siapkan mental lu. 🤭

---

## 🛠️ Tech Stack & Arsitektur

*Tool* ini adalah *Monorepo* yang memanfaatkan ekosistem modern:

* **Runtime:** [Bun](https://bun.sh/)
* **Web Server:** [ElysiaJS](https://elysiajs.com/) (Menjalankan server localhost & Cloud Run backend).
* **AI Engine:** `@google/generative-ai`
* **Frontend UI:** Vanilla HTML + [NES.css](https://nostalgic-css.github.io/NES.css/) + [Marked.js](https://marked.js.org/) (Di-*serve* langsung via SSR Elysia).
* **Infrastructure:** Google Cloud Run (Untuk *endpoint* publik & proteksi API Key utama).

---

## Example

Tool ini udah mulai roasting kodenya sendiri dari hari pertama.

![Contoh output](image.png)

---

## ⚠️ Disclaimer

1. **AI Attitude:** Persona AI di dalam *tool* ini disengaja untuk menjadi kasar, sarkas, dan *toxic* murni untuk tujuan komedi dan hiburan (*Vibe Coding*). Jangan masukin ke hati kalo AI-nya nyebut lu *noob* atau nyuruh lu *touch grass*.
2. **Privacy:** Jika lu memilih opsi *Cloud Run*, *source code* lu hanya dikirim ke server untuk diproses oleh Gemini dan **TIDAK DISIMPAN** sama sekali di *database* manapun. Kalo parno, pilih opsi masukin API Key lu sendiri.

---

## 🤝 Kontribusi

Merasa *prompt* AI-nya kurang galak? Atau UI-nya kurang *sreg*? Silakan *fork* repo ini dan kirim PR.

**License:** MIT. Bebas lu pake, bebas lu modif, tapi gw ga tanggung jawab atas mental *developer* lu yang hancur. 🎀
