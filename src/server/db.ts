import { PrismaClient } from "@prisma/client";

// Singleton em globalThis: sobrevive ao hot reload do Next em desenvolvimento.
const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

export const db = globalForPrisma.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.__prisma = db;
