import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@stockflow.dev';
const DEMO_PASSWORD = 'password123';

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: { email: DEMO_EMAIL, passwordHash },
  });

  const products = [
    { sku: 'WDG-001', name: 'Widget', description: 'Standard widget', unitPrice: 15000, quantityOnHand: 100 },
    { sku: 'GDG-002', name: 'Gadget', description: 'Premium gadget', unitPrice: 45000, quantityOnHand: 40 },
    { sku: 'BLT-003', name: 'Bolt (box of 100)', description: null, unitPrice: 8000, quantityOnHand: 250 },
    { sku: 'SCR-004', name: 'Screwdriver Set', description: '6-piece set', unitPrice: 32000, quantityOnHand: 15 },
    { sku: 'CBL-005', name: 'USB-C Cable 1m', description: null, unitPrice: 12000, quantityOnHand: 0 },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { userId_sku: { userId: user.id, sku: product.sku } },
      update: {},
      create: { ...product, userId: user.id },
    });
  }

  console.log(`Seeded demo user: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
