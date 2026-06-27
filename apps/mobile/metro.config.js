const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Monorepo: o Metro varre o node_modules de todos os pacotes do workspace
// (inclusive apps/web, que tem sua própria cópia de react/react-dom). Sem
// isso, arquivos que vivem no store compartilhado do pnpm (ex: dentro de
// @expo/metro-runtime) podem resolver "react" pra cópia errada, causando
// "Invalid hook call"/duas cópias de React no bundle.
// `extraNodeModules` só vale como fallback quando a resolução padrão falha
// (não é o caso aqui — ela "funciona", só que pra cópia errada). Por isso
// usamos `resolveRequest`, que intercepta toda resolução e força o caminho
// certo pra esses dois pacotes específicos.
const FORCED_MODULES = {
  react: path.resolve(__dirname, "node_modules/react"),
  "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
};
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (FORCED_MODULES[moduleName]) {
    return { type: "sourceFile", filePath: require.resolve(FORCED_MODULES[moduleName]) };
  }
  if (defaultResolveRequest) return defaultResolveRequest(context, moduleName, platform);
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
