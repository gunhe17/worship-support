type PublicEnvKey =
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  | "NEXT_PUBLIC_SITE_URL";

function readEnv(name: PublicEnvKey): string | undefined {
  const envMap: Record<PublicEnvKey, string | undefined> = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  };
  return envMap[name];
}

function requireEnv(name: PublicEnvKey): string {
  const value = readEnv(name);
  if (!value) {
    const appEnv = process.env.APP_ENV ?? "develop";
    const envFile = `.env/.env.base + .env/.env.${appEnv}`;
    throw new Error(
      `Missing required environment variable: ${name}. Set it in ${envFile}.`
    );
  }
  return value;
}

export function getSupabaseUrl(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_URL");
}

export function getSupabaseAnonKey(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export function getSiteUrl(): string {
  const value = readEnv("NEXT_PUBLIC_SITE_URL");
  if (value) return value;

  if (process.env.NODE_ENV !== "production") {
    return "http://127.0.0.1:3000";
  }

  throw new Error("Missing required environment variable: NEXT_PUBLIC_SITE_URL");
}
