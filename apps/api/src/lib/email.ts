import React from "react";
import * as Brevo from "@getbrevo/brevo";
import { emailQueue } from "../jobs/queues";

const emailClient = new Brevo.TransactionalEmailsApi();
emailClient.setApiKey(
  Brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY ?? ""
);

const EMAIL_FROM_NAME = "Financeiro";
const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS ?? "noreply@labapp.com.br";

export type EmailJob = {
  to: string;
  subject: string;
  template: string;
  data: Record<string, unknown>;
};

// Always enqueue — never send synchronously in a request handler
export async function sendEmail(job: EmailJob) {
  await emailQueue.add("send-email", job, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  });
}

// Called by the BullMQ worker
export async function deliverEmail(job: EmailJob) {
  // Em dev sem Brevo configurado, não tenta enviar (evita falhas/retries no worker).
  if (!process.env.BREVO_API_KEY) {
    console.warn(`[email] BREVO_API_KEY ausente — envio pulado: ${job.template} -> ${job.to}`);
    return;
  }

  const html = await renderEmailTemplate(job.template, job.data);

  const sendSmtpEmail = new Brevo.SendSmtpEmail();
  sendSmtpEmail.sender = { name: EMAIL_FROM_NAME, email: EMAIL_FROM_ADDRESS };
  sendSmtpEmail.to = [{ email: job.to }];
  sendSmtpEmail.subject = job.subject;
  sendSmtpEmail.htmlContent = html;

  await emailClient.sendTransacEmail(sendSmtpEmail);
}

async function renderEmailTemplate(
  template: string,
  data: Record<string, unknown>
): Promise<string> {
  const { renderAsync } = await import("@react-email/render");
  const templates: Record<string, () => Promise<{ default: unknown }>> = {
    "email-verification": () => import("../emails/email-verification"),
    welcome: () => import("../emails/welcome"),
    "bill-reminder": () => import("../emails/bill-reminder"),
    "budget-alert": () => import("../emails/budget-alert"),
    "ai-insight": () => import("../emails/ai-insight"),
  };

  const loader = templates[template];
  if (!loader) throw new Error(`Unknown email template: ${template}`);

  const mod = await loader();
  const Component = (mod as { default: React.FC<Record<string, unknown>> }).default;
  return renderAsync(Component(data) as React.ReactElement);
}
