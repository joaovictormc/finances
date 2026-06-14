import React from "react";
import { Resend } from "resend";
import { emailQueue } from "../jobs/queues";

const resend = new Resend(process.env.RESEND_API_KEY);

type EmailJob = {
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
  const html = await renderEmailTemplate(job.template, job.data);
  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Financeiro <noreply@labapp.com.br>",
    to: job.to,
    subject: job.subject,
    html,
  });
}

async function renderEmailTemplate(
  template: string,
  data: Record<string, unknown>
): Promise<string> {
  // Templates are React Email components rendered server-side
  // Import dynamically to avoid loading all templates on startup
  const { renderAsync } = await import("@react-email/render");
  const templates: Record<string, () => Promise<{ default: unknown }>> = {
    "email-verification": () => import("../emails/email-verification"),
    welcome: () => import("../emails/welcome"),
    "bill-reminder": () => import("../emails/bill-reminder"),
    "budget-alert": () => import("../emails/budget-alert"),
  };

  const loader = templates[template];
  if (!loader) throw new Error(`Unknown email template: ${template}`);

  const mod = await loader();
  const Component = (mod as { default: React.FC<Record<string, unknown>> }).default;
  return renderAsync(Component(data) as React.ReactElement);
}

// Re-export resend client for direct use when needed
export { resend };
