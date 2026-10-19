import { Platform } from "react-native";
import type { ChangelogPlatform } from "@finances/validations";

/** Plataforma deste aparelho, para a API mandar só as novidades que valem aqui. */
export const CHANGELOG_PLATFORM: ChangelogPlatform = Platform.OS === "ios" ? "ios" : "android";
