// Computes SHA-256 hashes of every inline <script> and <style> block and checks them against
// the page's Content-Security-Policy meta tag.
//   node tools/csp.mjs v2/index.html          -> verify (exit 1 if stale; used by CI)
//   node tools/csp.mjs v2/index.html --write  -> rewrite script-src / style-src with fresh hashes
// No dependencies: Node built-ins only.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const file = process.argv[2];
const write = process.argv.includes("--write");
if (!file) {
  console.error("usage: node tools/csp.mjs <file.html> [--write]");
  process.exit(2);
}

const html = readFileSync(file, "utf8");
if (html.includes("\r\n")) {
  console.error(`::error file=${file}::CRLF line endings found; hashes must be computed over LF content`);
  process.exit(1);
}

const sha = s => `'sha256-${createHash("sha256").update(s, "utf8").digest("base64")}'`;
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => sha(m[1]));
const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => sha(m[1]));
if (/<script\s[^>]*>/i.test(html) || /<style\s[^>]*>/i.test(html)) {
  console.error(`::error file=${file}::Only attribute-less inline <script>/<style> blocks are supported`);
  process.exit(1);
}

const metaRe = /(<meta http-equiv="Content-Security-Policy" content=")([^"]*)(")/;
const m = html.match(metaRe);
if (!m) {
  console.error(`::error file=${file}::No Content-Security-Policy meta tag found`);
  process.exit(1);
}

const expected = m[2]
  .replace(/script-src [^;]*/, `script-src ${scripts.join(" ") || "'none'"}`)
  .replace(/style-src [^;]*/, `style-src ${styles.join(" ") || "'none'"}`);

for (const bad of ["'unsafe-inline'", "'unsafe-eval'", "*", "http:"]) {
  if (expected.split(/\s+/).includes(bad)) {
    console.error(`::error file=${file}::CSP must not contain ${bad}`);
    process.exit(1);
  }
}

if (write) {
  writeFileSync(file, html.replace(metaRe, (_, a, __, c) => a + expected + c));
  console.log(`Updated CSP hashes in ${file}`);
} else if (expected !== m[2]) {
  console.error(`::error file=${file}::CSP hashes are stale. Run: node tools/csp.mjs ${file} --write`);
  process.exit(1);
} else {
  console.log(`CSP hashes OK in ${file} (${scripts.length} script, ${styles.length} style)`);
}
