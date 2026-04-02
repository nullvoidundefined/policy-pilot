FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY common/package.json common/
COPY server/package.json server/
COPY worker/package.json worker/
RUN pnpm install --frozen-lockfile --filter policy-pilot-common --filter policy-pilot-server --filter policy-pilot-worker --ignore-scripts

COPY common/ common/
RUN pnpm --filter policy-pilot-common run build

COPY server/ server/
RUN pnpm --filter policy-pilot-server run build

COPY worker/ worker/
RUN pnpm --filter policy-pilot-worker run build

# Production stage
FROM node:22-slim AS production
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY common/package.json common/
COPY server/package.json server/
COPY worker/package.json worker/
RUN pnpm install --frozen-lockfile --filter policy-pilot-common --filter policy-pilot-server --filter policy-pilot-worker --prod --ignore-scripts

COPY --from=base /app/common/dist common/dist
COPY --from=base /app/server/dist server/dist
COPY --from=base /app/worker/dist worker/dist
COPY server/migrations server/migrations

ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "server/dist/index.js"]
