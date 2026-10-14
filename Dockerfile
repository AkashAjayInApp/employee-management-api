# Small, maintained base image. Pin the major version so builds are reproducible.
FROM node:22-alpine

ENV NODE_ENV=production

# Pull in OS security fixes released since the base image was published
# (e.g. zlib CVE fixes) instead of waiting for a new node:22-alpine tag.
RUN apk upgrade --no-cache

WORKDIR /app

# Copy only the dependency manifests first so this layer is cached
# and dependencies are reinstalled only when package*.json changes.
COPY package*.json ./
# Install production dependencies, then remove npm/corepack: the app runs with
# plain `node`, and npm's own bundled packages are a source of CVEs at runtime.
RUN npm ci --omit=dev && npm cache clean --force \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
              /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

COPY src ./src

# AWS RDS certificate bundle, so the app can verify the database's TLS certificate.
ADD --chmod=644 https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /app/rds-global-bundle.pem

# The official node image ships a non-root "node" user. Run as that, not root.
USER node

EXPOSE 8080

# Container-level health check (used by `docker ps` and the ECS task definition).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/health || exit 1

# Exec form so node is PID 1 and receives SIGTERM directly from ECS.
CMD ["node", "src/server.js"]
