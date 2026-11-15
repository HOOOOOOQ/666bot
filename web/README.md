# 666 ULTIMATE RPG — Public Website

Static landing page + command help center. No build step, no database, no secrets.

## Local preview

From the repository root:

```bash
npm start          # bot also serves this at http://localhost:3000/site/
```

or serve this folder with any static file server:

```bash
npx serve web
```

## Regenerate command documentation

`commands.json` is generated from the bot's single source of truth:

```bash
npm run web:build
npm run web:check   # fails when commands.json is stale
```

Always run `web:build` after changing `src/rpg/help/catalog.js` or a command's
`help` array.

## Deploy to Vercel

1. Vercel → **Add New Project** → import `HOOOOOOQ/666bot`.
2. Set **Root Directory** to `web`.
3. Framework preset: **Other**. Build command, install command, and output
   directory: leave empty.
4. Deploy. `vercel.json` already provides clean URLs, security headers, and
   immutable caching for `/assets/*`.
5. Optional: add a custom domain, then set `PUBLIC_WEB_URL` in the bot `.env`
   so the `/help` Discord menu shows a **Buka Website** button.

The dashboard is separate (`/dashboard`) and runs on the bot host because it
needs live MongoDB access and the admin key.
