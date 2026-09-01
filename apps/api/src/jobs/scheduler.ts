import { aiAnalysisQueue, billDetectorQueue, billingQueue, gamificationQueue } from "./queues";

// jobId fixo: BullMQ não duplica o repeat ao reexecutar isso em cada boot da API.
export async function registerRepeatableJobs() {
  await aiAnalysisQueue.add(
    "fan-out-monthly-insights",
    {},
    { repeat: { pattern: "0 6 1 * *" }, jobId: "fan-out-monthly-insights" }
  );
  await aiAnalysisQueue.add(
    "fan-out-budget-forecasts",
    {},
    { repeat: { pattern: "0 8 * * *" }, jobId: "fan-out-budget-forecasts" }
  );
  await billDetectorQueue.add(
    "fan-out-detect-recurring",
    {},
    { repeat: { pattern: "0 7 * * *" }, jobId: "fan-out-detect-recurring" }
  );
  await gamificationQueue.add(
    "fan-out-weekly-recap",
    {},
    { repeat: { pattern: "0 6 * * 1" }, jobId: "fan-out-weekly-recap" }
  );
  // 9h: horário em que o admin consegue agir no mesmo dia sobre um Pix que
  // está pra vencer, diferente das varreduras da madrugada.
  await billingQueue.add(
    "scan-pix-checkouts",
    {},
    { repeat: { pattern: "0 9 * * *" }, jobId: "scan-pix-checkouts" }
  );
}
