# Topic Similarity Frontend

React/Vite frontend for the Topic Similarity MVP role-based workflows.

## Requirements

- Node.js 22 is used for the PR #107 release-candidate gate.
- Backend API reachable through the same origin or a development proxy.

## Local Development

```powershell
cd frontend
npm ci
npm run dev -- --host 127.0.0.1
```

The default Vite dev server runs on `http://127.0.0.1:5173`.

## API Routing

The frontend API client uses relative `/api/v1` requests:

```text
/api/v1
```

In local development, `vite.config.js` proxies `/api` to `http://localhost:3000`.

For a built/static frontend, configure the web server or reverse proxy to route `/api` to the backend. `VITE_API_URL` is not used by the current `src/api/client.js`.

## Build and Preview

```powershell
npm run build
npm run preview -- --host 127.0.0.1
```

Build output is written to:

```text
frontend/dist
```

`npm run dev` and `npm run preview` are development/demo servers, not production web-server setups.

## Tests

```powershell
npm test -- --run --maxWorkers=1 --minWorkers=1
```

Credentialed smoke tests require all services to be running and credentials supplied through environment variables:

```powershell
$env:SMOKE_STUDENT_EMAIL='...'
$env:SMOKE_STUDENT_PASSWORD='...'
$env:SMOKE_LECTURER_EMAIL='...'
$env:SMOKE_LECTURER_PASSWORD='...'
$env:SMOKE_ADMIN_EMAIL='...'
$env:SMOKE_ADMIN_PASSWORD='...'
npm run smoke:figma-ui
```

Do not commit smoke credentials or generated smoke artifacts.
