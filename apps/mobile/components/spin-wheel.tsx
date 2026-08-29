import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Svg, { Circle, Path, Text as SvgText, TSpan, G } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  cancelAnimation,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { useTheme } from "@/lib/theme";

export type WheelPrize = { label: string };

// Mesma paleta categórica da versão web (apps/web/components/ui/spin-wheel.tsx).
const WHEEL_COLORS = [
  "#64748b", "#22c55e", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#f97316", "#ec4899",
  "#84cc16", "#0ea5e9",
];

const SPIN_DURATION_MS = 4200;
const EXTRA_SPINS = 5;
// Desaceleração longa e monotônica (sem ultrapassar o alvo e voltar) — mesma
// curva da versão web, evita o "travar e pular" perto do fim do giro.
const SPIN_EASING = Easing.bezier(0.12, 0.5, 0.14, 1);

// Fase final de "acomodação": depois da desaceleração principal, um ajuste
// curto e suave (sem o balanço do ponteiro) puxa a roleta pro centro exato do
// prêmio mais próximo — como se o ponteiro estivesse se encaixando de vez.
const SETTLE_DURATION_MS = 420;
const SETTLE_EASING = Easing.bezier(0.33, 1, 0.68, 1);

interface SpinWheelProps {
  prizes: WheelPrize[];
  /** Índice em `prizes` do prêmio sorteado (sempre decidido no servidor). */
  targetIndex: number | null;
  /** Incrementa a cada novo giro pra forçar a animação mesmo se o índice repetir. */
  spinToken: number;
  onSpinEnd?: () => void;
  size?: number;
}

/** Roleta visual (react-native-svg + reanimated) — o sorteio em si nunca acontece aqui. */
export function SpinWheel({ prizes, targetIndex, spinToken, onSpinEnd, size = 160 }: SpinWheelProps) {
  const { colors } = useTheme();
  const rotation = useSharedValue(0);
  const pointerWobble = useSharedValue(0);
  const lastToken = useRef(0);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);

  useEffect(() => {
    if (targetIndex === null || prizes.length === 0) return;
    if (spinToken === lastToken.current) return;
    lastToken.current = spinToken;

    setHighlightIndex(null);
    pointerWobble.value = withRepeat(withSequence(withTiming(1, { duration: 55 }), withTiming(-1, { duration: 55 })), -1, true);

    const segment = 360 / prizes.length;
    const centerAngle = targetIndex * segment + segment / 2;
    // A desaceleração principal para um pouco ANTES do centro exato (sempre
    // dentro do próprio setor vencedor — nunca passa pra vizinhança) — a fase
    // de acomodação completa o resto sempre girando pra frente, nunca volta.
    const settleSpread = segment * 0.3;
    const minOffset = Math.min(1.5, settleSpread / 2);
    const roughOffset = minOffset + Math.random() * (settleSpread - minOffset);
    const roughAngle = centerAngle + roughOffset;

    const prevMod = ((rotation.value % 360) + 360) % 360;
    const delta = (((360 - roughAngle - prevMod) % 360) + 360) % 360;
    const roughRotation = rotation.value + EXTRA_SPINS * 360 + delta;
    const settleRotation = roughRotation + roughOffset;

    rotation.value = withTiming(roughRotation, { duration: SPIN_DURATION_MS, easing: SPIN_EASING }, (finished) => {
      cancelAnimation(pointerWobble);
      pointerWobble.value = withTiming(0, { duration: 100 });
      if (!finished) return;
      rotation.value = withTiming(settleRotation, { duration: SETTLE_DURATION_MS, easing: SETTLE_EASING }, (settled) => {
        if (!settled) return;
        runOnJS(setHighlightIndex)(targetIndex);
        if (onSpinEnd) runOnJS(onSpinEnd)();
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetIndex, spinToken, prizes.length]);

  const wheelStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const pointerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${pointerWobble.value * 10}deg` }],
  }));

  if (prizes.length === 0) return null;

  const segment = 360 / prizes.length;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={[
          {
            position: "absolute",
            top: -2,
            zIndex: 10,
            width: 0,
            height: 0,
            borderLeftWidth: 7,
            borderRightWidth: 7,
            borderTopWidth: 12,
            borderLeftColor: "transparent",
            borderRightColor: "transparent",
            borderTopColor: colors.foreground,
          },
          pointerStyle,
        ]}
      />
      <Animated.View style={[{ width: size, height: size }, wheelStyle]}>
        <Svg viewBox="0 0 200 200" width={size} height={size}>
          <Circle cx={100} cy={100} r={98} fill={colors.card} stroke={colors.border} strokeWidth={2} />
          {prizes.map((p, i) => {
            const start = i * segment;
            const end = start + segment;
            const mid = start + segment / 2;
            const pos = polarToCartesian(100, 100, 60, mid);
            const lines = wrapLabel(p.label, prizes.length);
            const lineHeight = 8.5;
            const isWinner = i === highlightIndex;
            return (
              <G key={i}>
                <Path
                  d={describeSlice(100, 100, 96, start, end)}
                  fill={WHEEL_COLORS[i % WHEEL_COLORS.length]}
                  stroke={isWinner ? "#fbbf24" : colors.card}
                  strokeWidth={isWinner ? 4 : 1.5}
                />
                {/* Texto sempre na vertical (sem rotação radial), quebrado em até
                    3 linhas centralizadas no espaço do setor. */}
                <SvgText
                  x={pos.x}
                  y={pos.y}
                  fill="#fff"
                  stroke="rgba(0,0,0,0.35)"
                  strokeWidth={2.5}
                  fontSize={7.5}
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {lines.map((line, li) => (
                    <TSpan key={li} x={pos.x} dy={li === 0 ? -((lines.length - 1) * lineHeight) / 2 : lineHeight}>
                      {line}
                    </TSpan>
                  ))}
                </SvgText>
              </G>
            );
          })}
          <Circle cx={100} cy={100} r={14} fill={colors.card} stroke={colors.border} strokeWidth={2} />
        </Svg>
      </Animated.View>
    </View>
  );
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeSlice(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const p1 = polarToCartesian(cx, cy, r, startAngle);
  const p2 = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y} Z`;
}

/** Quebra o rótulo em até 3 linhas curtas, pra ficar legível na vertical dentro do setor. */
function wrapLabel(label: string, sliceCount: number): string[] {
  const maxCharsPerLine = sliceCount <= 4 ? 11 : sliceCount <= 6 ? 8 : 6;
  const maxLines = 3;
  const words = label.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);

  const consumedLength = lines.join(" ").length;
  if (lines.length === maxLines && consumedLength < label.length) {
    const last = lines[maxLines - 1]!;
    lines[maxLines - 1] = last.length > 1 ? `${last.slice(0, -1)}…` : last;
  }

  return lines.map((line) => (line.length > maxCharsPerLine + 2 ? `${line.slice(0, maxCharsPerLine)}…` : line));
}
