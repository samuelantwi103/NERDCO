# Build context: ./backend  (set in docker-compose.yml)
FROM node:22-alpine
RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY domain-types/package.json    ./domain-types/
COPY incident-service/package.json ./incident-service/

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY domain-types/    ./domain-types/
COPY incident-service/ ./incident-service/

RUN pnpm --filter @nerdco/domain-types build
RUN pnpm --filter incident-service build

WORKDIR /app/incident-service
EXPOSE 3002
CMD ["node", "dist/index.js"]
