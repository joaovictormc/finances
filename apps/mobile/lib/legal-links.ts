import { LANDING_LEGAL_SLUGS } from "@finances/validations";

// Endereço público da landing, por perfil de build (eas.json).
const LANDING_URL = (process.env.EXPO_PUBLIC_LANDING_URL ?? "http://localhost:3002").replace(/\/$/, "");

export const TERMS_URL = `${LANDING_URL}/${LANDING_LEGAL_SLUGS.terms}`;
export const PRIVACY_URL = `${LANDING_URL}/${LANDING_LEGAL_SLUGS.privacy}`;
