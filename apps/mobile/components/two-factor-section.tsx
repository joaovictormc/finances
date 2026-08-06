import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { authClient, useSession } from "@/lib/auth-client";
import { useTheme } from "@/lib/theme";

type Step = "idle" | "password-enable" | "verify" | "backup-codes" | "password-disable";

function extractSecret(totpURI: string): string {
  try {
    return new URL(totpURI.replace("otpauth://", "https://")).searchParams.get("secret") ?? "";
  } catch {
    return "";
  }
}

export function TwoFactorSection() {
  const { colors } = useTheme();
  const { data: session, isPending } = useSession();

  const [step, setStep] = useState<Step>("idle");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [totpURI, setTotpURI] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);

  const twoFactorEnabled = !!session?.user?.twoFactorEnabled;

  function reset() {
    setStep("idle");
    setPassword("");
    setCode("");
    setTotpURI("");
    setBackupCodes([]);
    setError(null);
    setCopied(false);
    setSecretCopied(false);
  }

  async function handleEnable() {
    if (!password) return;
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

  async function handleVerify() {
    if (code.length !== 6) return;
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

  async function handleDisable() {
    if (!password) return;
    setError(null);
    setLoading(true);
    const { error } = await authClient.twoFactor.disable({ password });
    setLoading(false);
    if (error) {
      setError(error.message ?? "Senha incorreta.");
      return;
    }
    reset();
  }

  async function handleCopyBackupCodes() {
    await Clipboard.setStringAsync(backupCodes.join("\n"));
    setCopied(true);
  }

  async function handleCopySecret() {
    await Clipboard.setStringAsync(extractSecret(totpURI));
    setSecretCopied(true);
  }

  if (isPending) {
    return <ActivityIndicator color={colors.primary} />;
  }

  if (step === "backup-codes") {
    return (
      <View className="gap-3">
        <View className="flex-row items-center gap-2 rounded-md bg-green-500/10 px-3 py-2">
          <Ionicons name="shield-checkmark" size={16} color="#22c55e" />
          <Text className="text-sm font-medium text-green-600">Autenticação em duas etapas ativada!</Text>
        </View>
        <Text className="text-sm font-medium text-foreground dark:text-foreground-dark">
          Guarde seus códigos de backup
        </Text>
        <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">
          Use um deles se perder acesso ao seu app autenticador. Cada código só funciona uma vez.
        </Text>
        <View className="flex-row flex-wrap gap-2 rounded-md border border-border bg-muted p-3 dark:border-border-dark dark:bg-muted-dark">
          {backupCodes.map((c) => (
            <Text key={c} className="w-[45%] font-mono text-sm text-foreground dark:text-foreground-dark">
              {c}
            </Text>
          ))}
        </View>
        <View className="flex-row gap-2">
          <Pressable
            onPress={handleCopyBackupCodes}
            className="flex-1 items-center rounded-md border border-border py-3 dark:border-border-dark"
          >
            <Text className="text-sm font-medium text-foreground dark:text-foreground-dark">
              {copied ? "Copiado!" : "Copiar códigos"}
            </Text>
          </Pressable>
          <Pressable onPress={reset} className="flex-1 items-center rounded-md bg-primary py-3 dark:bg-primary-dark">
            <Text className="text-sm font-medium text-primary-foreground dark:text-primary-foreground-dark">
              Concluir
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (step === "verify") {
    const secret = extractSecret(totpURI);
    return (
      <View className="gap-3">
        <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">
          Abra seu app autenticador (Google Authenticator, Authy, etc.), escolha "inserir chave manualmente"
          e cole a chave abaixo. Depois digite o código de 6 dígitos gerado.
        </Text>
        <View className="rounded-md border border-border bg-muted p-3 dark:border-border-dark dark:bg-muted-dark">
          <Text className="mb-2 text-center font-mono text-base tracking-widest text-foreground dark:text-foreground-dark">
            {secret}
          </Text>
          <Pressable
            onPress={handleCopySecret}
            className="items-center rounded-md border border-border py-2 dark:border-border-dark"
          >
            <Text className="text-sm font-medium text-foreground dark:text-foreground-dark">
              {secretCopied ? "Copiado!" : "Copiar chave"}
            </Text>
          </Pressable>
        </View>
        <TextInput
          className="rounded-md border border-border bg-card px-3 py-3 text-center text-lg tracking-widest text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
          placeholder="000000"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="number-pad"
          maxLength={6}
          value={code}
          onChangeText={(v) => setCode(v.replace(/\D/g, ""))}
        />
        {error && <Text className="text-sm text-destructive dark:text-destructive-dark">{error}</Text>}
        <View className="flex-row gap-2">
          <Pressable onPress={reset} className="flex-1 items-center rounded-md border border-border py-3 dark:border-border-dark">
            <Text className="text-sm font-medium text-foreground dark:text-foreground-dark">Cancelar</Text>
          </Pressable>
          <Pressable
            onPress={handleVerify}
            disabled={loading}
            className="flex-1 items-center rounded-md bg-primary py-3 dark:bg-primary-dark"
          >
            {loading ? (
              <ActivityIndicator color="#1C1C1E" />
            ) : (
              <Text className="text-sm font-medium text-primary-foreground dark:text-primary-foreground-dark">
                Confirmar
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  if (step === "password-enable" || step === "password-disable") {
    const isDisabling = step === "password-disable";
    return (
      <View className="gap-3">
        <TextInput
          className="rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
          placeholder="Confirme sua senha"
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {error && <Text className="text-sm text-destructive dark:text-destructive-dark">{error}</Text>}
        <View className="flex-row gap-2">
          <Pressable onPress={reset} className="flex-1 items-center rounded-md border border-border py-3 dark:border-border-dark">
            <Text className="text-sm font-medium text-foreground dark:text-foreground-dark">Cancelar</Text>
          </Pressable>
          <Pressable
            onPress={isDisabling ? handleDisable : handleEnable}
            disabled={loading}
            className={`flex-1 items-center rounded-md py-3 ${isDisabling ? "bg-destructive" : "bg-primary dark:bg-primary-dark"}`}
          >
            {loading ? (
              <ActivityIndicator color={isDisabling ? "#fff" : "#1C1C1E"} />
            ) : (
              <Text
                className={`text-sm font-medium ${isDisabling ? "text-white" : "text-primary-foreground dark:text-primary-foreground-dark"}`}
              >
                {isDisabling ? "Desativar" : "Continuar"}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="flex-1 text-sm text-foreground dark:text-foreground-dark">
        {twoFactorEnabled
          ? "Autenticação em duas etapas está ativada."
          : "Adicione uma camada extra de segurança com um app autenticador."}
      </Text>
      <Pressable
        onPress={() => setStep(twoFactorEnabled ? "password-disable" : "password-enable")}
        className={`items-center rounded-md px-4 py-2 ${twoFactorEnabled ? "border border-destructive" : "bg-primary dark:bg-primary-dark"}`}
      >
        <Text
          className={`text-sm font-medium ${twoFactorEnabled ? "text-destructive dark:text-destructive-dark" : "text-primary-foreground dark:text-primary-foreground-dark"}`}
        >
          {twoFactorEnabled ? "Desativar" : "Ativar"}
        </Text>
      </Pressable>
    </View>
  );
}
