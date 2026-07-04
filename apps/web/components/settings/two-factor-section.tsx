"use client";

import { useState } from "react";
import QRCode from "react-qr-code";
import { ShieldCheck, Copy, Check } from "lucide-react";
import { authClient, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast-provider";

type Step = "idle" | "password-enable" | "verify" | "backup-codes" | "password-disable";

function extractSecret(totpURI: string): string {
  try {
    return new URL(totpURI.replace("otpauth://", "https://")).searchParams.get("secret") ?? "";
  } catch {
    return "";
  }
}

export function TwoFactorSection() {
  const { data: session, isPending } = useSession();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("idle");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [totpURI, setTotpURI] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const twoFactorEnabled = !!session?.user?.twoFactorEnabled;

  function reset() {
    setStep("idle");
    setPassword("");
    setCode("");
    setTotpURI("");
    setBackupCodes([]);
    setError(null);
    setCopied(false);
  }

  async function handleEnable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data, error } = await authClient.twoFactor.enable({ password });
    setLoading(false);
    if (error) {
      setError(error.message ?? "Senha incorreta.");
      return;
    }
    setTotpURI(data.totpURI);
    setBackupCodes(data.backupCodes);
    setPassword("");
    setStep("verify");
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await authClient.twoFactor.verifyTotp({ code });
    setLoading(false);
    if (error) {
      setError("Código inválido. Confira o app autenticador e tente de novo.");
      return;
    }
    setCode("");
    setStep("backup-codes");
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await authClient.twoFactor.disable({ password });
    setLoading(false);
    if (error) {
      setError(error.message ?? "Senha incorreta.");
      return;
    }
    reset();
    toast({ title: "Autenticação em duas etapas desativada", variant: "success" });
  }

  async function handleCopyBackupCodes() {
    await navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopied(true);
  }

  if (isPending) {
    return <div className="h-9 animate-pulse rounded-md bg-muted" />;
  }

  if (step === "backup-codes") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-md bg-success/10 px-3 py-2 text-sm text-success">
          <ShieldCheck className="h-4 w-4" />
          <span className="font-medium">Autenticação em duas etapas ativada!</span>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Guarde seus códigos de backup</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Use um deles se perder acesso ao seu app autenticador. Cada código só funciona uma vez.
          </p>
          <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-muted/40 p-3 font-mono text-sm">
            {backupCodes.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyBackupCodes}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copiado!" : "Copiar códigos"}
          </Button>
          <Button size="sm" onClick={reset}>
            Concluir
          </Button>
        </div>
      </div>
    );
  }

  if (step === "verify") {
    const secret = extractSecret(totpURI);
    return (
      <form onSubmit={handleVerify} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Escaneie o QR code com seu app autenticador (Google Authenticator, Authy, etc.) e digite o
          código de 6 dígitos gerado.
        </p>
        <div className="flex justify-center bg-white p-3 rounded-xl w-fit">
          <QRCode value={totpURI} size={180} />
        </div>
        {secret && (
          <p className="text-xs text-muted-foreground">
            Não consegue escanear? Digite esta chave manualmente: <span className="font-mono">{secret}</span>
          </p>
        )}
        <Input
          label="Código de 6 dígitos"
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={reset}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" loading={loading}>
            Confirmar
          </Button>
        </div>
      </form>
    );
  }

  if (step === "password-enable" || step === "password-disable") {
    const isDisabling = step === "password-disable";
    return (
      <form onSubmit={isDisabling ? handleDisable : handleEnable} className="space-y-4">
        <Input
          label="Confirme sua senha"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={reset}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" loading={loading} variant={isDisabling ? "destructive" : "default"}>
            {isDisabling ? "Desativar" : "Continuar"}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-foreground">
          {twoFactorEnabled ? "Autenticação em duas etapas está ativada." : "Adicione uma camada extra de segurança com um app autenticador."}
        </p>
      </div>
      {twoFactorEnabled ? (
        <Button variant="outline" size="sm" onClick={() => setStep("password-disable")}>
          Desativar
        </Button>
      ) : (
        <Button size="sm" onClick={() => setStep("password-enable")}>
          Ativar
        </Button>
      )}
    </div>
  );
}
