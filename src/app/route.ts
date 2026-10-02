import { readFile } from "node:fs/promises";
import path from "node:path";

// The public marketing site is a single static HTML file (its own <html>/<head>/<body>), served as a raw
// Response so it isn't wrapped by the app's <html> in src/app/layout.tsx. Images and fonts live in
// /landing-assets (long-cached); the HTML itself is read once per server instance and edge-cached.
let cached: Promise<string> | undefined;

export async function GET() {
  cached ??= readFile(path.join(process.cwd(), "public", "landing.html"), "utf-8");
  return new Response(await cached, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
