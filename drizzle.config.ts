// Drizzle schema 仅用于对齐和查看后端真实表结构；迁移权威入口是 src/backend/app/infrastructure/db_schema.py。
export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://localhost:5432/bidmaster",
  },
};