"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DeleteAccountSection() {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "confirm">("idle");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await authClient.deleteUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message ?? "Senha incorreta.");
      return;
    }
    router.push("/login");
  }

  if (step === "confirm") {
    return (
      <form onSubmit={handleDelete} className="space-y-4">
        <p className="text-sm text-destructive">
          Isso vai apagar permanentemente sua conta e todos os seus dados (transações, contas,
          metas, orçamentos, etc). Essa ação não pode ser desfeita.
        </p>
        <Input
          label="Confirme sua senha"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setStep("idle")}>
            Cancelar
          </Button>
          <Button type="submit" variant="destructive" size="sm" loading={loading}>
            Excluir minha conta
          </Button>
        </div>
      </form>
    );
  }

  return (
    <Button variant="destructive" size="sm" onClick={() => setStep("confirm")}>
      Excluir minha conta
    </Button>
  );
}
