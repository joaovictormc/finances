import type { Queue } from "bullmq";
import { aiAnalysisQueue, billDetectorQueue, billingQueue, gamificationQueue } from "./queues";

/**
 * Horários no fuso de Brasília, não no do servidor: no Docker o relógio é
 * UTC, e "0 9 * * *" sem fuso disparava às 6h daqui.
 */
export const SCHEDULE_TZ = "America/Sao_Paulo";

type Schedule = { queue: Queue; id: string; pattern: string };

export const SCHEDULES: Schedule[] = [
  // Dia 1, 6h: insight do mês que acabou.
  { queue: aiAnalysisQueue, id: "fan-out-monthly-insights", pattern: "0 6 1 * *" },
  // 8h: previsão de estouro de orçamento (avisa antes do dia começar).
  { queue: aiAnalysisQueue, id: "fan-out-budget-forecasts", pattern: "0 8 * * *" },
  // 7h: detecção de contas recorrentes.
  { queue: billDetectorQueue, id: "fan-out-detect-recurring", pattern: "0 7 * * *" },
  // Segunda, 6h: resumo semanal da gamificação.
  { queue: gamificationQueue, id: "fan-out-weekly-recap", pattern: "0 6 * * 1" },
  // 9h: horário em que o admin consegue agir no mesmo dia sobre um Pix que
  // está pra vencer, diferente das varreduras da madrugada.
  { queue: billingQueue, id: "scan-pix-checkouts", pattern: "0 9 * * *" },
  // 8h: contas a pagar que vencem em 3 dias ou hoje.
  { queue: billingQueue, id: "send-bill-reminders", pattern: "0 8 * * *" },
  // 9h: assinatura Pix que vence em 5 dias ou hoje (Pix não renova sozinho).
  { queue: billingQueue, id: "send-pix-expiry-reminders", pattern: "0 9 * * *" },
];

/**
 * Registra os agendamentos a cada boot da API. `upsertJobScheduler` com id
 * fixo atualiza padrão e fuso no lugar, sem duplicar. Antes de registrar,
 * remove o que não está na lista: os agendamentos do formato antigo (criados
 * com `queue.add(..., { repeat })`, chave em hash e sem fuso) continuariam
 * disparando junto com os novos — cada rotina rodaria duas vezes.
 */
export async function registerRepeatableJobs() {
  const queues = [...new Set(SCHEDULES.map((s) => s.queue))];

  for (const queue of queues) {
    const wanted = new Set(SCHEDULES.filter((s) => s.queue === queue).map((s) => s.id));
    for (const existing of await queue.getJobSchedulers()) {
      if (existing.key && !wanted.has(existing.key)) {
        await queue.removeJobScheduler(existing.key);
        console.log(`[scheduler] removido agendamento obsoleto ${queue.name}:${existing.name ?? existing.key}`);
      }
    }
  }

  for (const { queue, id, pattern } of SCHEDULES) {
    await queue.upsertJobScheduler(id, { pattern, tz: SCHEDULE_TZ }, { name: id, data: {} });
  }
}
