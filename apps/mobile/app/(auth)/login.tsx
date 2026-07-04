import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Link } from "expo-router";
import { authClient, signIn } from "@/lib/auth-client";
import { useTheme } from "@/lib/theme";
import { PasswordInput } from "@/components/password-input";

export default function LoginScreen() {
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!email.trim() || !password) {
      setError("Preencha e-mail e senha.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await signIn.email({ email: email.trim(), password });

      if (error) {
        setError(
          error.code === "INVALID_EMAIL_OR_PASSWORD"
            ? "E-mail ou senha incorretos."
            : error.message ?? "Não foi possível entrar. Tente novamente."
        );
        return;
      }

      // O redirect de 2FA vem de um hook do better-auth que não está tipado
      // na resposta padrão do signIn.email — só existe em runtime quando o
      // usuário tem 2FA ativado.
      if ((data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) {
        setNeedsTwoFactor(true);
        return;
      }

      // Não navegamos manualmente: o layout raiz observa `useSession()` e
      // redireciona pra (tabs) assim que a sessão propagar. Navegar aqui
      // também causava um loop de redirect (login -> tabs -> login) porque
      // a sessão ainda não tinha propagado no momento do replace manual.
    } catch {
      // Erro de rede / servidor inacessível (não cai no `error` retornado).
      setError("Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyTwoFactor() {
    if (twoFactorCode.length < 6) return;
    setError(null);
    setLoading(true);
    try {
      const { error } = useBackupCode
        ? await authClient.twoFactor.verifyBackupCode({ code: twoFactorCode })
        : await authClient.twoFactor.verifyTotp({ code: twoFactorCode });

      if (error) {
        setError(useBackupCode ? "Código de backup inválido." : "Código inválido. Tente novamente.");
        return;
      }
      // Idem: o layout raiz redireciona sozinho assim que a sessão propagar.
    } catch {
      setError("Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (needsTwoFactor) {
    return (
      <View className="flex-1 justify-center bg-background dark:bg-background-dark px-6">
        <Text className="mb-1 text-center text-2xl font-bold text-foreground dark:text-foreground-dark">
          Verificação em duas etapas
        </Text>
        <Text className="mb-8 text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
          {useBackupCode
            ? "Digite um dos seus códigos de backup."
            : "Digite o código de 6 dígitos do seu app autenticador."}
        </Text>

        <TextInput
          className="mb-4 rounded-md border border-border bg-card px-3 py-3 text-center text-lg tracking-widest text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
          placeholder={useBackupCode ? "xxxxx-xxxxx" : "000000"}
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize={useBackupCode ? "characters" : "none"}
          keyboardType={useBackupCode ? "default" : "number-pad"}
          maxLength={useBackupCode ? 11 : 6}
          value={twoFactorCode}
          onChangeText={(v) => setTwoFactorCode(useBackupCode ? v : v.replace(/\D/g, ""))}
        />

        {error && <Text className="mb-3 text-sm text-destructive dark:text-destructive-dark">{error}</Text>}

        <Pressable
          onPress={handleVerifyTwoFactor}
          disabled={loading}
          className="items-center rounded-md bg-primary py-3 dark:bg-primary-dark"
        >
          {loading ? (
            <ActivityIndicator color="#14142B" />
          ) : (
            <Text className="font-medium text-primary-foreground dark:text-primary-foreground-dark">Confirmar</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => {
            setUseBackupCode((v) => !v);
            setTwoFactorCode("");
            setError(null);
          }}
          className="mt-6"
        >
          <Text className="text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
            {useBackupCode ? "Usar código do app autenticador" : "Perdeu acesso? Usar código de backup"}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 justify-center bg-background dark:bg-background-dark px-6">
      <Text className="mb-1 text-center text-2xl font-bold text-foreground dark:text-foreground-dark">
        Control<Text className="text-primary dark:text-primary-dark">AI</Text>
      </Text>
      <Text className="mb-8 text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
        Entrar na sua conta
      </Text>

      <TextInput
        className="mb-3 rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark"
        placeholder="E-mail"
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <PasswordInput
        className="mb-1"
        placeholder="Senha"
        autoComplete="current-password"
        value={password}
        onChangeText={setPassword}
      />

      <Link href="/(auth)/forgot-password" asChild>
        <Pressable className="mb-4">
          <Text className="text-right text-sm font-medium text-primary dark:text-primary-dark">
            Esqueci minha senha
          </Text>
        </Pressable>
      </Link>

      {error && <Text className="mb-3 text-sm text-destructive dark:text-destructive-dark">{error}</Text>}

      <Pressable
        onPress={handleSubmit}
        disabled={loading}
        className="items-center rounded-md bg-primary py-3 dark:bg-primary-dark"
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="font-medium text-primary-foreground dark:text-primary-foreground-dark">Entrar</Text>
        )}
      </Pressable>

      <Link href="/(auth)/register" asChild>
        <Pressable className="mt-6">
          <Text className="text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
            Não tem conta? <Text className="font-medium text-primary dark:text-primary-dark">Criar conta</Text>
          </Text>
        </Pressable>
      </Link>
    </View>
  );
}
