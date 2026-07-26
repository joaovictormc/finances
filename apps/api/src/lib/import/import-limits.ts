const MAX_FILES = 20;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
const SUPPORTED_EXTENSION = /\.(csv|ofx)$/i;

type ImportFileMetadata = {
  name: string;
  size: number;
};

export function validateImportFileBatch(files: ImportFileMetadata[]) {
  if (files.length === 0) throw new Error("Selecione ao menos um arquivo");
  if (files.length > MAX_FILES) throw new Error("Envie no máximo 20 arquivos por operação");

  let totalBytes = 0;
  for (const file of files) {
    if (!SUPPORTED_EXTENSION.test(file.name)) {
      throw new Error(`Formato não suportado: ${file.name}`);
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new Error(`O arquivo ${file.name} excede 10 MB`);
    }
    totalBytes += file.size;
  }

  if (totalBytes > MAX_TOTAL_BYTES) {
    throw new Error("O lote excede 50 MB");
  }

  return { totalBytes };
}
