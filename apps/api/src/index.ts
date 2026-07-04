import "./env";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./lib/auth";
import { enforcePasswordPolicy } from "./middleware/password-policy";
import { bootstrapAdmin } from "./lib/bootstrap-admin";
import { telegramWebhookHandler } from "./routes/bots/telegram";
import telegramLinkRoute from "./routes/bots/telegram-link";
import transactionsRoute from "./routes/transactions";
import financialAccountsRoute from "./routes/financial-accounts";
import categoriesRoute from "./routes/categories";
import budgetsRoute from "./routes/budgets";
import goalsRoute from "./routes/goals";
import billsRoute from "./routes/bills";
import pluggyRoute from "./routes/pluggy";
import pluggyWebhookRoute from "./routes/webhooks/pluggy";
import aiRoute from "./routes/ai";
import groupsRoute from "./routes/groups";
import billingRoute from "./routes/billing";
import mercadopagoWebhookRoute from "./routes/webhooks/mercadopago";
import reportsRoute from "./routes/reports";
import referralsRoute from "./routes/referrals";
import adminRoute from "./routes/admin";
import settingsRoute from "./routes/settings";
import userRoute from "./routes/user";
import { registerRepeatableJobs } from "./jobs/scheduler";

// Start BullMQ workers
import "./jobs/workers/bot-messages.worker";
import "./jobs/workers/email.worker";
import "./jobs/workers/voice-transcription.worker";
import "./jobs/workers/open-finance-sync.worker";
import "./jobs/workers/ai-analysis.worker";
import "./jobs/workers/bill-detector.worker";

const app = new Hono();

// Origens de LAN (IP local da máquina) usadas pelo Expo web/nativo — mesma
// lista usada em trustedOrigins (lib/auth.ts), que muda quando o IP da rede muda.
const LAN_ORIGINS = (process.env.LAN_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: [
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "http://localhost:19006", // Expo web (SDK antigo)
      "http://localhost:8081", // Expo web (SDK 54+)
      ...LAN_ORIGINS,
    ],
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  })
);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (c) => c.json({ status: "ok", ts: new Date().toISOString() }));

// ── Better Auth handler (handles /api/auth/* requests) ────────────────────────
app.use("/api/auth/*", enforcePasswordPolicy);
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// ── Bot webhooks ──────────────────────────────────────────────────────────────
app.post("/api/bots/telegram", telegramWebhookHandler);

// ── Telegram account linking (web → bot) ──────────────────────────────────────
app.route("/api/bots/telegram", telegramLinkRoute);

// ── API routes ────────────────────────────────────────────────────────────────
app.route("/api/transactions", transactionsRoute);
app.route("/api/accounts", financialAccountsRoute);
app.route("/api/categories", categoriesRoute);
app.route("/api/budgets", budgetsRoute);
app.route("/api/goals", goalsRoute);
app.route("/api/bills", billsRoute);
app.route("/api/pluggy", pluggyRoute);
app.route("/api/webhooks/pluggy", pluggyWebhookRoute);
app.route("/api/ai", aiRoute);
app.route("/api/groups", groupsRoute);
app.route("/api/billing", billingRoute);
app.route("/api/webhooks/mercadopago", mercadopagoWebhookRoute);
app.route("/api/reports", reportsRoute);
app.route("/api/referrals", referralsRoute);
app.route("/api/admin", adminRoute);
app.route("/api/settings", settingsRoute);
app.route("/api/user", userRoute);

app.onError((err, c) => {
  console.error("[api] erro não tratado:", err);
  return c.json({ error: err instanceof Error ? err.message : "Erro interno" }, 500);
});

// ── Start server (Node via @hono/node-server) ─────────────────────────────────
const port = parseInt(process.env.PORT ?? "3001");

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`🚀 API running on http://localhost:${info.port}`);
  void bootstrapAdmin(info.port);
  void registerRepeatableJobs();
});
