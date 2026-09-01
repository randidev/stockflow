import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Express } from 'express';
import { createApp } from '../src/create-app.js';

// Reused across warm invocations of the same serverless instance.
let expressAppPromise: Promise<Express> | undefined;

async function getExpressApp() {
  if (!expressAppPromise) {
    expressAppPromise = createApp().then(async (app) => {
      await app.init();
      return app.getHttpAdapter().getInstance();
    });
  }
  return expressAppPromise;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const expressApp = await getExpressApp();
  expressApp(req, res);
}
