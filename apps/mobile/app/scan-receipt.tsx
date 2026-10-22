import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, ScrollView, Linking, StyleSheet } from "react-native";
import { router } from "expo-router";
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
  type NfceDiagnostics,
  type NfcePageMessage,
  type NfceScan,
} from "@/lib/nfce";

type Phase =
  | { step: "camera" }
  | { step: "sefaz"; url: string; uf: string }
  | { step: "done"; scan: NfceScan };

/** Depois disso sem a nota aparecer, oferece a foto do cupom. */
const SLOW_AFTER_SECONDS = 30;

export default function ScanReceiptScreen() {
  const [phase, setPhase] = useState<Phase>({ step: "camera" });

  if (phase.step === "camera") {
    return <QrCamera onRead={(url, uf) => setPhase({ step: "sefaz", url, uf })} />;
  }
  if (phase.step === "sefaz") {
    return <SefazPage url={phase.url} uf={phase.uf} onNote={(scan) => setPhase({ step: "done", scan })} />;
  }
  return <ScanResult scan={phase.scan} onAgain={() => setPhase({ step: "camera" })} />;
}

function QrCamera({ onRead }: { onRead: (url: string, uf: string) => void }) {
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [message, setMessage] = useState<string | null>(null);
  const locked = useRef(false);

  function handleScan({ data }: BarcodeScanningResult) {
    if (locked.current) return;
    locked.current = true;
    const qr = readReceiptQr(data);
    if (qr.ok) {
      onRead(qr.url, qr.info.uf);
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

function SefazPage({ url, uf, onNote }: { url: string; uf: string; onNote: (scan: NfceScan) => void }) {
  const { colors } = useTheme();
  const startedAt = useRef(Date.now());
  const touched = useRef(false);
  const challenge = useRef<string | null>(null);
  const [notice, setNotice] = useState<"challenge" | "unknown" | "error" | null>(null);
  const [structure, setStructure] = useState<string[] | null>(null);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setSeconds(Math.round((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  function handleMessage(event: WebViewMessageEvent) {
    let message: NfcePageMessage;
    try {
      message = JSON.parse(event.nativeEvent.data) as NfcePageMessage;
    } catch {
      return;
    }
    if (message.type === "note") {
      const diagnostics: NfceDiagnostics = {
        challenge: challenge.current,
        touched: touched.current,
        seconds: Math.round((Date.now() - startedAt.current) / 100) / 10,
      };
      onNote({ uf, note: message.note, diagnostics });
    } else if (message.type === "challenge") {
      challenge.current = message.kind;
      setNotice("challenge");
    } else {
      setNotice("unknown");
      setStructure([`${message.url} · ${message.title}`, ...message.structure]);
    }
  }

  // O script da página só pode rodar em portal de governo. A verificação da
  // Cloudflare abre em iframe, que no Android não passa por aqui.
  function allowNavigation(request: ShouldStartLoadRequest) {
    if (request.isTopFrame === false) return true;
    return request.url.startsWith("about:") || isGovUrl(request.url);
  }

  const slow = seconds >= SLOW_AFTER_SECONDS;

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <View className="gap-1 border-b border-border bg-card px-4 py-3 dark:border-border-dark dark:bg-card-dark">
        <View className="flex-row items-center gap-2">
          <ActivityIndicator size="small" color={colors.primary} />
          <Text className="flex-1 font-semibold text-foreground dark:text-foreground-dark">Consultando na SEFAZ-{uf}…</Text>
          <Text className="font-mono text-xs text-muted-foreground dark:text-muted-foreground-dark">{seconds}s</Text>
        </View>
        <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">
          {notice === "challenge"
            ? "A SEFAZ faz uma verificação de segurança. Se aparecer um quadro na página, toque nele."
            : notice === "unknown"
              ? "Não reconheci a página da nota. Se ela estiver na tela, avise o suporte com o diagnóstico."
              : notice === "error"
                ? "O portal da SEFAZ não respondeu. Tente de novo em instantes ou use a foto do cupom."
                : "Abrindo a página oficial da nota."}
        </Text>
        {(slow || notice === "unknown" || notice === "error") && (
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
      <View className="flex-1" onTouchStart={() => (touched.current = true)}>
        <WebView
          source={{ uri: url }}
          injectedJavaScript={NFCE_PAGE_SCRIPT}
          onMessage={handleMessage}
          onShouldStartLoadWithRequest={allowNavigation}
          onError={() => setNotice("error")}
          originWhitelist={["http://*", "https://*", "about:*"]}
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          setSupportMultipleWindows={false}
        />
      </View>
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
