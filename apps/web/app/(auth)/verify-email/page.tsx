"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleResend() {
    if (!email) return;
    setStatus("sending");
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: `${window.location.origin}/overview`,
    });
    setStatus(error ? "error" : "sent");
  }

  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <MailCheck className="h-6 w-6 text-primary" />
      </div>

      <h2 className="text-lg font-semibold">Confirme seu e-mail</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Enviamos um link de confirmação{email ? " para " : ""}
        {email && <span className="font-medium text-foreground">{email}</span>}. Abra o
        e-mail e clique no link para ativar sua conta.
      </p>

      <div className="mt-6 space-y-3">
        <Button
          type="button"
          variant="outline"
          loading={status === "sending"}
          onClick={handleResend}
          disabled={!email}
          className="w-full"
        >
          Reenviar e-mail
        </Button>

        {status === "sent" && (
          <p className="text-sm text-success">E-mail reenviado com sucesso.</p>
        )}
        {status === "error" && (
          <p className="text-sm text-destructive">
            Não foi possível reenviar. Tente novamente em instantes.
          </p>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Já confirmou?{" "}
        <Link href="/login" className="font-medium text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground">
          Entrar
        </Link>
      </p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
