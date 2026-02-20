import { PrismaClient } from '@prisma/client';

let prisma;

if (typeof globalThis.__prisma === 'undefined') {
    globalThis.__prisma = new PrismaClient();
}
prisma = globalThis.__prisma;

export default prisma;
