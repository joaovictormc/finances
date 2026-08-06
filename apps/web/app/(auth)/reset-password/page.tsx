"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordStrengthMeter } from "@/components/ui/password-strength-meter";
import { PasswordPolicySchema } from "@finances/validations";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const invalidToken = searchParams.get("error") === "INVALID_TOKEN";

  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Link inválido ou expirado. Peça um novo link de redefinição.");
      return;
    }

    const passwordCheck = PasswordPolicySchema.safeParse(password);
    if (!passwordCheck.success) {
      setError(passwordCheck.error.issues[0]?.message ?? "Senha inválida.");
      return;
    }

    setLoading(true);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setLoading(false);

    if (error) {
      setError(error.message ?? "Não foi possível redefinir a senha. Peça um novo link.");
      return;
    }
    setDone(true);
  }

  if (invalidToken || !token) {
    return (
      <div className="text-center">
        <h2 className="text-lg font-semibold">Link inválido ou expirado</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Peça um novo link de redefinição de senha.
        </p>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/forgot-password" className="font-medium text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground">
            Esqueci minha senha
          </Link>
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-6 w-6 text-success" />
        </div>
        <h2 className="text-lg font-semibold">Senha redefinida!</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Sua senha foi alterada com sucesso. Suas outras sessões ativas foram encerradas por
          segurança.
        </p>
        <Button className="mt-6 w-full" onClick={() => router.push("/login")}>
          Ir para o login
        </Button>
      </div>
    );
  }

  return (
    <>
      <h2 className="mb-6 text-lg font-semibold">Escolha uma nova senha</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Input
            label="Nova senha"
            type="password"
            required
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres, com letras e números"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <PasswordStrengthMeter password={password} />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" loading={loading} className="w-full">
          Redefinir senha
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
