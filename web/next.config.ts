import type { NextConfig } from "next";

console.log('----------------------------------------');
console.log('[DEBUG] Server Starting...');
console.log('[DEBUG] Current Directory:', process.cwd());
console.log('[DEBUG] Webhook URL Exists:', !!process.env.DISCORD_WEBHOOK_URL);
if (process.env.DISCORD_WEBHOOK_URL) {
  console.log('[DEBUG] Webhook URL Length:', process.env.DISCORD_WEBHOOK_URL.length);
} else {
  console.log('[DEBUG] Webhook URL is MISSING!');
}
console.log('----------------------------------------');

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
