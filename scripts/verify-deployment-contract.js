#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function serviceBlock(compose, name) {
  const start = compose.indexOf(`  ${name}:`);
  assert.notEqual(start, -1, `Compose service ${name} must exist.`);

  const remainder = compose.slice(start + `  ${name}:`.length);
  const nextService = remainder.search(/\n  [A-Za-z0-9-]+:\n/);
  const volumes = remainder.search(/\nvolumes:\n/);
  const end = [nextService, volumes].filter((index) => index >= 0).sort((a, b) => a - b)[0];
  return end === undefined ? remainder : remainder.slice(0, end);
}

function assertNoPublishedPorts(block, serviceName) {
  assert.doesNotMatch(block, /^    ports:/m, `${serviceName} must remain private and have no published ports.`);
}

try {
  const compose = read('docker-compose.yml');
  const nginx = read('frontend/nginx.conf.template');
  const frontendDockerfile = read('frontend/Dockerfile');
  const backendDockerfile = read('backend/Dockerfile');
  const frontendDockerignore = read('frontend/.dockerignore');
  const backendDockerignore = read('backend/.dockerignore');
  const backendEnvExample = read('backend/env.example');
  const environmentConfig = read('backend/src/config/env.js');
  const errorHandler = read('backend/src/middleware/errorHandler.middleware.js');
  const legacySbertCompose = read('sbert-service/docker-compose.yml');
  const frontendClient = read('frontend/src/api/client.js');
  const frontendSimilarity = read('frontend/src/api/similarity.js');
  const landingPage = read('frontend/src/pages/LandingPage.jsx');
  const releaseGate = read('scripts/release-readiness.js');
  const smoke = read('scripts/smoke/fullstack-compose-smoke.js');
  const renderBlueprint = read('render.yaml');
  const serverRoutes = read('backend/src/server.js');

  const postgres = serviceBlock(compose, 'postgres');
  const backend = serviceBlock(compose, 'backend');
  const frontend = serviceBlock(compose, 'frontend');
  const sbert = serviceBlock(compose, 'sbert-service');
  const migration = serviceBlock(compose, 'backend-migrate');
  const bootstrap = serviceBlock(compose, 'backend-bootstrap');

  assertNoPublishedPorts(postgres, 'postgres');
  assertNoPublishedPorts(backend, 'backend');
  assert.match(frontend, /FRONTEND_PORT:-8080\}:8080/, 'frontend must be the only standard published service.');
  assert.match(sbert, /profiles:\s*\["legacy-sbert"\]/, 'SBERT must be opt-in legacy-only.');
  assert.match(legacySbertCompose, /profiles:\s*\["legacy-sbert"\]/, 'the standalone SBERT compose artifact must also be explicitly legacy-only.');
  assertNoPublishedPorts(sbert, 'legacy SBERT');
  assert.doesNotMatch(backend, /SBERT_[A-Z_]+:/, 'standard backend must not receive SBERT configuration.');
  assert.doesNotMatch(backend, /sbert-service/, 'standard backend must not depend on SBERT.');
  assert.match(backend, /NODE_ENV:\s*\$\{NODE_ENV:-production\}/, 'standard Compose must default the serving backend to production mode.');
  assert.match(backend, /CORS_ORIGIN:\s*\$\{CORS_ORIGIN:-\}/, 'standard Compose must not inject a development CORS origin into production mode.');
  assert.match(backend, /TRUST_PROXY:\s*\$\{TRUST_PROXY:\?/, 'backend must require an explicit reviewed production trust-proxy configuration.');
  assert.match(backend, /VOYAGE_API_KEY:/, 'backend must receive its runtime Voyage credential.');
  assert.match(backend, /SMTP_PASSWORD:/, 'backend must receive runtime SMTP secret configuration.');
  assert.match(backend, /BULK_HASH_CONCURRENCY:/, 'backend must receive the bounded bulk-hashing capacity setting.');
  assert.match(backend, /SHUTDOWN_GRACE_PERIOD_MS:/, 'backend must receive its bounded shutdown grace period.');
  assert.match(backend, /api\/v1\/health/, 'backend Compose healthcheck must use liveness.');
  assert.match(backend, /stop_grace_period:\s*330s/, 'backend must leave time beyond the application shutdown grace period.');
  assert.match(backend, /restart:\s*unless-stopped/, 'backend initial single instance must restart predictably.');
  assert.match(migration, /profiles:\s*\["maintenance"\]/, 'migration service must remain operator-only.');
  assertNoPublishedPorts(migration, 'migration service');
  assert.match(migration, /target:\s*migration/, 'migration service must use the pinned migration image target.');
  assert.match(bootstrap, /profiles:\s*\["maintenance"\]/, 'bootstrap service must remain operator-only.');
  assertNoPublishedPorts(bootstrap, 'bootstrap service');
  assert.match(bootstrap, /target:\s*bootstrap/, 'bootstrap service must use the dedicated non-serving image target.');
  assert.match(bootstrap, /TRUST_PROXY:\s*\$\{TRUST_PROXY:\?/, 'bootstrap must receive the same explicit production trust-proxy contract it validates.');

  assert.match(nginx, /listen\s+8080;/, 'frontend Nginx must use the unprivileged port.');
  assert.match(nginx, /resolver \$\{NGINX_LOCAL_RESOLVERS\} valid=10s/, 'frontend Nginx must dynamically resolve a recreated backend through the platform resolver detected at start.');
  assert.match(nginx, /location \/api\//, 'frontend Nginx must proxy same-origin API calls.');
  assert.match(nginx, /proxy_pass \$backend_upstream\$request_uri;/, 'frontend API proxy must preserve the request URI while resolving its backend dynamically.');
  assert.match(nginx, /try_files \$uri \$uri\/ \/index\.html;/, 'frontend Nginx must preserve SPA route fallback.');
  assert.match(nginx, /client_max_body_size\s+6m;/, 'frontend Nginx must leave multipart envelope room above the backend 5 MiB file limit.');
  assert.match(nginx, /proxy_send_timeout\s+\$\{PROXY_TIMEOUT\};/, 'frontend Nginx must take its long-request send timeout from deployment configuration.');
  assert.match(nginx, /proxy_read_timeout\s+\$\{PROXY_TIMEOUT\};/, 'frontend Nginx must take its long-request read timeout from deployment configuration.');
  assert.match(nginx, /X-Forwarded-Proto \$public_forwarded_proto/, 'frontend Nginx must preserve the trusted upstream HTTPS protocol signal.');
  assert.match(nginx, /location \^~ \/assets\//, 'frontend Nginx must cache hashed static assets separately from HTML.');
  assert.match(nginx, /Cache-Control "no-store"/, 'frontend Nginx must prevent API and HTML caching.');

  assert.match(frontendDockerfile, /nginxinc\/nginx-unprivileged/, 'frontend image must use an unprivileged Nginx runtime.');
  assert.match(frontendDockerfile, /USER nginx/, 'frontend image must explicitly run as nginx.');
  assert.match(frontendDockerfile, /EXPOSE 8080/, 'frontend image port must match Compose.');
  assert.match(frontendDockerignore, /^\.env$/m, 'frontend build context must exclude .env.');
  assert.match(frontendDockerignore, /^\.env\.\*$/m, 'frontend build context must exclude environment variants.');

  // ---------------------------------------------------------------------------
  // Provider adapter: the frontend must reach its backend through deployment
  // configuration, never through a hostname baked into the image.
  // ---------------------------------------------------------------------------
  assert.match(nginx, /set \$backend_upstream http:\/\/\$\{BACKEND_UPSTREAM\};/, 'frontend Nginx upstream must be environment-driven.');
  assert.match(frontendDockerfile, /COPY nginx\.conf\.template \/etc\/nginx\/templates\/default\.conf\.template/, 'frontend image must render its server config from a template at start.');
  assert.match(frontendDockerfile, /ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1/, 'frontend image must detect the platform resolver so a replaced backend is re-resolved.');
  assert.match(frontendDockerfile, /ENV NGINX_ENVSUBST_FILTER=/, 'frontend image must restrict substitution so Nginx runtime variables survive templating.');
  assert.match(frontendDockerfile, /ENV BACKEND_UPSTREAM=backend:3000/, 'frontend image default upstream must keep local Compose acceptance working unchanged.');

  const envsubstFilter = frontendDockerfile.match(/ENV NGINX_ENVSUBST_FILTER="([^"]+)"/);
  assert.ok(envsubstFilter, 'the envsubst filter must be explicitly defined.');
  for (const required of ['BACKEND_UPSTREAM', 'NGINX_LOCAL_RESOLVERS', 'PROXY_TIMEOUT', 'BACKEND_RESOLVER_FLAGS']) {
    assert.ok(envsubstFilter[1].includes(required), `envsubst filter must substitute ${required}.`);
  }

  // Every hop must tolerate the measured long administrative request. Runtime
  // acceptance established 600 seconds as the floor, so assert the floor rather
  // than a specific string that could silently regress.
  const HOSTED_REQUEST_BUDGET_SECONDS = 600;
  const proxyTimeout = frontendDockerfile.match(/ENV PROXY_TIMEOUT=(\d+)s/);
  assert.ok(proxyTimeout, 'the frontend image must define a default proxy timeout in seconds.');
  assert.ok(
    Number(proxyTimeout[1]) >= HOSTED_REQUEST_BUDGET_SECONDS,
    `frontend proxy timeout must be at least ${HOSTED_REQUEST_BUDGET_SECONDS}s for the measured bulk-onboarding request; found ${proxyTimeout[1]}s.`
  );

  // No platform-generated hostname may be baked into the image, the template,
  // Compose, or the Blueprint.
  for (const [label, content] of [
    ['frontend Nginx template', nginx],
    ['frontend Dockerfile', frontendDockerfile],
    ['Compose', compose],
    ['Render Blueprint', renderBlueprint]
  ]) {
    assert.doesNotMatch(content, /[a-z0-9-]+\.onrender\.com/i, `${label} must not hardcode a generated Render hostname.`);
  }

  // ---------------------------------------------------------------------------
  // Render Blueprint contract.
  // ---------------------------------------------------------------------------
  assert.match(renderBlueprint, /type:\s*pserv\s*\n\s*name:\s*rtadss-staging-backend/, 'the backend must be declared as a Render private service with no public URL.');
  assert.doesNotMatch(renderBlueprint, /type:\s*web\s*\n\s*name:\s*rtadss-staging-backend/, 'the backend must never be declared as a public web service.');
  assert.match(renderBlueprint, /fromDatabase:\s*\n\s*name:\s*rtadss-staging-db\s*\n\s*property:\s*connectionString/, 'DATABASE_URL must come from the managed database internal connection string.');
  assert.match(renderBlueprint, /fromService:\s*\n\s*name:\s*rtadss-staging-backend\s*\n\s*type:\s*pserv\s*\n\s*property:\s*hostport/, 'the frontend upstream must use a service reference, not a discovery name.');
  assert.match(renderBlueprint, /preDeployCommand:\s*npm run prisma:migrate:deploy/, 'hosted migrations must use the pinned migrate deploy command.');
  assert.doesNotMatch(renderBlueprint, /db push|migrate dev/, 'hosted migrations must never use db push or migrate dev.');
  // Render supports HTTP health checks on type:web only and rejects the field
  // on a private service, which health-checks over TCP instead. The private
  // backend must therefore declare no health check path at all — and readiness
  // must never become a platform restart probe on any service.
  const backendBlock = renderBlueprint.slice(renderBlueprint.indexOf('- type: pserv'), renderBlueprint.indexOf('- type: web'));
  assert.doesNotMatch(backendBlock, /healthCheckPath:/, 'a Render private service must not declare a health check path.');
  assert.doesNotMatch(renderBlueprint, /healthCheckPath:\s*\/api\/v1\/readiness/, 'readiness must not be used as the platform restart probe.');
  assert.match(renderBlueprint, /autoDeployTrigger:\s*off/, 'auto deploy must stay disabled while long synchronous admin operations can outlive the shutdown window.');
  assert.doesNotMatch(renderBlueprint, /^\s*autoDeploy:/m, 'the deprecated autoDeploy field must not be used.');

  // Removing the platform HTTP probe must never remove the application's own
  // liveness and readiness contract.
  assert.match(serverRoutes, /app\.get\('\/api\/v1\/health'/, 'the application must retain its liveness endpoint.');
  assert.match(serverRoutes, /app\.get\('\/api\/v1\/readiness'/, 'the application must retain its readiness endpoint.');
  assert.doesNotMatch(renderBlueprint, /sbert|SBERT|fastapi|FastAPI/, 'hosted staging must carry no SBERT or FastAPI semantic dependency.');
  assert.match(renderBlueprint, /ipAllowList:\s*\[\]/, 'the staging database must not accept public ingress.');

  // The Blueprint must name its secrets without ever carrying their values.
  for (const secretKey of ['VOYAGE_API_KEY', 'SMTP_PASSWORD', 'TRUST_PROXY', 'FRONTEND_URL']) {
    const declaration = new RegExp(`key:\\s*${secretKey}\\s*\\n\\s*sync:\\s*false`);
    assert.match(renderBlueprint, declaration, `${secretKey} must be declared as a value supplied outside Git.`);
  }
  assert.match(renderBlueprint, /key:\s*JWT_SECRET\s*\n\s*generateValue:\s*true/, 'the staging JWT secret must be generated by the platform, not committed.');
  assert.doesNotMatch(renderBlueprint, /\bpa-[A-Za-z0-9_-]{20,}/, 'the Blueprint must never contain a Voyage credential.');
  assert.doesNotMatch(renderBlueprint, /postgres(?:ql)?:\/\/[^\s]*:[^\s@]+@/, 'the Blueprint must never contain a database URL with a password.');
  assert.match(frontendClient, /baseURL:\s*['"]\/api\/v1['"]/, 'frontend API client must keep a relative same-origin base URL.');
  assert.match(frontendSimilarity, /axios\.post\(['"]\/api\/similarity\/check['"]/, 'direct similarity must keep a relative same-origin endpoint.');
  assert.doesNotMatch(frontendClient, /localhost|https?:\/\//, 'frontend production client must not embed a backend host.');
  assert.match(landingPage, /voyage-4-large/, 'live landing content must describe the current Voyage provider.');
  assert.doesNotMatch(landingPage, /\b(?:Jaccard|TF-IDF|SBERT|FastAPI)\b/i, 'live landing content must not present legacy semantic providers or lexical fallback as current.');
  assert.match(backendDockerfile, /FROM node:20-bookworm-slim AS bootstrap/, 'backend must provide a dedicated bootstrap target.');
  assert.match(backendDockerfile, /CMD \["migrate", "deploy"\]/, 'migration target must run the pinned migrate deploy command.');
  assert.doesNotMatch(backendDockerfile, /npx prisma/, 'Docker build and migration paths must use the checked-out Prisma CLI rather than an arbitrary npx download.');
  assert.match(backendDockerfile, /USER app/, 'backend image targets must run as the non-root app user.');
  assert.match(backendDockerfile, /CMD \["node", "src\/server\.js"\]/, 'backend runtime must run Node directly as PID 1.');
  assert.match(backendDockerignore, /^\.env$/m, 'backend build context must exclude .env.');
  assert.match(backendDockerignore, /^\.env\.\*$/m, 'backend build context must exclude environment variants.');
  assert.doesNotMatch(backendDockerfile, /VOYAGE_API_KEY|JWT_SECRET|DATABASE_URL/, 'backend image instructions must not bake runtime secrets into layers.');
  assert.doesNotMatch(backendEnvExample, /SBERT_[A-Z_]+/, 'the current backend environment example must not advertise legacy SBERT runtime variables.');
  assert.doesNotMatch(compose, /prisma\/seed|seed-auth-demo/, 'standard Compose must not seed demo data.');

  assert.match(environmentConfig, /function normalizeNodeEnvironment/, 'backend must normalize and validate NODE_ENV before applying security defaults.');
  assert.match(environmentConfig, /NODE_ENV must be one of: development, test, production/, 'backend must reject unsupported runtime modes.');
  assert.match(environmentConfig, /required\.push\('FRONTEND_URL'\)/, 'production must require its explicit browser origin.');
  assert.match(environmentConfig, /parseBooleanEnv\(source\.CORS_CREDENTIALS, 'CORS_CREDENTIALS'\)/, 'CORS credentials must be strictly validated.');
  assert.match(environmentConfig, /if \(envValue\(source, 'BULK_HASH_CONCURRENCY'\) !== undefined\)/, 'bulk-hash override validation must remain optional when the CPU-derived default is used.');
  assert.match(environmentConfig, /'BULK_HASH_CONCURRENCY', 1, \{ min: 1, max: 8 \}/, 'explicit bulk-hash concurrency must be bounded to one through eight workers.');
  assert.match(environmentConfig, /'IMPORT_UPLOAD_LIMIT_BYTES', 5 \* 1024 \* 1024, \{ min: 1024, max: 5 \* 1024 \* 1024 \}/, 'backend import file limits must fit the standard Nginx ingress contract.');
  assert.match(environmentConfig, /max: 5 \* 60 \* 1000/, 'application shutdown drain must fit inside the fixed 330-second outer grace period.');
  assert.doesNotMatch(environmentConfig, /source\.NODE_ENV === 'production'/, 'raw NODE_ENV comparisons must not bypass production security rules.');
  assert.match(errorHandler, /function normalizedNodeEnvironment/, 'error handling must normalize NODE_ENV before deciding whether to expose error details.');
  assert.doesNotMatch(errorHandler, /process\.env\.NODE_ENV === 'production'/, 'error handling must not bypass production sanitization on casing/whitespace changes.');

  assert.equal(fs.existsSync(path.join(root, 'frontend', 'vercel.json')), false, 'legacy hard-coded Vercel/Render routing must not remain active.');
  assert.match(smoke, /Same-origin backend liveness/, 'smoke must exercise the API through the frontend origin.');
  assert.match(smoke, /Same-origin backend readiness/, 'smoke must verify semantic/database readiness through the frontend origin.');
  assert.match(smoke, /retryUntilReady: true/, 'smoke must tolerate Voyage readiness probe convergence before failing.');
  assert.match(smoke, /Authentication route is protected/, 'smoke must verify authentication route reachability.');
  assert.match(smoke, /Anonymous similarity is denied/, 'smoke must verify anonymous similarity denial.');
  assert.match(smoke, /expectedStatus: 401/, 'smoke must require an anonymous 401 response.');
  assert.match(smoke, /function parseFrontendOrigin/, 'smoke must sanitize malformed frontend URL errors before logging them.');
  assert.match(smoke, /FULLSTACK_FRONTEND_URL must be a bare http\(s\) origin/, 'smoke must reject a credential-bearing or path-bearing frontend URL before logging it.');
  assert.doesNotMatch(smoke, /SBERT health/, 'standard smoke must not require SBERT.');

  assert.match(releaseGate, /RELEASE_CHECK_LEGACY_SBERT/, 'legacy SBERT evaluation must be explicit opt-in, not a standard release dependency.');
  assert.match(releaseGate, /node_modules', '\.bin'/, 'release migration inspection must use the checked-out Prisma CLI.');
  assert.match(releaseGate, /Deployment contract verification/, 'the release gate must include the current deployment contract check.');
  assert.match(releaseGate, /docker', \['info'\]/, 'the release gate must distinguish an installed Docker CLI from an unavailable daemon.');

  console.log('PASS - static deployment contract');
} catch (error) {
  console.error(`FAIL - static deployment contract: ${error.message}`);
  process.exitCode = 1;
}
