import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from "react-native";

/** Folga entre o campo e a borda visível ao rolar até ele. */
const MARGIN = 24;

/**
 * Empurra o conteúdo para cima na altura do teclado, nos dois sistemas.
 *
 * No Android edge-to-edge (padrão do Expo atual) a janela não encolhe quando o
 * teclado abre, então o "behavior" precisa valer no Android também. O
 * KeyboardAvoidingView mede a própria posição relativa ao pai; abaixo do
 * cabeçalho nativo isso subestima a sobreposição, por isso a posição real na
 * janela vira o `keyboardVerticalOffset`.
 */
export function KeyboardAvoidingArea({ children }: { children: ReactNode }) {
  const containerRef = useRef<View>(null);
  const [offset, setOffset] = useState(0);
  return (
    <View
      ref={containerRef}
      style={{ flex: 1 }}
      onLayout={() => containerRef.current?.measureInWindow((_x, y) => setOffset(y))}
    >
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={offset} style={{ flex: 1 }}>
        {children}
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * ScrollView de formulário que mantém o campo focado acima do teclado: os
 * campos do fim do formulário ficavam por baixo dele no Android. Além do espaço
 * do teclado (KeyboardAvoidingArea), rola até o campo focado se ele ainda
 * estiver fora da área visível.
 */
export function FormScrollView({ children, onScroll, onLayout, ...props }: ScrollViewProps) {
  const scrollRef = useRef<ScrollView>(null);
  const innerRef = useRef<View>(null);
  const scrollY = useRef(0);
  const viewportHeight = useRef(0);

  useEffect(() => {
    const scrollToFocused = () => {
      const input = TextInput.State.currentlyFocusedInput();
      const scroll = scrollRef.current;
      const inner = innerRef.current;
      if (!input || !scroll || !inner) return;
      input.measureLayout(
        inner,
        (_x, y, _width, height) => {
          const visibleTop = scrollY.current;
          const visibleBottom = visibleTop + viewportHeight.current;
          const hidden = y < visibleTop || y + height + MARGIN > visibleBottom;
          if (hidden) scroll.scrollTo({ y: Math.max(0, y - MARGIN * 3), animated: true });
        },
        () => {}
      );
    };

    // Espera o KeyboardAvoidingView aplicar o espaço antes de medir.
    const event = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    let timer: ReturnType<typeof setTimeout> | undefined;
    const subscription = Keyboard.addListener(event, () => {
      clearTimeout(timer);
      timer = setTimeout(scrollToFocused, Platform.OS === "ios" ? 300 : 120);
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return (
    <KeyboardAvoidingArea>
      <ScrollView
        ref={scrollRef}
        // O tipo do RN não admite null; o ref é preenchido na montagem.
        innerViewRef={innerRef as RefObject<View>}
        // Tocar num chip (categoria, forma de pagamento) com o teclado aberto
        // já seleciona, em vez de gastar o toque só fechando o teclado.
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
          scrollY.current = event.nativeEvent.contentOffset.y;
          onScroll?.(event);
        }}
        onLayout={(event: LayoutChangeEvent) => {
          viewportHeight.current = event.nativeEvent.layout.height;
          onLayout?.(event);
        }}
        {...props}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingArea>
  );
}
