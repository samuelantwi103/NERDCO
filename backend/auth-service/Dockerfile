# Build context: ./backend  (set in docker-compose.yml)
FROM node:22-alpine
RUN npm install -g pnpm

WORKDIR /app

# Workspace manifests
COPY package.json pnpm-workspace.yaml ./
COPY domain-types/package.json  ./domain-types/
COPY auth-service/package.json  ./auth-service/

RUN pnpm install --frozen-lockfile --ignore-scripts

# Source
COPY domain-types/  ./domain-types/
COPY auth-service/  ./auth-service/

# Build shared types then service
RUN pnpm --filter @nerdco/domain-types build
RUN pnpm --filter auth-service build

WORKDIR /app/auth-service
EXPOSE 3001
CMD ["node", "dist/index.js"]
