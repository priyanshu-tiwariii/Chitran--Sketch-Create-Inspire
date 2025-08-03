import { PrismaClient } from "../generated/client";


if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL was not found. The application must load it into the environment.');
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export * from "../generated/client";