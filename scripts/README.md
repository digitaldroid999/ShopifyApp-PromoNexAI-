# VPS integration

Use these scripts to deploy or update the app on your VPS.

## Quick start (on the VPS)

1. **One-time setup**
   - Install Node.js (>=20.19), npm, and PostgreSQL.
   - Clone the repo (or copy the project) into a directory on the VPS.
   - Create `.env` with at least:
     - `DATABASE_URL` (PostgreSQL connection string)
     - Shopify and API keys (e.g. `PHOTOROOM_API_KEY`, `PEXELS_API_KEY`, etc.)
   - Optional: install PM2 for process management: `npm install -g pm2`

2. **Deploy / update (integrate new functionality)**

   From the project root on the VPS:

   ```bash
   chmod +x scripts/integrate-vps.sh
   ./scripts/integrate-vps.sh
   ```

   Or via npm:

   ```bash
   npm run integrate-vps
   ```

   This will:
   - `git pull` (if in a git repo)
   - `npm ci`
   - `prisma generate` and `prisma migrate deploy`
   - `npm run build`
   - Restart the app with PM2 if available (otherwise you restart manually)

## Options

- **Skip git pull** (e.g. you upload files manually):
  ```bash
  ./scripts/integrate-vps.sh --no-pull
  ```

- **Skip restart** (e.g. you use systemd or run `npm run start` yourself):
  ```bash
  ./scripts/integrate-vps.sh --no-restart
  ```

## First-time PM2 setup (optional)

If you use PM2, start the app once with a name so the script can restart it:

```bash
pm2 start npm --name "promo-nex-ai" -- run start
pm2 save
pm2 startup  # follow the printed instructions to enable on boot
```

After that, `integrate-vps.sh` will run `pm2 restart promo-nex-ai` when you deploy.
