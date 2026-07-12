"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordStrengthMeter } from "@/components/ui/password-strength-meter";
import { api } from "@/lib/api-client";
import { PasswordPolicySchema } from "@finances/validations";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralCode = searchParams.get("ref");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const passwordCheck = PasswordPolicySchema.safeParse(password);
    if (!passwordCheck.success) {
      setError(passwordCheck.error.issues[0]?.message ?? "Senha inválida.");
      return;
    }

    setLoading(true);

    const { data, error } = await authClient.signUp.email({
      name,
      email,
      password,
      callbackURL: `${APP_URL}/overview`,
    });

    if (error) {
      setLoading(false);
      setError(
        error.code === "USER_ALREADY_EXISTS"
          ? "Já existe uma conta com este e-mail."
          : error.message ?? "Não foi possível criar a conta. Tente novamente."
      );
      return;
    }

    // Verificação de e-mail OFF → signup já cria sessão (retorna token) → dashboard.
    // Verificação ON → sem sessão → tela de confirmação de e-mail.
    if (data?.token) {
      if (referralCode) {
        await api.post("/api/referrals/redeem", { code: referralCode }).catch(() => {});
      }
      router.push("/overview");
    } else {
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    }
    router.refresh();
  }

  return (
    <>
      <h2 className="mb-6 text-lg font-semibold">Criar conta</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nome"
          type="text"
          required
          autoComplete="name"
          placeholder="Seu nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label="E-mail"
          type="email"
          required
          autoComplete="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div>
          <Input
            label="Senha"
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
          Criar conta
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
