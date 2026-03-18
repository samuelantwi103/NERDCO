# Build context: ./backend  (set in docker-compose.yml)
FROM node:22-alpine
RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY domain-types/package.json    ./domain-types/
COPY tracking-service/package.json ./tracking-service/

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY domain-types/    ./domain-types/
COPY tracking-service/ ./tracking-service/

RUN pnpm --filter @nerdco/domain-types build
RUN pnpm --filter tracking-service build

WORKDIR /app/tracking-service
EXPOSE 3003
CMD ["node", "dist/index.js"]
