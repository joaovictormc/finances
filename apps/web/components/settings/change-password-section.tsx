"use client";

import { useState } from "react";
import { authClient, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordStrengthMeter } from "@/components/ui/password-strength-meter";
import { useToast } from "@/components/ui/toast-provider";
import { PasswordPolicySchema } from "@finances/validations";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export function ChangePasswordSection() {
  const { data: session } = useSession();
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const passwordCheck = PasswordPolicySchema.safeParse(newPassword);
    if (!passwordCheck.success) {
      setError(passwordCheck.error.issues[0]?.message ?? "Senha inválida.");
      return;
    }

    setSaving(true);
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    setSaving(false);

    if (error) {
      setError(error.message ?? "Senha atual incorreta.");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    toast({ title: "Senha alterada!", description: "Suas outras sessões foram encerradas.", variant: "success" });
  }

  async function handleSendResetEmail() {
    if (!session?.user?.email) return;
    setSendingReset(true);
    await authClient.requestPasswordReset({
      email: session.user.email,
      redirectTo: `${APP_URL}/reset-password`,
    });
    setSendingReset(false);
    toast({ title: "E-mail enviado!", description: "Confira sua caixa de entrada.", variant: "success" });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleChangePassword} className="space-y-4">
        <Input
          label="Senha atual"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <div>
          <Input
            label="Nova senha"
            type="password"
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres, com letras e números"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <PasswordStrengthMeter password={newPassword} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="sm" loading={saving}>
          Trocar senha
        </Button>
      </form>

      <div className="border-t border-border pt-4">
        <p className="mb-2 text-xs text-muted-foreground">Esqueceu a senha atual?</p>
        <Button variant="outline" size="sm" onClick={handleSendResetEmail} loading={sendingReset}>
          Enviar e-mail para redefinir senha
        </Button>
      </div>
    </div>
  );
}
