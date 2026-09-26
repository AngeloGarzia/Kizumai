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
  && apt-get install -y --no-install-recommends ca-certificates curl tini \
  && mkdir -p /app/tessdata \
  && curl -fsSL -o /app/tessdata/eng.traineddata \
       https://github.com/tesseract-ocr/tessdata_fast/raw/main/eng.traineddata \
  && curl -fsSL -o /app/tessdata/fra.traineddata \
       https://github.com/tesseract-ocr/tessdata_fast/raw/main/fra.traineddata \
  && rm -rf /var/lib/apt/lists/*

ENV TESSDATA_PATH=/app/tessdata

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY src ./src
COPY scripts ./scripts

RUN mkdir -p /app/uploads && chown -R kizumai:kizumai /app /app/tessdata

USER kizumai
EXPOSE 3001
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "src/server.js"]
