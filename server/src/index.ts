import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";

import { corsConfig } from "app/config/corsConfig.js";
import { isProduction } from "app/config/env.js";
import pool, { query } from "app/db/pool/pool.js";
import { csrfGuard } from "app/middleware/csrfGuard/csrfGuard.js";
import { errorHandler } from "app/middleware/errorHandler/errorHandler.js";
import { notFoundHandler } from "app/middleware/notFoundHandler/notFoundHandler.js";
import { rateLimiter } from "app/middleware/rateLimiter/rateLimiter.js";
import { requestLogger } from "app/middleware/requestLogger/requestLogger.js";
import { loadSession } from "app/middleware/requireAuth/requireAuth.js";
import { authRouter } from "app/routes/auth.js";
import { conversationRouter } from "app/routes/conversations.js";
import { documentRouter } from "app/routes/documents.js";
import { qaRouter } from "app/routes/qa.js";
import { logger } from "app/utils/logs/logger.js";

function validateEnv(): void {
  if (!process.env.DATABASE_URL) {
    console.error("Fatal: DATABASE_URL is required");
    process.exit(1);
  }
  if (isProduction() && !process.env.CORS_ORIGIN) {
    console.error("Fatal: CORS_ORIGIN is required in production");
    process.exit(1);
  }
}

const app = express();
const REQUEST_TIMEOUT_MS = 60_000; // 60s for streaming responses

app.set("trust proxy", 1);

app.use(helmet());
app.use(corsConfig);
app.use(requestLogger);
app.use(rateLimiter);
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());
app.use(csrfGuard);
app.use(loadSession);

app.use((_req, res, next) => {
  res.setTimeout(REQUEST_TIMEOUT_MS, () => {
    if (!res.headersSent) {
      res.status(408).json({ error: { message: "Request timeout" } });
    }
  });
  next();
});

query("SELECT NOW()")
  .then(() => logger.info("Connected to database"))
  .catch((err: unknown) => logger.error({ err }, "Database connection failed"));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/health/ready", async (_req, res) => {
  try {
    await query("SELECT 1");
    res.status(200).json({ status: "ok", db: "connected" });
  } catch {
    res.status(503).json({ status: "degraded", db: "disconnected" });
  }
});

app.use("/auth", authRouter);
app.use("/documents", documentRouter);
app.use("/qa", qaRouter);
app.use("/conversations", conversationRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3001;
const HOST = "0.0.0.0";

const entryPath = process.argv[1];
const isEntryModule =
  entryPath !== undefined &&
  path.resolve(entryPath) === path.resolve(fileURLToPath(import.meta.url));

if (isEntryModule) {
  validateEnv();

  pool.on("error", (err) => {
    logger.error({ err }, "Unexpected idle-client error in pg pool");
  });

  process.on("uncaughtException", (err) => {
    logger.fatal({ err }, "Uncaught exception – shutting down");
    logger.flush();
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    logger.fatal({ reason }, "Unhandled rejection – shutting down");
    logger.flush();
    process.exit(1);
  });

  const server = app.listen(PORT, HOST, () => logger.info({ port: PORT }, "Server running"));

  async function shutdown(signal: string) {
    logger.info({ signal }, "Shutting down gracefully");
    await new Promise<void>((resolve) => server.close(() => resolve()));
    logger.info("HTTP server closed");
    await pool.end();
    process.exit(0);
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
