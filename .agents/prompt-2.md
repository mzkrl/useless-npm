rtk prompt: Update `apps/cloud-backend/src/index.ts`. I want to turn the root endpoint into a functional landing page and web preview for the NPM package.

Here are the specific implementation steps:

### 1. Add a new Web-specific API Route
Create a new route `POST /api/web-roast` just below the existing `/api/roast` logic. 
- It MUST reuse the exact same `checkRateLimit` and Gemini AI generation logic.
- It MUST NOT require the HMAC signature (`x-vibe-timestamp` and `x-vibe-signature`). This is because it will be called directly from the client-side browser JS.

### 2. Overhaul the `GET '/'` Route (The HTML Landing Page)
Replace the current plain text response with a full HTML string using Elysia's SSR capabilities. The HTML must have:
- **Styling:** NES.css via CDN, 'Press Start 2P' font, dark theme (`#212529` background, white text).
- **Header/Ad Section:** A big title "Vibe Check CLI" and a prominent box showing the command `npm i -g @jdze/vibe-check`. Add some "Mesugaki" smug copywriting like: "Males buka terminal? Sini paste kode sampah lu, biar gw roast langsung di sini."
- **Interactive Preview:** - A `<textarea>` (styled with NES.css `.nes-textarea`) for users to paste their code.
  - A language selection dropdown (`.nes-select`) for ID/EN.
  - A submit button (`.nes-btn.is-error`) saying "Roast Me!".
- **Output Area:** A div to display the roast result.
- **Client-side JS:** - Include `marked.js` via CDN.
  - Write a Vanilla JS `fetch` call attached to the button. It should POST to `/api/web-roast` with the textarea content and selected language.
  - Show a loading text ("Scanning your garbage...").
  - Render the returned Markdown into the output div using `marked.parse()`.

### 3. Persona
Maintain the smug, condescending "Mesugaki" persona in both the HTML copywriting and the error handling of the new `web-roast` route.

Make sure the HTML string is properly formatted and returned with the `Content-Type: text/html` header. Keep everything lightweight (no React/Vue, just pure Vanilla HTML/JS inside the Elysia file).