# Build context: repository root
FROM node:22-alpine
RUN npm install -g pnpm

WORKDIR /app/backend

COPY backend/package.json backend/pnpm-lock.yaml backend/pnpm-workspace.yaml ./
COPY backend/tsconfig.base.json ./tsconfig.base.json
COPY backend/domain-types/package.json ./domain-types/
COPY backend/tracking-service/package.json ./tracking-service/

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY backend/domain-types/ ./domain-types/
COPY backend/tracking-service/ ./tracking-service/

RUN pnpm --filter @nerdco/domain-types build
RUN pnpm --filter tracking-service build

WORKDIR /app/backend/tracking-service
EXPOSE 3003
CMD ["node", "dist/index.js"]
