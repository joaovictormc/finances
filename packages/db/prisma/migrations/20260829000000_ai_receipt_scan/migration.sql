ALTER TABLE "ai_settings"
  ADD COLUMN "visionModel" TEXT NOT NULL DEFAULT 'llama-3.2-90b-vision-preview',
  ADD COLUMN "receiptScanEnabled" BOOLEAN NOT NULL DEFAULT true;
