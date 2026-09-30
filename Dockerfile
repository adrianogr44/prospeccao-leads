# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM base AS run
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL="file:/data/prospeccao.db"
COPY --from=build /app ./
VOLUME ["/data"]
EXPOSE 3000
# Aplica as migrações no banco do volume e sobe o servidor (o agendador e a fila iniciam junto).
CMD ["sh", "-c", "npx prisma migrate deploy && npm start -- -H 0.0.0.0 -p 3000"]
