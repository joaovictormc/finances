/**
 * P2002 = violação de constraint unique no Prisma.
 *
 * Usado no lugar de "consulta antes de inserir": deixar o banco recusar a
 * duplicata é atômico, enquanto `findUnique` seguido de `create` deixa duas
 * execuções simultâneas passarem juntas.
 */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}
