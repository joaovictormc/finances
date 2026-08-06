"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);
    if (error) {
      setError(error.message ?? "Não foi possível enviar o e-mail. Tente novamente.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <MailCheck className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">Verifique seu e-mail</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Se existir uma conta com o e-mail <span className="font-medium text-foreground">{email}</span>,
          enviamos um link pra redefinir a senha. Confira sua caixa de entrada.
        </p>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground">
            Voltar para o login
          </Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <h2 className="mb-1 text-lg font-semibold">Esqueceu sua senha?</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Digite seu e-mail e enviaremos um link pra redefinir sua senha.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="E-mail"
          type="email"
          required
          autoComplete="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" loading={loading} className="w-full">
          Enviar link de redefinição
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground">
          Voltar para o login
        </Link>
      </p>
    </>
  );
}
