// Main App Entry Point with Login Flow

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  Image,
  Text,
  Pressable,
  Platform,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font"; // Import useFonts
import NetInfo from "@react-native-community/netinfo";
import {
  getUserData,
  isOnboardingComplete,
  setOnboardingComplete,
  syncWithRemote,
} from "./src/storage";
import { UserData } from "./src/types";
import LoginScreen from "./src/LoginScreen";
import MainApp from "./App";
import { DebugOverlay } from "./src/DebugOverlay"; // Import debug overlay
import {
  initTikTok,
  identifyUser,
  trackLogin,
  logoutTikTok,
} from "./src/tiktok";
import { trackAppSession } from "./src/reviewPrompt";
import { requestTrackingPermissionsAsync } from "expo-tracking-transparency";
import * as SplashScreen from "expo-splash-screen";
// DISABLED FOR DEBUGGING: import { initializeAds } from './src/adService';

// Keep the native splash visible until JS is ready
SplashScreen.preventAutoHideAsync().catch(() => {});

function LoadingScreen() {
  const logoAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Logo entrance
    Animated.spring(logoAnim, {
      toValue: 1,
      tension: 60,
      friction: 10,
      useNativeDriver: true,
    }).start();

    // Glow pulse loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Bouncing dots
    const makeBounce = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: -10, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(val, { toValue: 0, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.delay(600),
        ])
      );

    Animated.parallel([
      makeBounce(dot1, 0),
      makeBounce(dot2, 180),
      makeBounce(dot3, 360),
    ]).start();
  }, []);

  const logoScale = logoAnim.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] });
  const glowScale = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  const dot1Opacity = dot1.interpolate({ inputRange: [-10, 0], outputRange: [1, 0.35] });
  const dot2Opacity = dot2.interpolate({ inputRange: [-10, 0], outputRange: [1, 0.35] });
  const dot3Opacity = dot3.interpolate({ inputRange: [-10, 0], outputRange: [1, 0.35] });

  return (
    <View style={loadingStyles.container}>
      <Animated.View style={[loadingStyles.ambient, { transform: [{ scale: glowScale }], opacity: glowOpacity }]} />
      <Animated.View style={[loadingStyles.logoWrap, { opacity: logoAnim, transform: [{ scale: logoScale }] }]}>
        <Animated.View style={[loadingStyles.glowRing, { transform: [{ scale: glowScale }], opacity: glowOpacity }]} />
        <Image source={require("./assets/splash-icon.png")} style={loadingStyles.logo} />
      </Animated.View>
      <View style={loadingStyles.dots}>
        <Animated.View style={[loadingStyles.dot, { transform: [{ translateY: dot1 }], opacity: dot1Opacity }]} />
        <Animated.View style={[loadingStyles.dot, { transform: [{ translateY: dot2 }], opacity: dot2Opacity }]} />
        <Animated.View style={[loadingStyles.dot, { transform: [{ translateY: dot3 }], opacity: dot3Opacity }]} />
      </View>
    </View>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1014",
    alignItems: "center",
    justifyContent: "center",
  },
  ambient: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(0,229,255,0.07)",
  },
  logoWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 64,
  },
  glowRing: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: "rgba(0,229,255,0.18)",
  },
  logo: {
    width: 140,
    height: 140,
    borderRadius: 28,
  },
  dots: {
    flexDirection: "row",
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#00E5FF",
  },
});

