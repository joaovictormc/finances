import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Linking,
  StyleSheet,
  Animated,
  Easing,
  AccessibilityInfo,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import { formatBRL } from "@/lib/format";
import { NFCE_PAGE_SCRIPT } from "@/lib/nfce-page-script";
import {
  isGovUrl,
  merchantTitle,
  readReceiptQr,
  setPendingNfceScan,
  setPendingReceiptCode,
  type NfceDiagnostics,
  type NfcePageMessage,
  type NfceScan,
} from "@/lib/nfce";

type Phase =
  | { step: "camera" }
  | { step: "sefaz"; url: string; uf: string; month: string }
  | { step: "done"; scan: NfceScan };

/** Depois disso sem a nota aparecer, oferece a foto do cupom. */
const SLOW_AFTER_SECONDS = 30;

export default function ScanReceiptScreen() {
  // `mode=code`: só lê o QR e devolve o link (recompensa por cupom).
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [phase, setPhase] = useState<Phase>({ step: "camera" });

  if (phase.step === "camera") {
    return (
      <QrCamera
        onRead={(url, uf, month) => {
          if (mode === "code") {
            setPendingReceiptCode(url);
            router.back();
            return;
          }
          setPhase({ step: "sefaz", url, uf, month });
        }}
      />
    );
  }
  if (phase.step === "sefaz") {
    return (
      <SefazPage url={phase.url} uf={phase.uf} month={phase.month} onNote={(scan) => setPhase({ step: "done", scan })} />
    );
  }
  return <ScanResult scan={phase.scan} onAgain={() => setPhase({ step: "camera" })} />;
}

function QrCamera({ onRead }: { onRead: (url: string, uf: string, month: string) => void }) {
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [message, setMessage] = useState<string | null>(null);
  const locked = useRef(false);

  function handleScan({ data }: BarcodeScanningResult) {
    if (locked.current) return;
    locked.current = true;
    const qr = readReceiptQr(data);
    if (qr.ok) {
      onRead(qr.url, qr.info.uf, qr.info.issuedMonth);
      return;
    }
    setMessage(qr.message);
    setTimeout(() => {
      locked.current = false;
    }, 2500);
  }

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-background p-6 dark:bg-background-dark">
        <Ionicons name="qr-code-outline" size={40} color={colors.mutedForeground} />
        <Text className="text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
          Para ler o QR Code do cupom, o app precisa usar a câmera.
        </Text>
        <Pressable
          onPress={() => (permission.canAskAgain ? void requestPermission() : void Linking.openSettings())}
          className="items-center rounded-md bg-primary px-5 py-3 dark:bg-primary-dark"
        >
          <Text className="font-semibold text-primary-foreground dark:text-primary-foreground-dark">
            {permission.canAskAgain ? "Permitir câmera" : "Abrir configurações"}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={handleScan}
      />
      <View className="flex-1 items-center justify-center" pointerEvents="none">
        <View className="h-64 w-64 rounded-3xl border-2 border-primary" />
        <Text className="mt-6 px-8 text-center text-sm text-white">
          Aponte para o QR Code impresso no cupom fiscal.
        </Text>
      </View>
      {message && (
        <View className="absolute bottom-10 left-4 right-4 rounded-xl bg-card p-4 dark:bg-card-dark">
          <Text className="text-sm text-foreground dark:text-foreground-dark">{message}</Text>
        </View>
      )}
    </View>
  );
}

type Stage = "opening" | "checking" | "reading" | "done";

const STEPS: { stage: Exclude<Stage, "done">; label: (uf: string) => string }[] = [
  { stage: "opening", label: (uf) => `Abrindo a nota na SEFAZ-${uf}` },
  { stage: "checking", label: () => "Verificação de segurança da SEFAZ" },
  { stage: "reading", label: () => "Lendo itens e valores" },
];

const STAGE_ORDER: Stage[] = ["opening", "checking", "reading", "done"];

/** Com a verificação na tela e sem a nota até aqui, mostra a página para a pessoa tocar. */
const REVEAL_CHALLENGE_AFTER_MS = 8000;

