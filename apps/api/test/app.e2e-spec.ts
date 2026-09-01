import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from '../src/create-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('StockFlow API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const email = `e2e-${Date.now()}@stockflow.test`;
  const password = 'password123';
  const agent = { cookie: '' };

  beforeAll(async () => {
    // Boots through the same createApp() used in production (main.ts and
    // the Vercel serverless entrypoint), so these tests exercise the real
    // validation pipe, filters and CORS setup instead of a re-declared copy.
    app = await createApp();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.invoice.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    await app.close();
  });

  it('registers a new user', async () => {
    const res = await request(app.getHttpServer()).post('/auth/register').send({ email, password });
    expect(res.status).toBe(201);
    expect(res.body.email).toBe(email);
  });

  it('rejects login with a wrong password', async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({ email, password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for an unauthenticated request to a protected route', async () => {
    const res = await request(app.getHttpServer()).get('/products');
    expect(res.status).toBe(401);
  });

  it('logs in and returns a session cookie', async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    expect(setCookie).toBeDefined();
    agent.cookie = setCookie[0].split(';')[0];
  });

  let productId: string;

  it('creates a product', async () => {
    const res = await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', agent.cookie)
      .send({ sku: 'E2E-1', name: 'Test Product', unitPrice: 1000, quantityOnHand: 5 });
    expect(res.status).toBe(201);
    productId = res.body.id;
  });

  it('rejects an invoice that requests more than the available stock', async () => {
    const res = await request(app.getHttpServer())
      .post('/invoices')
      .set('Cookie', agent.cookie)
      .send({
        customerName: 'Acme Co',
        issueDate: '2026-01-01',
        dueDate: '2026-01-15',
        items: [{ productId, quantity: 999 }],
      });
    expect(res.status).toBe(400);
  });

  let invoiceId: string;

  it('issuing an invoice decrements stock correctly', async () => {
    const create = await request(app.getHttpServer())
      .post('/invoices')
      .set('Cookie', agent.cookie)
      .send({
        customerName: 'Acme Co',
        issueDate: '2026-01-01',
        dueDate: '2026-01-15',
        items: [{ productId, quantity: 2 }],
      });
    expect(create.status).toBe(201);
    invoiceId = create.body.id;

    const issue = await request(app.getHttpServer()).post(`/invoices/${invoiceId}/issue`).set('Cookie', agent.cookie);
    expect(issue.status).toBe(201);
    expect(issue.body.status).toBe('ISSUED');

    const product = await request(app.getHttpServer()).get(`/products/${productId}`).set('Cookie', agent.cookie);
    expect(product.body.quantityOnHand).toBe(3);
  });

  it('cancelling an issued invoice restores stock', async () => {
    const cancel = await request(app.getHttpServer()).post(`/invoices/${invoiceId}/cancel`).set('Cookie', agent.cookie);
    expect(cancel.status).toBe(201);
    expect(cancel.body.status).toBe('CANCELLED');

    const product = await request(app.getHttpServer()).get(`/products/${productId}`).set('Cookie', agent.cookie);
    expect(product.body.quantityOnHand).toBe(5);
  });

  it('rejects an illegal status transition (cancel a cancelled invoice)', async () => {
    const res = await request(app.getHttpServer()).post(`/invoices/${invoiceId}/cancel`).set('Cookie', agent.cookie);
    expect(res.status).toBe(409);
  });

  it('reports a non-empty field message for an invalid nested invoice item', async () => {
    const res = await request(app.getHttpServer())
      .post('/invoices')
      .set('Cookie', agent.cookie)
      .send({
        customerName: 'Acme Co',
        issueDate: '2026-01-01',
        dueDate: '2026-01-15',
        items: [{ productId, quantity: 0 }],
      });
    expect(res.status).toBe(422);
    const itemsError = res.body.errors.find((e: { field: string }) => e.field === 'items');
    expect(itemsError.messages.length).toBeGreaterThan(0);
  });

  it('only restores stock once when the same invoice is cancelled concurrently', async () => {
    const create = await request(app.getHttpServer())
      .post('/invoices')
      .set('Cookie', agent.cookie)
      .send({ customerName: 'Race Co', issueDate: '2026-01-01', dueDate: '2026-01-15', items: [{ productId, quantity: 2 }] });
    const raceInvoiceId = create.body.id;
    await request(app.getHttpServer()).post(`/invoices/${raceInvoiceId}/issue`).set('Cookie', agent.cookie);

    const [first, second] = await Promise.all([
      request(app.getHttpServer()).post(`/invoices/${raceInvoiceId}/cancel`).set('Cookie', agent.cookie),
      request(app.getHttpServer()).post(`/invoices/${raceInvoiceId}/cancel`).set('Cookie', agent.cookie),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);

    const product = await request(app.getHttpServer()).get(`/products/${productId}`).set('Cookie', agent.cookie);
    expect(product.body.quantityOnHand).toBe(5);
  });
});
