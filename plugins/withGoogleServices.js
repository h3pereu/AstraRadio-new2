/**
 * Expo config plugin that copies Firebase config files into the native projects
 * during `expo prebuild` / EAS Build.
 *
 * Required for AdMob to initialise on Android (google-services.json) and for
 * full Firebase/AdMob functionality on iOS (GoogleService-Info.plist).
 *
 * Before running a build, place both files in the project root:
 *   - google-services.json         (download from Firebase Console → Android app)
 *   - GoogleService-Info.plist     (download from Firebase Console → iOS app)
 */
const {
  withDangerousMod,
  withAppBuildGradle,
  withProjectBuildGradle,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// ─── Android ─────────────────────────────────────────────────────────────────

/** Copy google-services.json → android/app/google-services.json */
function withGoogleServicesAndroid(config) {
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      const src = path.join(mod.modRequest.projectRoot, 'google-services.json');
      const dest = path.join(
        mod.modRequest.platformProjectRoot,
        'app',
        'google-services.json'
      );

      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log('[withGoogleServices] ✅ Copied google-services.json → android/app/');
      } else {
        console.warn(
          '[withGoogleServices] ⚠️  google-services.json not found in project root.\n' +
          '    AdMob will NOT initialise on Android without it.\n' +
          '    Download it from the Firebase Console for the cz.astraradio.radio Android app.'
        );
      }
      return mod;
    },
  ]);
}

/**
 * Apply `com.google.gms.google-services` gradle plugin to app/build.gradle.
 * This plugin processes google-services.json and generates the Firebase config
 * resources required by the Google Mobile Ads (AdMob) SDK on Android.
 */
function withGoogleServicesGradle(config) {
  return withAppBuildGradle(config, (mod) => {
    if (!mod.modResults.contents.includes('com.google.gms.google-services')) {
      // Append at the very end of the file, after all other blocks
      mod.modResults.contents =
        mod.modResults.contents.trimEnd() +
        '\n\napply plugin: "com.google.gms.google-services"\n';
      console.log('[withGoogleServices] ✅ Applied com.google.gms.google-services plugin in app/build.gradle');
    }
    return mod;
  });
}

// ─── iOS ─────────────────────────────────────────────────────────────────────

/** Copy GoogleService-Info.plist → ios/<AppName>/GoogleService-Info.plist */
function withGoogleServicesIos(config) {
  return withDangerousMod(config, [
    'ios',
    async (mod) => {
      const src = path.join(mod.modRequest.projectRoot, 'GoogleService-Info.plist');
      const dest = path.join(
        mod.modRequest.platformProjectRoot,
        mod.modRequest.projectName,
        'GoogleService-Info.plist'
      );

      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log('[withGoogleServices] ✅ Copied GoogleService-Info.plist → ios/<app>/');
      } else {
        console.warn(
          '[withGoogleServices] ⚠️  GoogleService-Info.plist not found in project root.\n' +
          '    Download it from the Firebase Console for the cz.astraradio.radio iOS app.'
        );
      }
      return mod;
    },
  ]);
}

// ─── Export ───────────────────────────────────────────────────────────────────

function withGoogleServicesClasspath(config) {
  return withProjectBuildGradle(config, (mod) => {
    const classpath = "classpath('com.google.gms:google-services:4.4.2')";
    if (!mod.modResults.contents.includes('com.google.gms:google-services')) {
      mod.modResults.contents = mod.modResults.contents.replace(
        "classpath('com.android.tools.build:gradle')",
        `classpath('com.android.tools.build:gradle')\n    ${classpath}`
      );
      console.log('[withGoogleServices] ✅ Added google-services classpath to android/build.gradle');
    }
    return mod;
  });
}

module.exports = function withGoogleServices(config) {
  config = withGoogleServicesAndroid(config);
  config = withGoogleServicesClasspath(config);
  config = withGoogleServicesGradle(config);
  config = withGoogleServicesIos(config);
  return config;
};
