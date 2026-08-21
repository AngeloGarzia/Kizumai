# syntax=docker/dockerfile:1.7
FROM node:22.14.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27.4-alpine AS runtime
RUN adduser -D -H -u 1001 -s /sbin/nologin kizumai \
  && chown -R kizumai:kizumai /var/cache/nginx /var/log/nginx /etc/nginx/conf.d \
  && touch /var/run/nginx.pid && chown kizumai:kizumai /var/run/nginx.pid

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

USER kizumai
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
