const MAX_FILE_BYTES = 8 * 1024 * 1024;
const SUPPORTED_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/heic", "image/webp"]);

type ReceiptFileMetadata = {
  name: string;
  size: number;
  type: string;
};

export function validateReceiptImage(file: ReceiptFileMetadata) {
  if (!SUPPORTED_MIME_TYPES.has(file.type)) {
    throw new Error("Formato de imagem não suportado — envie JPEG, PNG, HEIC ou WEBP");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("A imagem excede 8 MB");
  }
}
