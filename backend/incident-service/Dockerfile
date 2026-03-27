# Build context: repository root
FROM node:22-alpine
RUN npm install -g pnpm

WORKDIR /app/backend

COPY backend/package.json backend/pnpm-lock.yaml backend/pnpm-workspace.yaml ./
COPY backend/tsconfig.base.json ./tsconfig.base.json
COPY backend/domain-types/package.json ./domain-types/
COPY backend/incident-service/package.json ./incident-service/

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY backend/domain-types/ ./domain-types/
COPY backend/incident-service/ ./incident-service/

RUN pnpm --filter @nerdco/domain-types build
RUN pnpm --filter incident-service build

WORKDIR /app/backend/incident-service
EXPOSE 3002
CMD ["node", "dist/index.js"]
