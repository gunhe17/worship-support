This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Environment Split (dev local / prod cloud)

Env files are managed under the `.env/` directory using `APP_ENV`.

- `APP_ENV=develop` → local Supabase
- `APP_ENV=production` → cloud Supabase

### File structure

- `.env/.env.base` (required): `APP_ENV=develop | production`
- `.env/.env.develop` (local, git ignored)
- `.env/.env.production` (local/cloud, git ignored)
- `.env/.env.develop.example` / `.env/.env.production.example` (templates, committed)

Required vars:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`

Notes:

- In non-production, `NEXT_PUBLIC_SITE_URL` falls back to `http://127.0.0.1:3000` if omitted.
- In production, missing required env vars throw an error at runtime.

### 1) Development (all local)

1. Set `.env/.env.base` to `APP_ENV=develop`.
2. Create `.env/.env.develop` from `.env/.env.develop.example`.
3. Start local Supabase and app.

```bash
supabase start
pnpm dev
```

### 2) Production (all cloud)

1. Set `.env/.env.base` to `APP_ENV=production`.
2. Create `.env/.env.production` from `.env/.env.production.example`.
3. Set same values in your cloud platform env vars (Vercel).

### pnpm commands

- Local development: `pnpm dev`
- Production mode (build + start): `pnpm prod`

## Icon Policy

- Use only `@radix-ui/react-icons` for all UI icons.
- Do not use mixed icon sources (Heroicons, Lucide, custom SVG, emoji).
- Keep icon style consistent across editor UI and sidebar components.
- Reference: https://www.radix-ui.com/icons?utm_source=chatgpt.com

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
