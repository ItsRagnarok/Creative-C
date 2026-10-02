import { readFile } from "node:fs/promises";
import path from "node:path";

// The public marketing site is a single self-contained static HTML file
// (its own <html>/<head>/<body>, fonts and scripts inline) — served as a
// raw Response instead of a React page so it isn't wrapped by the app's
// own <html> in src/app/layout.tsx. The CRM itself still lives at
// /login, /dashboard, etc., linked from this page's "Client Login" button.
export async function GET() {
  const html = await readFile(path.join(process.cwd(), "public", "landing.html"), "utf-8");
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
