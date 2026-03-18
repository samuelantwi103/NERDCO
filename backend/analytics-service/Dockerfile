# Build context: ./backend  (set in docker-compose.yml)
FROM node:22-alpine
RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY domain-types/package.json     ./domain-types/
COPY analytics-service/package.json ./analytics-service/

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY domain-types/     ./domain-types/
COPY analytics-service/ ./analytics-service/

RUN pnpm --filter @nerdco/domain-types build
RUN pnpm --filter analytics-service build

WORKDIR /app/analytics-service
EXPOSE 3004
CMD ["node", "dist/index.js"]
