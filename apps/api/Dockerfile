# Fastify API (PLAN §2.1, §7).
# Build context is the repository root. The API is TypeScript with tsconfig
# path aliases (@contracts/@ontology/@quality), so it runs under `tsx`.
FROM node:22-alpine

WORKDIR /app
RUN corepack enable

COPY . .
RUN pnpm install --frozen-lockfile

WORKDIR /app/apps/api
EXPOSE 3000

CMD ["pnpm", "exec", "tsx", "src/server.ts"]
