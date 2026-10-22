# Image de l'API FlowOps : Cloud Run en production, et installation en entreprise.
# Construite depuis la racine du dépôt (workspaces npm) : docker build -t flowops-api .
# Configuration par variables d'environnement : voir apps/api/.env.example.

# --- Build : dépendances complètes, client Prisma, bundle esbuild ---
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/
RUN npm ci --workspace api --workspace @flowops/shared --include-workspace-root=false
COPY packages/shared/src packages/shared/src
COPY apps/api/src apps/api/src
COPY apps/api/build.mjs apps/api/
# Explicite : ne dépend pas des scripts d'installation autorisés par npm
RUN npm run db:generate -w api && npm run build -w api

# --- Dépendances de production seules : ni Prisma CLI, ni esbuild, ni outils de test ---
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
# --legacy-peer-deps : @prisma/client déclare le CLI prisma comme pair, ce qui tirerait aussi
# Prisma Studio et React (331 Mo au lieu de 90). Le client n'en a pas besoin à l'exécution.
RUN npm ci --omit=dev --ignore-scripts --legacy-peer-deps --workspace api \
    --include-workspace-root=false \
  && mkdir -p apps/api/node_modules

# --- Exécution ---
FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
# Paquets remontés à la racine, et ceux que npm garde dans le workspace (versions différentes)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
WORKDIR /app/apps/api
USER node
# Cloud Run fournit PORT (8080 par défaut)
ENV PORT=8080
EXPOSE 8080
CMD ["node", "--enable-source-maps", "dist/index.js"]
