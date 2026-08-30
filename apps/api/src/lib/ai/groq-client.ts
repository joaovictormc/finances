import Groq from "groq-sdk";

export const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Referência dos ids em uso — o modelo efetivo vem sempre do `AiSettings`
// (editável em /admin/ai). Mantenha em sincronia com os defaults do schema:
// a Groq aposenta modelos com frequência e um id morto derruba toda chamada
// com 404 / model_decommissioned.
export const GROQ_TEXT_MODEL = "openai/gpt-oss-120b";
export const GROQ_AUDIO_MODEL = "whisper-large-v3-turbo";
