const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Expo config plugin that adds modular_headers for TikTokBusinessSDK
 * so pod install doesn't fail after `expo prebuild --clean`.
 */
module.exports = function withTikTokModularHeaders(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile",
      );
      let podfile = fs.readFileSync(podfilePath, "utf8");

      const marker = "pod 'TikTokBusinessSDK', :modular_headers => true";
      if (!podfile.includes(marker)) {
        // Insert right before use_react_native!
        podfile = podfile.replace(
          "use_react_native!(",
          `# TikTok Business SDK requires modular headers for Swift interop\n  ${marker}\n\n  use_react_native!(`,
        );
        fs.writeFileSync(podfilePath, podfile, "utf8");
      }

      return config;
    },
  ]);
};
