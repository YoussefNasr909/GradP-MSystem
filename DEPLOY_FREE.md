# Free No-Card Deployment Guide

Render is asking this account for a card even on the Free instance, so do not use Render for the no-card path.

Use this instead:

- Frontend: Vercel Hobby
- Backend: Koyeb Free Web Service
- Database: Neon Free Postgres

## 1. Database On Neon

1. Sign up at Neon with GitHub or email.
2. Create a new Postgres project.
3. Copy the direct connection string.
4. Use that value as `DATABASE_URL` in Koyeb.

Example shape:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST.neon.tech/DB?sslmode=require"
```

Use the direct URL, not the pooled URL with `-pooler` in the hostname. This backend runs Prisma migrations at startup, and Prisma migrations need a direct database connection.

## 2. Backend On Koyeb

Koyeb currently has one free web service per organization. If it offers a paid plan during signup, choose Starter/Free and do not add a card.

Create a Web Service from GitHub:

```text
Deployment method: GitHub
Repository: this repo
Branch: main
Work directory: GraduationProjectBackend
Builder: Dockerfile
Dockerfile path: Dockerfile
Instance: Free
Region: Frankfurt or Washington, D.C.
Exposed port: 4000 / HTTP
Health check path: /health
```

Environment variables:

```env
NODE_ENV=production
DATABASE_URL=<your Neon direct connection string>
JWT_SECRET=<strong random secret>
JWT_EXPIRES_IN=1d
JWT_REMEMBER_EXPIRES_IN=30d

CORS_ORIGINS=https://<your-vercel-app>.vercel.app
FRONTEND_URL=https://<your-vercel-app>.vercel.app
API_URL=https://<your-koyeb-backend>.koyeb.app

VERIFICATION_CODE_TTL_MIN=10
PASSWORD_RESET_TTL_MIN=10
DOCUMENT_MAX_SIZE_MB=0
RESOURCE_MAX_SIZE_MB=0

GAMIFICATION_ENABLED=true
GAMIFICATION_WORKER_ENABLED=false
GAMIFICATION_WORKER_INTERVAL_MS=30000
```

Generate `JWT_SECRET` locally:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

After deployment, open:

```text
https://<your-koyeb-backend>.koyeb.app/health
```

Expected response:

```json
{"ok":true}
```

## 3. Frontend On Vercel

Import the same GitHub repository into Vercel.

Settings:

```text
Framework Preset: Next.js
Root Directory: GraduationProjectFrontend
Install Command: npm ci
Build Command: npm run build
Output Directory: .next
```

Environment variables:

```env
NEXT_PUBLIC_API_BASE_URL=https://<your-koyeb-backend>.koyeb.app/api/v1
NEXT_PUBLIC_SOCKET_URL=https://<your-koyeb-backend>.koyeb.app
BACKEND_URL=https://<your-koyeb-backend>.koyeb.app
NEXT_PUBLIC_DOCUMENT_MAX_SIZE_MB=0
NEXT_PUBLIC_RESOURCE_MAX_SIZE_MB=0
```

After Vercel gives you the frontend URL, return to Koyeb and update:

```env
CORS_ORIGINS=https://<your-vercel-app>.vercel.app
FRONTEND_URL=https://<your-vercel-app>.vercel.app
```

Then redeploy the backend.

## 4. Seed Demo Users

For a graduation demo, seed already-verified users instead of relying on email verification.

From your local machine, temporarily set `DATABASE_URL` to the Neon URL, then run:

```powershell
cd GraduationProjectBackend
npx prisma migrate deploy
npx prisma db seed
```

Do not commit the production database URL into any file.

## If Koyeb Also Asks For A Card

Use Cloudflare Quick Tunnel for the backend during the demo:

```powershell
cd GraduationProjectBackend
npm start
cloudflared tunnel --url http://localhost:4000
```

Cloudflare prints a public `https://...trycloudflare.com` URL. Put that URL into Vercel:

```env
NEXT_PUBLIC_API_BASE_URL=https://<your-tunnel>.trycloudflare.com/api/v1
NEXT_PUBLIC_SOCKET_URL=https://<your-tunnel>.trycloudflare.com
BACKEND_URL=https://<your-tunnel>.trycloudflare.com
```

Also set backend env locally:

```env
CORS_ORIGINS=https://<your-vercel-app>.vercel.app
FRONTEND_URL=https://<your-vercel-app>.vercel.app
API_URL=https://<your-tunnel>.trycloudflare.com
DATABASE_URL=<your Neon direct connection string>
```

This is not permanent hosting. It works for a live demo while your laptop is on.

## Important Free-Tier Limits

- Koyeb Free scales to zero after inactivity, so the first request can be slow.
- Koyeb local storage is ephemeral. Uploaded files can disappear.
- Neon Free is good for demos, but keep the database small.
- If uploaded files must survive, move uploads to Cloudinary Free or another object storage service.
