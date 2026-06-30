FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages packages
RUN pnpm install --filter @taskflow/api... --frozen-lockfile=false

FROM deps AS build
COPY apps/api apps/api
RUN pnpm --filter @taskflow/api prisma:generate
RUN pnpm --filter @taskflow/api build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/apps/api/node_modules apps/api/node_modules
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
