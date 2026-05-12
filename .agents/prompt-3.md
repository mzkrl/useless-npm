rtk prompt: Please fix the security vulnerabilities flagged by Socket.dev in the CLI package.

There are two major fixes required:

### 1. Fix Data Exfiltration Risk in `packages/cli/src/index.ts`
Socket.dev flagged the CLI as malware because `scanDirectory` explicitly includes `.env` files in the payload that gets sent to an external server. 
- In `scanDirectory`, REMOVE `|| entry.name.startsWith('.env')` from the condition. 
- Explicitly add `.env`, `.env.local`, `.env.development`, `.env.production` to the `IGNORED_FILES` array so they are never added to `result.payload`.
- Note: `scanEnvForToken` can stay as is, because it only reads the `.env` file locally to extract the user's API key without appending the entire file to the exfiltration payload.

### 2. Fix DOM XSS Risk in `packages/cli/src/template.ts`
Socket.dev flagged a DOM XSS risk because the output from `marked.parse` is injected directly into `innerHTML` without sanitization.
- In the HTML `<head>`, add the DOMPurify CDN: `<script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.6/purify.min.js"></script>`
- In the `fetchRoast` function, sanitize the markdown output before passing it to the typewriter. Update the success logic to:
  ```javascript
  const rawHtmlContent = marked.parse(data.roast);
  const safeHtmlContent = DOMPurify.sanitize(rawHtmlContent);
  typeHTML(safeHtmlContent, document.getElementById('roast-output'));
  ```
- Ensure you keep the Mesugaki vibe and typewriter effect intact, just apply these security patches.