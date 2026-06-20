import { toFile } from "groq-sdk";
import { groq, GROQ_AUDIO_MODEL } from "./groq-client";

export async function transcribeAudio(audio: Buffer, filename = "audio.ogg"): Promise<string> {
  const file = await toFile(audio, filename);

  const response = await groq.audio.transcriptions.create({
    model: GROQ_AUDIO_MODEL,
    file,
    language: "pt",
    response_format: "json",
  });

  return (response.text ?? "").trim();
}
