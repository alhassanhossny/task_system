FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages packages
RUN pnpm install --filter @taskflow/web... --frozen-lockfile=false

FROM deps AS build
COPY apps/web apps/web
RUN pnpm --filter @taskflow/web build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/apps/web/node_modules apps/web/node_modules
COPY --from=build /app/apps/web/.next apps/web/.next
COPY --from=build /app/apps/web/public apps/web/public
COPY apps/web/package.json apps/web/package.json
COPY package.json pnpm-workspace.yaml ./
EXPOSE 3000
CMD ["pnpm", "--dir", "apps/web", "start"]