export default function AppRoot() {
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [showLogin, setShowLogin] = useState(false);

  // Load fonts globally
  const [fontsLoaded] = useFonts({
    "Inter-SemiBold": require("./assets/fonts/Inter-SemiBold.ttf"),
    "Inter-Regular": require("./assets/fonts/Inter-Regular.ttf"),
    "Onest-Bold": require("./assets/fonts/Onest-Bold.ttf"),
    Orbitron: require("./assets/fonts/Orbitron.ttf"), // Load Orbitron just in case, but we'll switch to Inter
  });

  // DEBUG LOG
  useEffect(() => {
    console.log(
      "[AppRoot] Current UserData state:",
      JSON.stringify(userData, null, 2),
    );
    console.log("[AppRoot] ShowLogin state:", showLogin);
    console.log("[AppRoot] IsLoading state:", isLoading);
  }, [userData, showLogin, isLoading]);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const isOfflineRef = React.useRef(false); // Ref to avoid stale closure

  useEffect(() => {
    // Request App Tracking Transparency permission on iOS
    if (Platform.OS === 'ios') {
      requestTrackingPermissionsAsync().catch(() => {});
    }

    // Initialize TikTok SDK on app start
    initTikTok();

    // Track app session for review prompt
    trackAppSession();

    // ALWAYS load user data from local storage first, regardless of network
    // This is the critical fix for iOS where NetInfo returns null initially
    checkUserStatus();

    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener((state) => {
      // iOS: isInternetReachable can be null initially — treat null as "online" (optimistic)
      const nowOffline =
        state.isConnected === false || state.isInternetReachable === false;
      const wasOffline = isOfflineRef.current;
      isOfflineRef.current = nowOffline;
      setIsOffline(nowOffline);

      console.log("[AppRoot] Network changed:", {
        connected: state.isConnected,
        reachable: state.isInternetReachable,
        wasOffline,
        nowOffline,
      });

      // If we just came back online, re-sync
      if (wasOffline && !nowOffline) {
        console.log("[AppRoot] Back online, re-checking user status...");
        checkUserStatus();
      }
    });

    return () => unsubscribe();
  }, []);

  const checkUserStatus = async () => {
    try {
      console.log("[AppRoot] Checking user status...");
      const onboardingDone = await isOnboardingComplete();
      console.log("[AppRoot] Onboarding done:", onboardingDone);
      const user = await getUserData();
      console.log("[AppRoot] User data:", user);

      if (!onboardingDone || !user) {
        setShowLogin(true);
      } else {
        // user exists locally
        // Try to sync with remote to get latest points (if online)
        try {
          if (user.hasAccount) {
            console.log("[AppRoot] Syncing with remote on startup...");
            const latestUser = await syncWithRemote(user.nick);
            const resolvedUser = latestUser || user;
            setUserData(resolvedUser);
            // Identify returning user to TikTok
            identifyUser(resolvedUser.nick, resolvedUser.nick);
          } else {
            // Guest -> just use local
            setUserData(user);
            identifyUser(user.nick, user.nick);
          }
        } catch (syncErr) {
          console.warn("[AppRoot] Startup sync failed, using local:", syncErr);
          setUserData(user);
        }
        setShowLogin(false);
      }
    } catch (err) {
      console.error("[AppRoot] Error checking user status:", err);
      setError(String(err));
      setShowLogin(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = useCallback(async () => {
    setIsLoading(true);
    const state = await NetInfo.fetch();
    if (state.isConnected && state.isInternetReachable) {
      setIsOffline(false);
      await checkUserStatus();
    } else {
      setIsOffline(true);
      setIsLoading(false);
    }
  }, []);

  const handleLoginComplete = useCallback(async (user: UserData) => {
    try {
      console.log("[AppRoot] Login complete, user:", user);
      await setOnboardingComplete();
      setUserData(user);
      setShowLogin(false);
      // TikTok: identify user and track login
      identifyUser(user.nick, user.nick);
      trackLogin();
    } catch (err) {
      console.error("[AppRoot] Error in handleLoginComplete:", err);
      setError(String(err));
    }
  }, []);

  const handleUserDataChange = useCallback((user: UserData) => {
    console.log("[AppRoot] User data changed:", user);
    setUserData(user);
  }, []);

  const handleRequestLogin = useCallback(() => {
    setShowLogin(true);
  }, []);

  const handleLogout = useCallback(() => {
    logoutTikTok();
    setUserData(null);
    setShowLogin(true);
  }, []);

  // Offline screen
  if (isOffline && !isLoading) {
    return (
      <SafeAreaProvider>
        <View style={styles.offlineContainer}>
          <Text style={styles.offlineIcon}>📡</Text>
          <Text style={styles.offlineTitle}>Bez připojení</Text>
          <Text style={styles.offlineText}>
            Pro používání Astra Radio je potřeba internetové připojení.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.retryButtonPressed,
            ]}
            onPress={handleRetry}
          >
            <Text style={styles.retryButtonText}>Zkusit znovu</Text>
          </Pressable>
        </View>
      </SafeAreaProvider>
    );
  }

  // Hide native splash as soon as fonts are ready, then show our animated screen
  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  // Wait for both network check (isLoading) and fonts
  if (isLoading || !fontsLoaded) {
    return (
      <SafeAreaProvider>
        <LoadingScreen />
      </SafeAreaProvider>
    );
  }

  if (error) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  if (showLogin) {
    return (
      <SafeAreaProvider>
        <LoginScreen onLoginComplete={handleLoginComplete} />
      </SafeAreaProvider>
    );
  }

  return (
    <>
      <MainApp
        userData={userData}
        onUserDataChange={handleUserDataChange}
        onRequestLogin={handleRequestLogin}
        onLogout={handleLogout}
      />
      {__DEV__ && <DebugOverlay />}
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0B1014",
    alignItems: "center",
    justifyContent: "center",
  },
  offlineContainer: {
    flex: 1,
    backgroundColor: "#0B1014",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  offlineIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  offlineTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#00E5FF",
    marginBottom: 12,
    letterSpacing: 1,
  },
  offlineText: {
    fontSize: 15,
    color: "#cfeff0",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  retryButton: {
    backgroundColor: "#00E5FF",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  retryButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  retryButtonText: {
    color: "#0B1014",
    fontSize: 16,
    fontWeight: "600",
  },
  errorText: {
    color: "#f39c9c",
    fontSize: 14,
    textAlign: "center",
    padding: 20,
  },
});
