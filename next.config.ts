import type { NextConfig } from "next";
import fs from "node:fs";
import path from "node:path";

function parseEnvLine(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!match) return null;

  const key = match[1];
  let value = match[2].trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return [key, value];
}

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    const [key, value] = parsed;
    process.env[key] = value;
  }
}

function loadAppEnv() {
  const envDir = path.join(process.cwd(), ".env");
  const baseEnvPath = path.join(envDir, ".env.base");
  loadEnvFile(baseEnvPath);

  const current = (process.env.APP_ENV ?? "develop").trim().toLowerCase();
  if (current !== "develop" && current !== "production") {
    throw new Error(`Invalid APP_ENV: ${current}. Use "develop" or "production".`);
  }

  const selectedEnvPath = path.join(envDir, `.env.${current}`);
  loadEnvFile(selectedEnvPath);
}

loadAppEnv();

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
