import { loadConfig, readinessFromConfig } from './config.js';
import { createDatabase } from './db/client.js';
import { DrizzleKnowledgeBaseRepository } from './db/knowledge-base-repository.js';
import { startServer } from './http.js';
import { KnowledgeBaseHttpController } from './knowledge-base-controller.js';
import { RagHttpController } from './rag-http.js';
import { ZillizVectorStore } from './vector/zilliz-vector-store.js';
import { InMemoryVectorStore } from './vector-store.js';

const config = loadConfig();
const database = config.RAG_DATABASE_URL ? createDatabase(config.RAG_DATABASE_URL) : undefined;
const zillizStore = config.ZILLIZ_URI && (config.ZILLIZ_TOKEN || (config.ZILLIZ_USERNAME && config.ZILLIZ_PASSWORD))
  ? new ZillizVectorStore({
      uri: config.ZILLIZ_URI,
      username: config.ZILLIZ_USERNAME,
      password: config.ZILLIZ_PASSWORD,
      token: config.ZILLIZ_TOKEN,
      database: config.ZILLIZ_DB_NAME,
    })
  : undefined;
const server = startServer({
  token: config.RAG_INTERNAL_TOKEN,
  vectorStore: new InMemoryVectorStore(),
  knowledgeBases: database
    ? new KnowledgeBaseHttpController(new DrizzleKnowledgeBaseRepository(database.db))
    : undefined,
  rag: zillizStore ? new RagHttpController(config, zillizStore) : undefined,
  readiness: () => readinessFromConfig(config),
  port: config.PORT,
  host: config.HOST,
});

async function shutdown(): Promise<void> {
  server.close();
  if (database) await database.pool.end();
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
