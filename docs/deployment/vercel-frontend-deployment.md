# Vercel Frontend Deployment

## Status

This document prepares Vercel frontend deployment for free managed staging. PR #129 adds the committed `frontend/vercel.json` rewrite configuration needed for Vercel to serve the React SPA and proxy relative `/api/*` calls to the Render backend.

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

- use the committed `frontend/vercel.json` rewrite configuration so `/api/*` from the Vercel origin reaches the Render backend
- set the Render backend `FRONTEND_URL` to the Vercel frontend origin
- set Render `CORS_ORIGIN` only if needed, and keep it explicit

## API Routing Requirement

Expected browser flow:

```text
Browser -> https://<vercel-origin>/api/v1/... -> https://research-topic-approval-dss-backend.onrender.com/api/v1/...
```

The committed `frontend/vercel.json` contains:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://research-topic-approval-dss-backend.onrender.com/api/:path*"
    },
    {
      "source": "/:path*",
      "destination": "/index.html"
    }
  ]
}
```

The first rewrite preserves existing frontend API behavior for `/api/v1`, `/api/similarity/check`, and other existing relative `/api/*` calls. The second rewrite preserves React Router SPA fallback routing by serving `index.html` for non-API paths.

Do not add `VITE_API_URL` or `VITE_API_BASE_URL` for this path. The current frontend API client still uses relative paths.

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
