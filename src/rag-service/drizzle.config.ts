import { defineConfig } from 'drizzle-kit';

if (!process.env.RAG_DATABASE_URL) {
  throw new Error('RAG_DATABASE_URL is required for Drizzle commands');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dbCredentials: { url: process.env.RAG_DATABASE_URL },
  strict: true,
  verbose: true,
});
