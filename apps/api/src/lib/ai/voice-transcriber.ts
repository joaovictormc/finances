import { toFile } from "groq-sdk";
import { groq } from "./groq-client";
import { getAiSettings, isWithinUsageLimit, logAiUsage } from "./ai-settings";

export async function transcribeAudio(
  audio: Buffer,
  filename = "audio.ogg",
  userId?: string
): Promise<string> {
  const settings = await getAiSettings();
  if (!(await isWithinUsageLimit(settings))) return "";

  const file = await toFile(audio, filename);

  const response = await groq.audio.transcriptions.create({
    model: settings.audioModel,
    file,
    language: "pt",
    response_format: "json",
  });

  await logAiUsage({ userId, feature: "voice_transcription", model: settings.audioModel });

  return (response.text ?? "").trim();
}
