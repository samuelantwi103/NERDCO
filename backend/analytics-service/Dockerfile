# Build context: repository root
FROM node:22-alpine
RUN npm install -g pnpm

WORKDIR /app/backend

COPY backend/package.json backend/pnpm-lock.yaml backend/pnpm-workspace.yaml ./
COPY backend/tsconfig.base.json ./tsconfig.base.json
COPY backend/domain-types/package.json ./domain-types/
COPY backend/analytics-service/package.json ./analytics-service/

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY backend/domain-types/ ./domain-types/
COPY backend/analytics-service/ ./analytics-service/

RUN pnpm --filter @nerdco/domain-types build
RUN pnpm --filter analytics-service build

WORKDIR /app/backend/analytics-service
EXPOSE 3004
CMD ["node", "dist/index.js"]
