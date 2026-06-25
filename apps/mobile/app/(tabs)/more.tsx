import { View, Text, Pressable } from "react-native";
import { signOut } from "@/lib/auth-client";

export default function MoreScreen() {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-background dark:bg-background-dark">
      <Text className="text-base text-muted-foreground dark:text-muted-foreground-dark">Em breve</Text>
      <Pressable onPress={() => signOut()} className="rounded-md border border-border px-4 py-2 dark:border-border-dark">
        <Text className="text-sm font-medium text-destructive dark:text-destructive-dark">Sair</Text>
      </Pressable>
    </View>
  );
}
