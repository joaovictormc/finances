import Groq from "groq-sdk";

export const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// llama-3.3-70b-versatile: tier gratuito generoso na Groq, bom suporte a PT-BR.
export const GROQ_TEXT_MODEL = "llama-3.3-70b-versatile";
// whisper-large-v3-turbo: transcrição de áudio rápida e gratuita.
export const GROQ_AUDIO_MODEL = "whisper-large-v3-turbo";
