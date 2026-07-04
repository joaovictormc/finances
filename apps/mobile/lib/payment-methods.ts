// Re-exporta as constantes compartilhadas (@finances/validations é a fonte
// única) mantendo o nome usado nas telas mobile (BASE_PAYMENT_METHOD_TABS).
export {
  type PaymentMethod,
  BASE_PAYMENT_METHOD_OPTIONS as BASE_PAYMENT_METHOD_TABS,
  PAYMENT_METHOD_BADGE,
} from "@finances/validations";
