# Vercel Frontend Deployment

## Status

This document prepares Vercel frontend deployment for free managed staging. It does not deploy the frontend and does not add a committed Vercel project configuration.

## Purpose

Host the built React/Vite frontend on Vercel for FYP/demo staging.

## Project Settings

Suggested Vercel settings:

| Setting | Value |
| --- | --- |
| Framework preset | Vite |
| Root directory | `frontend` |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist` |

## Environment Variables

The current frontend uses relative `/api/v1` requests through `frontend/src/api/client.js`.

Do not set or rely on `VITE_API_URL` for this PR. It is not used by the current API client.

Required deployment setup:

- configure `/api/*` from the Vercel origin to reach the Render backend
- set the Render backend `FRONTEND_URL` to the Vercel frontend origin
- set Render `CORS_ORIGIN` only if needed, and keep it explicit

## API Routing Requirement

Expected browser flow:

```text
Browser -> https://<vercel-origin>/api/v1/... -> https://<render-backend-origin>/api/v1/...
```

The current repository does not commit a `vercel.json` because a real Render backend origin is not available and must not be invented.

When the Render backend URL exists, choose one reviewed option:

- configure Vercel rewrites to proxy `/api/:path*` to the Render backend
- add a small committed `vercel.json` in a later config PR with the real approved staging backend origin
- change the frontend API-base configuration in a later app/config PR, with tests, if proxying is not selected

Do not hardcode a fake backend URL.

## Verification

After deployment:

```bash
curl -fsSI https://<vercel-origin>/
curl -fsS https://<vercel-origin>/api/v1/health
```

Pass:

- frontend root returns HTTP 200
- `/api/v1/health` reaches the Render backend through the Vercel origin
- no frontend build logs expose secrets

Fail:

- frontend returns 404/5xx
- `/api/v1/health` fails from the Vercel origin
- frontend requires a fake API response

## Evidence To Capture

Capture:

- Vercel deployment status
- build command and output directory
- HTTP result for frontend root
- API proxy health result
- known Vercel free-tier limitations

Do not capture:

- account tokens
- private deployment tokens
- real student data
- backend secrets

## Free-Tier Notes

Vercel free-tier limits can affect build minutes, bandwidth, concurrent builds, and project ownership. Recheck `https://vercel.com/pricing` before relying on it for a live demo.
