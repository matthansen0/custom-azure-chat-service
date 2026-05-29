FROM node:22-bookworm-slim AS build
WORKDIR /workspace

COPY package*.json ./
COPY tsconfig.base.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json

RUN npm install

COPY apps/backend apps/backend

RUN npm run build --workspace @chat/backend

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json

RUN npm install --omit=dev

COPY --from=build /workspace/apps/backend/dist ./apps/backend/dist

WORKDIR /app/apps/backend
EXPOSE 8080
CMD ["node", "dist/index.js"]