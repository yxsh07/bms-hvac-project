# Sim Console (PLAN §6.8). Vite build served by nginx.
FROM node:22-alpine AS build

WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter apps-sim-console build

FROM nginx:1.27-alpine AS runner
COPY --from=build /app/apps/sim-console/dist /usr/share/nginx/html
EXPOSE 80
