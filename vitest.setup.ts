import { readFileSync } from "fs";
import { resolve } from "path";

// .env faylini process.env ga yuklaymiz (vitest avtomatik yuklamaydi)
try {
  const content = readFileSync(resolve(__dirname, ".env"), "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
} catch {
  // .env yo'q bo'lsa e'tibor bermaymiz (CI env'dan keladi)
}
