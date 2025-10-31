// src/__tests__/setup.ts
// Configuration globale pour les tests Vitest

import { afterAll, beforeAll } from 'vitest';

beforeAll(() => {
  // Setup env vars pour les tests
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent'; // désactive les logs pino pendant les tests
});

afterAll(() => {
  // Cleanup si nécessaire
});
