import { useEffect, useMemo } from "react";
import { View, Text } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withTiming, Easing } from "react-native-reanimated";

const PARTICLES = ["🎉", "✨", "🎊", "⭐"];
const PARTICLE_COUNT = 10;

function Particle({ index }: { index: number }) {
  const progress = useSharedValue(0);
  const left = useMemo(() => Math.random() * 100, []);
  const drift = useMemo(() => (Math.random() - 0.5) * 60, []);
  const delay = useMemo(() => Math.random() * 250, []);
  const duration = useMemo(() => 900 + Math.random() * 500, []);
  const size = useMemo(() => 14 + Math.random() * 10, []);

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration, easing: Easing.in(Easing.quad) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    position: "absolute",
    left: `${left}%`,
    top: 0,
    opacity: progress.value < 0.15 ? progress.value / 0.15 : 1 - progress.value,
    transform: [
      { translateY: progress.value * 160 },
      { translateX: progress.value * drift },
      { rotate: `${progress.value * 340}deg` },
    ],
  }));

  return (
    <Animated.View style={style}>
      <Text style={{ fontSize: size }}>{PARTICLES[index % PARTICLES.length]}</Text>
    </Animated.View>
  );
}

/** Rajada de confete leve (reanimated, sem lib extra) — usada na revelação do prêmio da Roleta Semanal. */
export function ConfettiBurst() {
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      {Array.from({ length: PARTICLE_COUNT }, (_, i) => (
        <Particle key={i} index={i} />
      ))}
    </View>
  );
}
