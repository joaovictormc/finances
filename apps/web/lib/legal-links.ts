import { LANDING_LEGAL_SLUGS } from "@finances/validations";

const LANDING_URL = (process.env.NEXT_PUBLIC_LANDING_URL ?? "http://localhost:3002").replace(/\/$/, "");

export const TERMS_URL = `${LANDING_URL}/${LANDING_LEGAL_SLUGS.terms}`;
export const PRIVACY_URL = `${LANDING_URL}/${LANDING_LEGAL_SLUGS.privacy}`;
