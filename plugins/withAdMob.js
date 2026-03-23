/**
 * Expo config plugin to inject AdMob configuration into native projects.
 * Ensures GADApplicationIdentifier (iOS) and com.google.android.gms.ads.APPLICATION_ID (Android)
 * survive `npx expo prebuild`.
 */
const { withInfoPlist, withAndroidManifest } = require("expo/config-plugins");

const IOS_ADMOB_APP_ID = "ca-app-pub-4420537843593379~6533337185";
const ANDROID_ADMOB_APP_ID = "ca-app-pub-4420537843593379~2856707861";

function withAdMobIos(config) {
  return withInfoPlist(config, (mod) => {
    mod.modResults.GADApplicationIdentifier = IOS_ADMOB_APP_ID;
    return mod;
  });
}

function withAdMobAndroid(config) {
  return withAndroidManifest(config, (mod) => {
    const mainApplication = mod.modResults.manifest.application?.[0];
    if (!mainApplication) return mod;

    // Ensure meta-data array exists
    if (!mainApplication["meta-data"]) {
      mainApplication["meta-data"] = [];
    }

    const metaDataKey = "com.google.android.gms.ads.APPLICATION_ID";

    // Check if already present
    const existing = mainApplication["meta-data"].find(
      (item) => item.$?.["android:name"] === metaDataKey,
    );

    if (!existing) {
      mainApplication["meta-data"].push({
        $: {
          "android:name": metaDataKey,
          "android:value": ANDROID_ADMOB_APP_ID,
        },
      });
    } else {
      existing.$["android:value"] = ANDROID_ADMOB_APP_ID;
    }

    return mod;
  });
}

module.exports = function withAdMob(config) {
  config = withAdMobIos(config);
  config = withAdMobAndroid(config);
  return config;
};
