# Local acceptance TLS edge (verification only)

This directory supports **local container acceptance testing only**. It is not a
hosting recommendation, not part of the supported production topology, and must
never be used to serve anything publicly.

## Why it exists

Production startup validation deliberately requires an `https://` browser origin
and issues `Secure` session cookies when `NODE_ENV=production`. That rule is
correct and must not be relaxed for local convenience. To exercise the real
production contract on a workstation, the right answer is to supply real local
TLS — which is what this edge does.

It reproduces the documented public chain:

```text
browser -> HTTPS edge -> frontend Nginx (SPA + /api proxy) -> private backend
```

With this edge in front, local verification runs with `NODE_ENV=production`,
`FRONTEND_URL=https://localhost:8443`, `TRUST_PROXY=2` (two real hops) and
`Secure` cookies intact.

## Generating the certificate

The certificate and key are **git-ignored and must never be committed**.

```bash
mkdir -p deploy/local-acceptance-tls/certs
openssl req -x509 -nodes -newkey rsa:2048 -days 30 \
  -keyout deploy/local-acceptance-tls/certs/edge.key \
  -out    deploy/local-acceptance-tls/certs/edge.crt \
  -subj "/CN=localhost/O=Local Acceptance Only" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
```

On Windows Git Bash, prefix with `MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*"` so
the `-subj` value is not rewritten into a filesystem path.

## Running

```powershell
docker compose -f docker-compose.yml -f docker-compose.acceptance.yml up -d
```

Then browse `https://localhost:8443/`. The certificate is self-signed, so clients
need to trust it explicitly — for Node-based checks set
`NODE_EXTRA_CA_CERTS` to `deploy/local-acceptance-tls/certs/edge.crt` rather than
disabling certificate verification.

## Note on the upstream resolver

`edge-nginx.conf` re-resolves `frontend` through Docker's embedded DNS using a
`resolver` directive and a variable upstream. Without that, Nginx pins the IP it
resolved at startup and returns 502 once the frontend container is recreated. The
production `frontend/nginx.conf` uses the same technique for the backend, and the
Compose contract notes that a non-Docker platform must supply an equivalent
service resolver.
