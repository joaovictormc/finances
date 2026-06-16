// Carrega o .env da raiz do monorepo ANTES de qualquer outro módulo.
// Deve ser o primeiro import em src/index.ts.
// Node 20.12+/22+/24 expõe process.loadEnvFile nativamente — sem dependência de dotenv.
import { resolve } from "node:path";

const envPath = resolve(import.meta.dirname, "../../../.env");

try {
  process.loadEnvFile(envPath);
} catch {
  // .env ausente (ex.: produção usa variáveis injetadas pelo ambiente) — segue com process.env atual.
  console.warn(`[env] Não foi possível carregar ${envPath}; usando variáveis de ambiente existentes.`);
}
