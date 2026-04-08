// Main App Entry Point with Login Flow

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
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
// DISABLED FOR DEBUGGING: import { initializeAds } from './src/adService';

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

  // Wait for both network check (isLoading) and fonts
  if (isLoading || !fontsLoaded) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00E5FF" />
        </View>
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