function SefazPage({
  url,
  uf,
  month,
  onNote,
}: {
  url: string;
  uf: string;
  month: string;
  onNote: (scan: NfceScan) => void;
}) {
  const { colors } = useTheme();
  const startedAt = useRef(Date.now());
  const touched = useRef(false);
  const challenge = useRef<string | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [stage, setStage] = useState<Stage>("opening");
  const [revealed, setRevealed] = useState(false);
  const [notice, setNotice] = useState<"challenge" | "unknown" | "error" | null>(null);
  const [structure, setStructure] = useState<string[] | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setSeconds(Math.round((Date.now() - startedAt.current) / 1000)), 1000);
    return () => {
      clearInterval(timer);
      if (revealTimer.current) clearTimeout(revealTimer.current);
    };
  }, []);

  function advance(next: Stage) {
    setStage((current) => (STAGE_ORDER.indexOf(next) > STAGE_ORDER.indexOf(current) ? next : current));
  }

  function handleMessage(event: WebViewMessageEvent) {
    let message: NfcePageMessage;
    try {
      message = JSON.parse(event.nativeEvent.data) as NfcePageMessage;
    } catch {
      return;
    }
    if (message.type === "note") {
      if (revealTimer.current) clearTimeout(revealTimer.current);
      const diagnostics: NfceDiagnostics = {
        challenge: challenge.current,
        touched: touched.current,
        seconds: Math.round((Date.now() - startedAt.current) / 100) / 10,
      };
      advance("done");
      // Deixa o último passo marcado por um instante antes de trocar de tela.
      setTimeout(() => onNote({ uf, note: message.note, diagnostics }), 450);
    } else if (message.type === "challenge") {
      challenge.current = message.kind;
      setNotice("challenge");
      advance("checking");
      // Quase sempre a verificação passa sozinha; se demorar, provavelmente quer um toque.
      if (!revealTimer.current) revealTimer.current = setTimeout(() => setRevealed(true), REVEAL_CHALLENGE_AFTER_MS);
    } else {
      setNotice("unknown");
      setStructure([`${message.url} · ${message.title}`, ...message.structure]);
      setRevealed(true);
    }
  }

  // O script da página só pode rodar em portal de governo. A verificação da
  // Cloudflare abre em iframe, que no Android não passa por aqui.
  function allowNavigation(request: ShouldStartLoadRequest) {
    if (request.isTopFrame === false) return true;
    return request.url.startsWith("about:") || isGovUrl(request.url);
  }

  // Depois da verificação, a página envia o formulário e carrega a nota.
  function handleLoadStart() {
    if (challenge.current) advance("reading");
  }

  // A página abriu. Se o script não acusar verificação logo em seguida
  // (ele roda assim que a página termina de carregar), já é a nota.
  function handleLoadEnd() {
    setTimeout(() => {
      if (!challenge.current) advance("reading");
    }, 800);
  }

  function retry() {
    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = null;
    challenge.current = null;
    startedAt.current = Date.now();
    setSeconds(0);
    setNotice(null);
    setStage("opening");
    setAttempt((n) => n + 1);
  }

  const slow = seconds >= SLOW_AFTER_SECONDS;
  const [year, monthNumber] = month.split("-");

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      {revealed && (
        <View className="gap-1 border-b border-border bg-card px-4 py-3 dark:border-border-dark dark:bg-card-dark">
          <View className="flex-row items-center gap-2">
            <ActivityIndicator size="small" color={colors.primary} />
            <Text className="flex-1 font-semibold text-foreground dark:text-foreground-dark">Página da SEFAZ-{uf}</Text>
            {notice !== "unknown" && (
              <Pressable onPress={() => setRevealed(false)} hitSlop={8}>
                <Text className="text-sm font-medium text-primary dark:text-primary-dark">Ocultar</Text>
              </Pressable>
            )}
          </View>
          <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">
            {notice === "challenge"
              ? "A SEFAZ pediu uma verificação. Toque no quadro da página e a leitura continua sozinha."
              : notice === "unknown"
                ? "Não reconheci a página da nota. Se ela estiver na tela, avise o suporte com o diagnóstico."
                : "Assim que a nota aparecer, a leitura continua sozinha."}
          </Text>
          {(slow || structure) && (
            <View className="mt-2 flex-row gap-2">
              <Pressable
                onPress={() => router.back()}
                className="flex-1 items-center rounded-md border border-border py-2 dark:border-border-dark"
              >
                <Text className="text-sm text-foreground dark:text-foreground-dark">Usar foto do cupom</Text>
              </Pressable>
              {structure && (
                <Pressable
                  onPress={() => void Clipboard.setStringAsync(structure.join("\n"))}
                  className="flex-1 items-center rounded-md border border-border py-2 dark:border-border-dark"
                >
                  <Text className="text-sm text-foreground dark:text-foreground-dark">Copiar diagnóstico</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      )}

      {/* A página fica montada e no tamanho cheio por baixo da tela de carregamento:
          a verificação da SEFAZ roda como em qualquer navegador. */}
      <View className="flex-1" onTouchStart={() => (touched.current = true)}>
        <WebView
          key={attempt}
          source={{ uri: url }}
          injectedJavaScript={NFCE_PAGE_SCRIPT}
          onMessage={handleMessage}
          onShouldStartLoadWithRequest={allowNavigation}
          onLoadStart={handleLoadStart}
          onLoadEnd={handleLoadEnd}
          onError={() => setNotice("error")}
          onHttpError={(event) => event.nativeEvent.statusCode >= 500 && setNotice("error")}
          originWhitelist={["http://*", "https://*", "about:*"]}
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          setSupportMultipleWindows={false}
        />

        {!revealed && (
          <View className="absolute inset-0 bg-background px-6 dark:bg-background-dark">
            {notice === "error" ? (
              <View className="flex-1 items-center justify-center gap-3">
                <Ionicons name="cloud-offline-outline" size={40} color={colors.mutedForeground} />
                <Text className="text-center text-lg font-semibold text-foreground dark:text-foreground-dark">
                  A SEFAZ-{uf} não respondeu
                </Text>
                <Text className="text-center text-sm text-muted-foreground dark:text-muted-foreground-dark">
                  O portal pode estar fora do ar ou lento agora. Tente de novo em instantes ou use a foto do cupom.
                </Text>
                <Pressable onPress={retry} className="mt-3 w-full items-center rounded-md bg-primary py-3 dark:bg-primary-dark">
                  <Text className="font-semibold text-primary-foreground dark:text-primary-foreground-dark">Tentar de novo</Text>
                </Pressable>
                <Pressable onPress={() => router.back()} className="items-center py-2">
                  <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">Usar foto do cupom</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View className="flex-1 items-center justify-center">
                  <PulsingIcon done={stage === "done"} />
                  <Text className="mt-6 text-xl font-semibold text-foreground dark:text-foreground-dark">
                    {stage === "done" ? "Cupom lido" : "Lendo seu cupom"}
                  </Text>
                  <Text className="mt-1 text-sm text-muted-foreground dark:text-muted-foreground-dark">
                    Compra de {monthNumber}/{year} · {uf}
                  </Text>

                  <View className="mt-8 w-full gap-4 rounded-2xl border border-border bg-card p-5 dark:border-border-dark dark:bg-card-dark">
                    <StepRow state="done" label="QR Code conferido" />
                    {/* O passo da verificação só aparece quando a página pede uma. */}
                    {STEPS.filter((step) => step.stage !== "checking" || challenge.current).map((step) => {
                      const index = STAGE_ORDER.indexOf(step.stage);
                      const current = STAGE_ORDER.indexOf(stage);
                      const state = current > index ? "done" : current === index ? "active" : "pending";
                      return <StepRow key={step.stage} state={state} label={step.label(uf)} />;
                    })}
                  </View>

                  {slow && (
                    <Text className="mt-4 text-center text-xs text-muted-foreground dark:text-muted-foreground-dark">
                      O portal da SEFAZ está demorando mais que o normal.
                    </Text>
                  )}
                </View>

                <View className="gap-1 pb-8">
                  {slow && (
                    <Pressable onPress={() => router.back()} className="items-center rounded-md border border-border py-3 dark:border-border-dark">
                      <Text className="text-sm text-foreground dark:text-foreground-dark">Usar foto do cupom</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={() => setRevealed(true)} className="items-center py-3">
                    <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">Ver página da SEFAZ</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

function PulsingIcon({ done }: { done: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce || done) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ])
      );
      loop.start();
    });
    return () => loop?.stop();
  }, [done, pulse]);

  return (
    <View className="h-24 w-24 items-center justify-center">
      <Animated.View
        className="absolute h-24 w-24 rounded-full bg-primary"
        style={{
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.28] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.05] }) }],
        }}
      />
      <View className="h-16 w-16 items-center justify-center rounded-full bg-primary">
        <Ionicons name={done ? "checkmark" : "receipt-outline"} size={30} color="#1C1C1E" />
      </View>
    </View>
  );
}

