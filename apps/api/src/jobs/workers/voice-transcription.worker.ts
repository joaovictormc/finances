import { Worker, type Job } from "bullmq";
import { redis } from "../../lib/redis";
import { bot } from "../../routes/bots/telegram";
import { transcribeAudio } from "../../lib/ai/voice-transcriber";
import { processIncomingText } from "../../lib/bot/process-message";

type VoiceJob = {
  platform: "telegram" | "whatsapp";
  platformChatId: string;
  userId: string;
  fileId: string;
  duration: number;
  today: string;
};

export const voiceTranscriptionWorker = new Worker<VoiceJob>(
  "voice-transcription",
  async (job: Job<VoiceJob>) => {
    const { platform, platformChatId, userId, fileId, today } = job.data;
    if (platform !== "telegram") return;

    const chatId = parseInt(platformChatId);

    try {
      const file = await bot.api.getFile(fileId);
      if (!file.file_path) {
        await bot.api.sendMessage(chatId, "⚠️ Não consegui acessar o áudio. Tente novamente.");
        return;
      }

      const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
      const res = await fetch(fileUrl);
      if (!res.ok) {
        await bot.api.sendMessage(chatId, "⚠️ Não consegui baixar o áudio. Tente novamente.");
        return;
      }
      const audio = Buffer.from(await res.arrayBuffer());

      const transcript = await transcribeAudio(audio, "audio.ogg");
      if (!transcript) {
        await bot.api.sendMessage(
          chatId,
          "🤔 Não consegui entender o áudio. Pode tentar de novo ou escrever a mensagem?"
        );
        return;
      }

      await bot.api.sendMessage(chatId, `🎤 _"${transcript}"_`, { parse_mode: "Markdown" });

      await processIncomingText({ platform, platformChatId, userId, text: transcript, today, messageType: "audio" });
    } catch (err) {
      console.error("[voice-transcription] erro ao processar áudio:", err);
      await bot.api
        .sendMessage(chatId, "⚠️ Não consegui processar o áudio agora. Tente novamente.")
        .catch(() => {});
      throw err;
    }
  },
  { connection: redis, concurrency: 5 }
);

voiceTranscriptionWorker.on("failed", (job, err) => {
  console.error(`[voice-transcription] Job ${job?.id} failed:`, err.message);
});
