# Build context: repository root
FROM node:22-alpine
RUN npm install -g pnpm

WORKDIR /app/backend

# Workspace manifests
COPY backend/package.json backend/pnpm-lock.yaml backend/pnpm-workspace.yaml ./
COPY backend/tsconfig.base.json ./tsconfig.base.json
COPY backend/domain-types/package.json ./domain-types/
COPY backend/auth-service/package.json ./auth-service/

RUN pnpm install --frozen-lockfile --ignore-scripts

# Source
COPY backend/domain-types/ ./domain-types/
COPY backend/auth-service/ ./auth-service/

# Build shared types then service
RUN pnpm --filter @nerdco/domain-types build
RUN pnpm --filter auth-service build

WORKDIR /app/backend/auth-service
EXPOSE 3001
CMD ["node", "dist/index.js"]
