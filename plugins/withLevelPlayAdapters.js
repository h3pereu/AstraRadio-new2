/**
 * Expo config plugin that installs the native LevelPlay mediation adapter SDKs
 * for Google AdMob, Meta (Facebook), Liftoff Monetize (Vungle), and Yandex.
 *
 * Without these native adapter libraries, Unity LevelPlay can only serve ads
 * from its own Unity/IronSource network — all other networks are silently skipped.
 *
 * ⚠️  IMPORTANT: Adapter versions must be compatible with the LevelPlay SDK version
 * installed in your project (unity-levelplay-mediation). Always verify adapter
 * version numbers in the LevelPlay Integration Center before building:
 *   https://levelplay.com/resources/integration-center/
 *
 * The adapter versions below are targeted for LevelPlay SDK v9.x.
 * Update them if you upgrade or downgrade the core SDK.
 */
const {
  withDangerousMod,
  withAppBuildGradle,
  withProjectBuildGradle,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// ─── Adapter definitions ──────────────────────────────────────────────────────

const IOS_ADAPTER_PODS = [
  // Google AdMob — required for AdMob ads via LevelPlay mediation
  "  pod 'IronSourceAdMobAdapter'",
  // Meta Audience Network
  "  pod 'IronSourceFacebookAdapter'",
  // Liftoff Monetize (formerly Vungle)
  "  pod 'IronSourceVungleAdapter'",
  // Yandex Ads
  "  pod 'IronSourceYandexAdapter'",
];

// IronSource Maven repository URL
const IS_MAVEN_REPO = 'https://android-sdk.is.com/';
// Yandex Maven repository URL
const YANDEX_MAVEN_REPO = 'https://artifactory.mobileadx.ru/artifactory/yandex-mobile-ads-sdk-releases/';

// Adapter artifact coordinates (verify versions at https://levelplay.com/resources/integration-center/)
// Note: facebookadapter removed — requires Facebook App + Client Token not configured
const ANDROID_ADAPTER_DEPS = [
  "    implementation 'com.ironsource.adapters:admobadapter:4.3.44'",
  "    implementation 'com.google.android.gms:play-services-ads:23.4.0'",
  "    implementation 'com.ironsource.adapters:vungleadapter:4.3.26'",
  "    implementation 'com.vungle:vungle-ads:7.4.2'",
  "    implementation 'com.ironsource.adapters:yandexadapter:4.3.6'",
  "    implementation 'com.yandex.android:mobileads:7.18.4'",
];

// ─── iOS ─────────────────────────────────────────────────────────────────────

/**
 * Add IronSource adapter pods inside the main target block of the Podfile.
 * Uses `use_expo_modules!` as the insertion anchor (always present in Expo apps).
 */
function withLevelPlayAdaptersIos(config) {
  return withDangerousMod(config, [
    'ios',
    async (mod) => {
      const podfilePath = path.join(mod.modRequest.platformProjectRoot, 'Podfile');

      if (!fs.existsSync(podfilePath)) {
        console.warn('[withLevelPlayAdapters] Podfile not found — skipping iOS adapter setup');
        return mod;
      }

      let contents = fs.readFileSync(podfilePath, 'utf-8');

      // Only add pods that aren't already present
      const podsToAdd = IOS_ADAPTER_PODS.filter(
        (pod) => !contents.includes(pod.trim().split(' ')[1].replace(/'/g, ''))
      );

      if (podsToAdd.length === 0) {
        console.log('[withLevelPlayAdapters] iOS adapter pods already present — skipping');
        return mod;
      }

      const anchor = '  use_expo_modules!';
      if (!contents.includes(anchor)) {
        console.warn(
          '[withLevelPlayAdapters] Could not find `use_expo_modules!` in Podfile — ' +
          'skipping iOS adapter setup. Add adapter pods manually:\n' +
          podsToAdd.join('\n')
        );
        return mod;
      }

      const insertion = podsToAdd.join('\n');
      contents = contents.replace(anchor, `${anchor}\n\n  # LevelPlay mediation network adapters\n${insertion}`);
      fs.writeFileSync(podfilePath, contents);

      console.log(
        '[withLevelPlayAdapters] ✅ Added iOS adapter pods:\n  ' +
        podsToAdd.map((p) => p.trim()).join('\n  ')
      );

      return mod;
    },
  ]);
}

// ─── Android ─────────────────────────────────────────────────────────────────

/**
 * Add the IronSource Maven repository to android/build.gradle (allprojects block).
 * This is where the adapter AAR artifacts are hosted.
 */
function withLevelPlayMavenRepo(config) {
  return withProjectBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents;

    const reposToAdd = [];
    if (!contents.includes(IS_MAVEN_REPO)) reposToAdd.push(`    maven { url '${IS_MAVEN_REPO}' }`);
    if (!contents.includes(YANDEX_MAVEN_REPO)) reposToAdd.push(`    maven { url '${YANDEX_MAVEN_REPO}' }`);

    if (reposToAdd.length === 0) {
      return mod;
    }

    const repoAnchor = 'allprojects {';
    if (contents.includes(repoAnchor)) {
      const allProjectsIdx = contents.indexOf(repoAnchor);
      const repoIdx = contents.indexOf('repositories {', allProjectsIdx);

      if (repoIdx !== -1) {
        mod.modResults.contents =
          contents.slice(0, repoIdx + 'repositories {'.length) +
          `\n${reposToAdd.join('\n')}` +
          contents.slice(repoIdx + 'repositories {'.length);

        console.log('[withLevelPlayAdapters] ✅ Added Maven repos to android/build.gradle');
        return mod;
      }
    }

    // Fallback: append at the end
    mod.modResults.contents =
      contents.trimEnd() +
      `\n\n// Ad SDK Maven repositories\nallprojects {\n  repositories {\n${reposToAdd.join('\n')}\n  }\n}\n`;
    console.log('[withLevelPlayAdapters] ✅ Added Maven repos (fallback) to android/build.gradle');

    return mod;
  });
}

/**
 * Add LevelPlay network adapter dependencies to app/build.gradle.
 */
function withLevelPlayAdaptersAndroid(config) {
  return withAppBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents;

    // Filter out adapters already present
    const depsToAdd = ANDROID_ADAPTER_DEPS.filter((dep) => {
      // Extract artifact name (e.g. 'admobadapter') for a looser existence check
      const artifact = dep.trim().split(':')[1];
      return !contents.includes(artifact);
    });

    if (depsToAdd.length === 0) {
      console.log('[withLevelPlayAdapters] Android adapter deps already present — skipping');
      return mod;
    }

    const depAnchor = 'dependencies {';
    if (!contents.includes(depAnchor)) {
      console.warn(
        '[withLevelPlayAdapters] Could not find `dependencies {` in app/build.gradle — ' +
        'skipping Android adapter setup. Add these lines manually:\n' +
        depsToAdd.join('\n')
      );
      return mod;
    }

    const insertion = `\n    // LevelPlay mediation network adapters\n${depsToAdd.join('\n')}`;
    contents = contents.replace(depAnchor, `${depAnchor}${insertion}`);
    mod.modResults.contents = contents;

    console.log(
      '[withLevelPlayAdapters] ✅ Added Android adapter deps:\n  ' +
      depsToAdd.map((d) => d.trim()).join('\n  ')
    );

    return mod;
  });
}

// ─── Export ───────────────────────────────────────────────────────────────────

module.exports = function withLevelPlayAdapters(config) {
  config = withLevelPlayAdaptersIos(config);
  config = withLevelPlayMavenRepo(config);
  config = withLevelPlayAdaptersAndroid(config);
  return config;
};
