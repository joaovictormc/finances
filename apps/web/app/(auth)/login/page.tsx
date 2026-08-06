"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackURL = searchParams.get("next") ?? "/overview";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error } = await authClient.signIn.email({ email, password });

    if (error) {
      setLoading(false);
      if (error.code === "EMAIL_NOT_VERIFIED") {
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }
      setError(
        error.code === "INVALID_EMAIL_OR_PASSWORD"
          ? "E-mail ou senha incorretos."
          : error.message ?? "Não foi possível entrar. Tente novamente."
      );
      return;
    }

    setLoading(false);

    // O redirect de 2FA vem de um hook do better-auth que não está tipado na
    // resposta padrão do signIn.email — só existe em runtime quando o usuário
    // tem 2FA ativado.
    if ((data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) {
      setNeedsTwoFactor(true);
      return;
    }

    router.push(callbackURL);
    router.refresh();
  }

  async function handleVerifyTwoFactor(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = useBackupCode
      ? await authClient.twoFactor.verifyBackupCode({ code: twoFactorCode })
      : await authClient.twoFactor.verifyTotp({ code: twoFactorCode });

    setLoading(false);

    if (error) {
      setError(useBackupCode ? "Código de backup inválido." : "Código inválido. Tente novamente.");
      return;
    }

    router.push(callbackURL);
    router.refresh();
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    await authClient.signIn.social({ provider: "google", callbackURL });
  }

  if (needsTwoFactor) {
    return (
      <>
        <h2 className="mb-1 text-lg font-semibold">Verificação em duas etapas</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          {useBackupCode
            ? "Digite um dos seus códigos de backup."
            : "Digite o código de 6 dígitos do seu app autenticador."}
        </p>

        <form onSubmit={handleVerifyTwoFactor} className="space-y-4">
          <Input
            label={useBackupCode ? "Código de backup" : "Código de 6 dígitos"}
            autoFocus
            inputMode={useBackupCode ? "text" : "numeric"}
            maxLength={useBackupCode ? 11 : 6}
            placeholder={useBackupCode ? "xxxxx-xxxxx" : "000000"}
            value={twoFactorCode}
            onChange={(e) =>
              setTwoFactorCode(useBackupCode ? e.target.value : e.target.value.replace(/\D/g, ""))
            }
          />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" loading={loading} className="w-full">
            Confirmar
          </Button>
        </form>

        <button
          type="button"
          onClick={() => {
            setUseBackupCode((v) => !v);
            setTwoFactorCode("");
            setError(null);
          }}
          className="mt-4 text-center text-sm text-muted-foreground hover:underline w-full"
        >
          {useBackupCode ? "Usar código do app autenticador" : "Perdeu acesso? Usar código de backup"}
        </button>
      </>
    );
  }

  return (
    <>
      <h2 className="mb-6 text-lg font-semibold">Entrar na sua conta</h2>

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
        <Input
          label="Senha"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <p className="-mt-2 text-right text-sm">
          <Link href="/forgot-password" className="font-medium text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground">
            Esqueci minha senha
          </Link>
        </p>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" loading={loading} className="w-full">
          Entrar
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">ou</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        loading={googleLoading}
        onClick={handleGoogle}
        className="w-full"
      >
        Continuar com Google
      </Button>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Não tem conta?{" "}
        <Link href="/register" className="font-medium text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground">
          Criar conta
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
