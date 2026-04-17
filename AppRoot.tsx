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
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
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
import { DebugOverlay } from "./src/DebugOverlay";
import {
  initTikTok,
  identifyUser,
  trackLogin,
  logoutTikTok,
} from "./src/tiktok";
import { trackAppSession } from "./src/reviewPrompt";
import { requestTrackingPermissionsAsync } from "expo-tracking-transparency";
import * as SplashScreen from "expo-splash-screen";

SplashScreen.preventAutoHideAsync().catch(() => {});

function LoadingScreen() {
  const logoAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(logoAnim, {
      toValue: 1,
      tension: 60,
      friction: 10,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

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

  const [fontsLoaded] = useFonts({
    "Inter-SemiBold": require("./assets/fonts/Inter-SemiBold.ttf"),
    "Inter-Regular": require("./assets/fonts/Inter-Regular.ttf"),
    "Onest-Bold": require("./assets/fonts/Onest-Bold.ttf"),
    Orbitron: require("./assets/fonts/Orbitron.ttf"),
  });

  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const isOfflineRef = React.useRef(false);
  const offlineFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(offlineFade, {
      toValue: isOffline ? 1 : 0,
      duration: 300, // 300ms smooth fade
      useNativeDriver: true,
    }).start();
  }, [isOffline]);

  const attRequested = useRef(false);
  useEffect(() => {
    if (!isLoading && fontsLoaded && !attRequested.current) {
      attRequested.current = true;
      if (Platform.OS === 'ios') {
        setTimeout(() => {
          requestTrackingPermissionsAsync().catch((err) => {
            console.warn('[AppRoot] ATT request failed:', err);
          });
        }, 500);
      }
    }
  }, [isLoading, fontsLoaded]);

  useEffect(() => {
    initTikTok();
    trackAppSession();
    checkUserStatus();

    const unsubscribe = NetInfo.addEventListener((state) => {
      const nowOffline = state.isConnected === false || state.isInternetReachable === false;
      const wasOffline = isOfflineRef.current;
      isOfflineRef.current = nowOffline;
      setIsOffline(nowOffline);

      if (wasOffline && !nowOffline) {
        checkUserStatus();
      }
    });

    return () => unsubscribe();
  }, []);

  const checkUserStatus = async () => {
    try {
      const onboardingDone = await isOnboardingComplete();
      const user = await getUserData();

      if (!onboardingDone || !user) {
        setShowLogin(true);
      } else {
        try {
          if (user.hasAccount) {
            const latestUser = await syncWithRemote(user.nick);
            const resolvedUser = latestUser || user;
            setUserData(resolvedUser);
            identifyUser(resolvedUser.nick, resolvedUser.nick);
          } else {
            setUserData(user);
            identifyUser(user.nick, user.nick);
          }
        } catch (syncErr) {
          setUserData(user);
        }
        setShowLogin(false);
      }
    } catch (err) {
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
      await setOnboardingComplete();
      setUserData(user);
      setShowLogin(false);
      identifyUser(user.nick, user.nick);
      trackLogin();
    } catch (err) {
      setError(String(err));
    }
  }, []);

  const handleUserDataChange = useCallback((user: UserData) => {
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

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  const renderContent = () => {
    if (isLoading || !fontsLoaded) {
      return <LoadingScreen />;
    }

    if (error) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
        </View>
      );
    }

    return (
      <>
        {/* 1. ALWAYS keep the current screen mounted so SDKs don't crash */}
        {showLogin ? (
          <LoginScreen onLoginComplete={handleLoginComplete} />
        ) : (
          <MainApp
            userData={userData}
            onUserDataChange={handleUserDataChange}
            onRequestLogin={handleRequestLogin}
            onLogout={handleLogout}
          />
        )}
        
        {__DEV__ && <DebugOverlay />}

        {/* 2. OVERLAY the offline screen with a smooth fade */}
        {isOffline && !isLoading && (
          <Animated.View 
            style={[
              StyleSheet.absoluteFill, 
              styles.offlineContainer, 
              { zIndex: 9999, opacity: offlineFade } 
            ]}
          >
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
          </Animated.View>
        )}
      </>
    );
  };

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: '#0B1014' }}>
      {renderContent()}
    </SafeAreaProvider>
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