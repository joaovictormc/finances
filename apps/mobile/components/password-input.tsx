import { useState } from "react";
import { View, TextInput, Pressable, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";

export function PasswordInput({ className, ...props }: TextInputProps) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);

  return (
    <View className="relative justify-center">
      <TextInput
        className={`rounded-md border border-border bg-card px-3 py-3 pr-11 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark ${className ?? ""}`}
        placeholderTextColor={colors.mutedForeground}
        secureTextEntry={!visible}
        {...props}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={visible ? "Ocultar senha" : "Mostrar senha"}
        className="absolute right-0 h-full justify-center px-3"
      >
        <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={18} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}
