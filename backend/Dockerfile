FROM node:22.22.2-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci --workspace=backend --omit=dev --include-workspace-root=false && npm cache clean --force

FROM node:22.22.2-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
COPY --from=dependencies /app /app
COPY --chown=node:node backend/src ./backend/src
COPY --chown=node:node backend/scripts ./backend/scripts
RUN mkdir -p /app/backend/uploads /app/backend/logs && chown -R node:node /app/backend/uploads /app/backend/logs
WORKDIR /app/backend
USER node
EXPOSE 5000
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 CMD ["node", "-e", "fetch('http://127.0.0.1:5000/api/v1/health',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "src/server.js"]
