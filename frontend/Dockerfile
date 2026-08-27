FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine

# The server config is a template rendered at container start, so the private
# backend address comes from the deployment rather than from the image. No
# platform-generated hostname is ever baked in.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

# Detect the container's own DNS servers from /etc/resolv.conf and expose them
# as NGINX_LOCAL_RESOLVERS for the template. This runs before the envsubst
# step, and keeps upstream re-resolution working on Docker's embedded DNS and
# on a hosted platform's internal DNS without naming either.
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1

# Substitute ONLY these names, so Nginx's own runtime variables survive.
ENV NGINX_ENVSUBST_FILTER="^(BACKEND_UPSTREAM|BACKEND_RESOLVER_FLAGS|PROXY_TIMEOUT|NGINX_LOCAL_RESOLVERS)$"

# Defaults reproduce the previously proven Compose behaviour exactly, so local
# acceptance needs no configuration change. A hosted deployment overrides
# BACKEND_UPSTREAM with its own internal service address.
ENV BACKEND_UPSTREAM=backend:3000
ENV BACKEND_RESOLVER_FLAGS=ipv6=off

# Runtime acceptance established that every hop must tolerate at least 600
# seconds for the measured ~324-second 650-account onboarding request. 660s
# keeps a deliberate margin above that floor.
ENV PROXY_TIMEOUT=660s

# The unprivileged Nginx image runs as its bundled nginx account. Keep the
# service on an unprivileged port so Compose can publish it without granting
# extra capabilities.
USER nginx
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=5 \
    CMD wget -q --spider http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
