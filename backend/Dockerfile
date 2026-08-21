# syntax=docker/dockerfile:1.7
FROM node:22.14.0-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22.14.0-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN groupadd --gid 1001 kizumai \
  && useradd --uid 1001 --gid kizumai --shell /usr/sbin/nologin --create-home kizumai \
  && apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates tini \
  && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY src ./src

RUN mkdir -p /app/uploads && chown -R kizumai:kizumai /app

USER kizumai
EXPOSE 3001
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "src/server.js"]
