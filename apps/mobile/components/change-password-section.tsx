import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import * as Linking from "expo-linking";
import { authClient, useSession } from "@/lib/auth-client";
import { PasswordInput } from "@/components/password-input";
import { PasswordStrengthMeter } from "@/components/password-strength-meter";
import { PasswordPolicySchema } from "@finances/validations";

export function ChangePasswordSection() {
  const { data: session } = useSession();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  async function handleChangePassword() {
    setError(null);
    setSuccess(null);

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
    setSuccess("Senha alterada! Suas outras sessões foram encerradas.");
  }

  async function handleSendResetEmail() {
    if (!session?.user?.email) return;
    setSuccess(null);
    setSendingReset(true);
    await authClient.requestPasswordReset({
      email: session.user.email,
      redirectTo: Linking.createURL("/reset-password"),
    });
    setSendingReset(false);
    setSuccess("E-mail enviado! Confira sua caixa de entrada.");
  }

  return (
    <View className="gap-3">
      <PasswordInput
        placeholder="Senha atual"
        autoComplete="current-password"
        value={currentPassword}
        onChangeText={setCurrentPassword}
      />
      <View>
        <PasswordInput
          placeholder="Nova senha"
          autoComplete="new-password"
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <PasswordStrengthMeter password={newPassword} />
      </View>

      {error && <Text className="text-sm text-destructive dark:text-destructive-dark">{error}</Text>}
      {success && <Text className="text-sm text-green-600">{success}</Text>}

      <Pressable
        onPress={handleChangePassword}
        disabled={saving}
        className="items-center rounded-md bg-primary py-3 dark:bg-primary-dark"
      >
        {saving ? (
          <ActivityIndicator color="#14142B" />
        ) : (
          <Text className="text-sm font-medium text-primary-foreground dark:text-primary-foreground-dark">
            Trocar senha
          </Text>
        )}
      </Pressable>

      <View className="border-t border-border pt-3 dark:border-border-dark">
        <Text className="mb-2 text-xs text-muted-foreground dark:text-muted-foreground-dark">
          Esqueceu a senha atual?
        </Text>
        <Pressable
          onPress={handleSendResetEmail}
          disabled={sendingReset}
          className="items-center rounded-md border border-border py-3 dark:border-border-dark"
        >
          {sendingReset ? (
            <ActivityIndicator color="#14142B" />
          ) : (
            <Text className="text-sm font-medium text-foreground dark:text-foreground-dark">
              Enviar e-mail para redefinir senha
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