function StepRow({ state, label }: { state: "done" | "active" | "pending"; label: string }) {
  const { colors } = useTheme();
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-5 w-5 items-center justify-center">
        {state === "done" ? (
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
        ) : state === "active" ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <View className="h-2 w-2 rounded-full bg-muted-foreground/40 dark:bg-muted-foreground-dark/40" />
        )}
      </View>
      <Text
        className={`flex-1 text-sm ${state === "pending" ? "text-muted-foreground dark:text-muted-foreground-dark" : "text-foreground dark:text-foreground-dark"}`}
      >
        {label}
      </Text>
    </View>
  );
}

function describeCheck({ challenge, touched, seconds }: NfceDiagnostics) {
  const time = `${String(seconds).replace(".", ",")} s`;
  if (!challenge) return `Sem verificação de segurança · ${time}`;
  const name = challenge === "turnstile" ? "Cloudflare Turnstile" : challenge;
  return `${name} · ${touched ? "houve toque na página" : "passou sem toque"} · ${time}`;
}

function ScanResult({ scan, onAgain }: { scan: NfceScan; onAgain: () => void }) {
  const { note, uf, diagnostics } = scan;
  const [showItems, setShowItems] = useState(false);
  const { colors } = useTheme();

  function useInTransaction() {
    setPendingNfceScan(scan);
    router.back();
  }

  return (
    <ScrollView className="flex-1 bg-background dark:bg-background-dark" contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View className="rounded-2xl border border-border bg-card p-5 dark:border-border-dark dark:bg-card-dark">
        <Text className="text-xs uppercase text-muted-foreground dark:text-muted-foreground-dark">Nota lida na SEFAZ-{uf}</Text>
        <Text className="mt-1 text-lg font-semibold text-foreground dark:text-foreground-dark">{merchantTitle(note.merchant)}</Text>
        <Text className="mt-3 text-3xl font-bold text-foreground dark:text-foreground-dark">
          {note.total !== null ? formatBRL(note.total) : "—"}
        </Text>
        {note.discount ? (
          <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">
            com {formatBRL(note.discount)} de desconto
          </Text>
        ) : null}
        <View className="mt-4 gap-1">
          <Row label="Data" value={note.issuedAt ? note.issuedAt.split("-").reverse().join("/") : "—"} />
          <Row label="Pagamento" value={note.payments.map((p) => p.method).filter(Boolean).join(", ") || "não informado"} />
          <Row label="Itens" value={String(note.items.length)} />
        </View>

        <Pressable onPress={() => setShowItems(!showItems)} className="mt-4 flex-row items-center justify-between">
          <Text className="text-sm font-medium text-foreground dark:text-foreground-dark">Ver itens</Text>
          <Ionicons name={showItems ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
        </Pressable>
        {showItems &&
          note.items.map((item, index) => (
            <View key={index} className="mt-2 flex-row justify-between gap-3 border-t border-border pt-2 dark:border-border-dark">
              <Text className="flex-1 text-xs text-foreground dark:text-foreground-dark">
                {item.quantity !== null ? `${String(item.quantity).replace(".", ",")} ${item.unit ?? ""} · ` : ""}
                {item.name}
              </Text>
              <Text className="font-mono text-xs text-foreground dark:text-foreground-dark">
                {item.total !== null ? formatBRL(item.total) : "—"}
              </Text>
            </View>
          ))}

        <Pressable onPress={useInTransaction} className="mt-5 items-center rounded-md bg-primary py-3 dark:bg-primary-dark">
          <Text className="font-semibold text-primary-foreground dark:text-primary-foreground-dark">Usar na transação</Text>
        </Pressable>
        <Pressable onPress={onAgain} className="mt-2 items-center py-2">
          <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">Ler outro cupom</Text>
        </Pressable>
      </View>

      <Text className="text-center font-mono text-xs text-muted-foreground dark:text-muted-foreground-dark">
        {describeCheck(diagnostics)}
      </Text>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-3">
      <Text className="text-sm text-muted-foreground dark:text-muted-foreground-dark">{label}</Text>
      <Text className="flex-1 text-right text-sm text-foreground dark:text-foreground-dark" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
