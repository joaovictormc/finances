import "./env";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./lib/auth";
import { telegramWebhookHandler } from "./routes/bots/telegram";
import transactionsRoute from "./routes/transactions";
import financialAccountsRoute from "./routes/financial-accounts";
import categoriesRoute from "./routes/categories";
import budgetsRoute from "./routes/budgets";
import goalsRoute from "./routes/goals";
import billsRoute from "./routes/bills";

// Start BullMQ workers
import "./jobs/workers/bot-messages.worker";
import "./jobs/workers/email.worker";

const app = new Hono();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: [
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "http://localhost:19006", // Expo web
    ],
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  })
);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (c) => c.json({ status: "ok", ts: new Date().toISOString() }));

// ── Better Auth handler (handles /api/auth/* requests) ────────────────────────
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// ── Bot webhooks ──────────────────────────────────────────────────────────────
app.post("/api/bots/telegram", telegramWebhookHandler);

// ── API routes ────────────────────────────────────────────────────────────────
app.route("/api/transactions", transactionsRoute);
app.route("/api/accounts", financialAccountsRoute);
app.route("/api/categories", categoriesRoute);
app.route("/api/budgets", budgetsRoute);
app.route("/api/goals", goalsRoute);
app.route("/api/bills", billsRoute);

// ── Start server (Node via @hono/node-server) ─────────────────────────────────
const port = parseInt(process.env.PORT ?? "3001");

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`🚀 API running on http://localhost:${info.port}`);
});
