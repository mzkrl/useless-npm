Act as an elite TypeScript, Bun, and ElysiaJS developer. I am building "vibe-check", a humorous, overengineered NPM CLI tool for the Google Vibe Coding Competition. 

### Project Architecture: Bun Monorepo
I need this to be structured as a simple monorepo containing two distinct apps/targets to separate the NPM package from the GCP deployment. 

Proposed Monorepo Structure:
├── packages/cli/           <-- The interactive NPM CLI package
│   ├── src/index.ts        <-- CLI Entry point (Interactive prompts & spinner)
│   ├── src/local-server.ts <-- Local ElysiaJS server (Port 6769) & API Switch logic
│   ├── src/template.ts     <-- Vanilla HTML/CSS/JS string (Frontend)
│   └── package.json        <-- Configured for NPM publish ("bin": { "vibe-check": "./src/index.ts" })
├── apps/cloud-backend/     <-- The endpoint deployed to Google Cloud Run
│   ├── src/index.ts        <-- ElysiaJS server handling Gemini AI API
│   ├── Dockerfile          <-- For GCP Cloud Run deployment
│   └── package.json
├── package.json            <-- Root monorepo config (Bun workspaces)
└── tsconfig.json

### Tech Stack
- **Environment:** Bun (Workspaces).
- **Servers:** ElysiaJS (for both local UI server and Cloud Run backend).
- **AI Integration:** `@google/generative-ai` SDK.
- **CLI Utilities:** `@clack/prompts` (for modern, interactive terminal UI), `ora` (terminal spinner), `open` (auto-open browser).
- **Frontend (`template.ts`):** Vanilla HTML string returned by the local Elysia server. Styled with NES.css (CDN) for a retro vibe. Use Marked.js (CDN) to parse Markdown to HTML. Include a Vanilla JS typewriter effect.

### Feature 1: The Pre-Scan & Interactive CLI (`packages/cli/src/index.ts`)
When the user types `npx vibe-check`, it must be an interactive CLI using `@clack/prompts`.
Flow:
1. Greet the user with a stylized welcome message.
2. **Pre-Scan Logic:** Scan the user's root directory. Recursively calculate the total file size of their source code (only include files like `.js, .ts, .jsx, .tsx, .html, .css, .md` and strictly IGNORE `node_modules`, `.git`, and build outputs). 
3. **Payload Threshold Check:** Set a MAX_PAYLOAD_SIZE (e.g., 100 KB). 
4. Ask for Language Preference: "Pilih bahasa buat di-roast:" (ID / EN).
5. Ask for API Key configuration based on the Pre-Scan:
   - If total size <= MAX_PAYLOAD_SIZE: Ask "Mau pake API Key Gemini sendiri atau pake jatah gw (Cloud Run)?" (Options: Personal Key / Cloud Run).
   - If total size > MAX_PAYLOAD_SIZE: Force the user to use their own key. Display a sassy message: "File lu kegedean (X KB)! Server gw bisa jebol nampung kode ampas lu. Modal API Key sendiri, noob!" and only provide the option to input their Personal Key.
6. Trigger the `ora` spinner with a sassy loading text.
7. Spin up `local-server.ts` and use `open('http://localhost:6769')`.

### Feature 2: Deep Code Extraction & Dual Backends
- **Code Extractor:** Before hitting the API, extract the actual content of the scanned source files, concatenate them nicely with their file names as headers (e.g., `--- src/index.ts --- \n <content>`), and append it to the `package.json` metadata to send to the AI.
- **Local Server (`local-server.ts`):** Serves the UI on port 6769. If the user provided a personal API key, hit the Gemini API directly with the massive payload. If not (and they passed the size check), POST the payload to the Cloud Run endpoint.
- **Cloud Run Backend (`cloud-backend/src/index.ts`):** Holds the developer's secure Gemini API key. Receives the payload from the CLI, hits Gemini, and returns the markdown response.
- **Local Server (`local-server.ts`):** Serves the UI on port 6769. Scans the user's `package.json` and `node_modules` size. If the user provided a personal API key in the interactive prompt, hit the Gemini API directly. If not, POST the metadata to the Cloud Run endpoint.
- **Cloud Run Backend (`cloud-backend/src/index.ts`):** Holds the developer's secure Gemini API key. Receives metadata from the CLI, hits Gemini, and returns the markdown response. Ensure CORS is enabled.

### Feature 3: The Mesugaki Persona
The AI must roast the user's code using a smug, condescending, bratty "mesugaki" developer persona. The output must strictly be formatted in Markdown (`.md`). 
Example ID System Prompt snippet: "Lu adalah senior dev mesugaki yang hobi ngeroast noob. Output format wajib Markdown."

### Your Task
Generate the complete, production-ready code for the entire monorepo based on the structure above. Provide the code for:
1. All `package.json` files (Root, CLI, Cloud).
2. The interactive CLI entry (`packages/cli/src/index.ts`).
3. The Local Elysia Server (`packages/cli/src/local-server.ts`).
4. The Frontend Template (`packages/cli/src/template.ts`).
5. The Cloud Run Backend (`apps/cloud-backend/src/index.ts`) and its `Dockerfile`.