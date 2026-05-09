import * as crypto from 'crypto';

const VIBE_CHECK_SECRET_SEED = 'vibe-check-super-secret-seed-12345';
const targetUrl = 'https://useless-npm-1085257795815.asia-southeast3.run.app/api/roast';
const timestamp = Date.now().toString();
const bodyPayload = JSON.stringify({
    payload: "test",
    language: "ID"
});

const hmac = crypto.createHmac('sha256', VIBE_CHECK_SECRET_SEED);
hmac.update(`${timestamp}:${bodyPayload}`);
const signature = hmac.digest('hex');

console.log("Sending headers:");
console.log({
    'Content-Type': 'application/json',
    'x-vibe-timestamp': timestamp,
    'x-vibe-signature': signature
});

const res = await fetch(targetUrl, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-vibe-timestamp': timestamp,
        'x-vibe-signature': signature
    },
    body: bodyPayload,
});
console.log("Status:", res.status);
console.log("Body:", await res.text());
