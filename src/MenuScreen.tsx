import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  Alert,
  ScrollView,
  TextInput,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { launchTestSuite, validateIntegration } from "./adService";
import { clearAllData } from "./storage";
import { deleteAccount } from "./api";
import { UserData } from "./types";

// Using your colors
const colors = {
  // background: '#0B1014', // Unused, we want transparency
  surfaceGlass: "rgba(15, 26, 32, 0.75)", // Glass effect
  accent: "#00E5FF",
  accentSoft: "rgba(0, 229, 255, 0.15)",
  border: "rgba(0, 229, 255, 0.2)",
  text: "#ffffff",
  textMuted: "#cfeff0",
  error: "#ff6b6b",
};

// ... Keep your Icons (ShopIcon, EmailIcon, etc.) exactly as they are ...
const ShopIcon = () => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
      stroke={colors.accent}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
const EmailIcon = () => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      stroke={colors.accent}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
const DocumentIcon = () => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <Path
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      stroke={colors.accent}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
const LogoutIcon = () => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <Path
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      stroke={colors.error}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
const ArrowIcon = () => (
  <Svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <Path
      d="M7 4l6 6-6 6"
      stroke={colors.textMuted}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
const TrashIcon = () => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <Path
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      stroke={colors.error}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
const HeartIcon = () => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <Path
      d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
      stroke="#ff6b9d"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// ... Keep your helper functions (handleContact, etc.) ...

export default function MenuScreen({
  userData,
  onNavigateToShop,
  onLogout,
  onClose,
  onRequestLogin,
}: any) {
  // Use 'any' or your Interface

  // DEBUG LOG
  React.useEffect(() => {
    console.log(
      "[MenuScreen] Mounted. UserData:",
      userData ? "Present" : "Missing",
    );
  }, [userData]);

  // ... Keep logic (handleContact, handleLogout, etc.) ...
  const handleContact = () => Linking.openURL("mailto:info@astraradio.cz");
  const handleDonate = () => Linking.openURL("https://astraradio.cz/donate");
  const handlePrivacyPolicy = () =>
    Linking.openURL("https://astraradio.cz/privacy");
  const handleTermsOfService = () =>
    Linking.openURL("https://astraradio.cz/terms");

  const handleLogout = () => {
    Alert.alert("Odhlásit se", "Opravdu se chcete odhlásit?", [
      { text: "Zrušit", style: "cancel" },
      {
        text: "Odhlásit",
        style: "destructive",
        onPress: async () => {
          await clearAllData();
          onClose();
          onLogout();
        },
      },
    ]);
  };

  const handleAccountAccess = () => {
    onClose();
    onRequestLogin?.();
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Smazat účet",
      "Opravdu chcete trvale smazat svůj účet? Tato akce je nevratná a přijdete o všechny body a data.",
      [
        { text: "Zrušit", style: "cancel" },
        {
          text: "Smazat účet",
          style: "destructive",
          onPress: () => {
            Alert.prompt(
              "Potvrzení smazání",
              "Pro potvrzení zadejte své heslo:",
              [
                { text: "Zrušit", style: "cancel" },
                {
                  text: "Smazat",
                  style: "destructive",
                  onPress: async (password?: string) => {
                    if (!password) {
                      Alert.alert("Chyba", "Musíte zadat heslo.");
                      return;
                    }
                    try {
                      const result = await deleteAccount(
                        userData.nick,
                        password,
                      );
                      if (result.success) {
                        Alert.alert(
                          "Účet smazán",
                          "Váš účet byl úspěšně smazán.",
                          [
                            {
                              text: "OK",
                              onPress: async () => {
                                await clearAllData();
                                onClose();
                                onLogout();
                              },
                            },
                          ],
                        );
                      } else {
                        Alert.alert(
                          "Chyba",
                          result.message || "Smazání účtu selhalo.",
                        );
                      }
                    } catch (e) {
                      Alert.alert(
                        "Chyba",
                        "Smazání účtu selhalo. Zkuste to znovu.",
                      );
                    }
                  },
                },
              ],
              "secure-text",
            );
          },
        },
      ],
    );
  };
  const handleTestSuite = async () => {
    await launchTestSuite();
  };

  const totalMinutes = Math.max(0, userData.totalListeningMinutes || 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalMins = totalMinutes % 60;
  const isGuest = !userData.hasAccount;

  return (
    <View style={styles.container}>
      {/* 1. Transparent Header Area - REMOVED "MENU" TITLE per user request */}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mainContent}>
          {/* 2. Glassy Account Card */}
          <View style={styles.accountCard}>
            <View style={styles.accountHeader}>
              <Text style={styles.accountTitle}>Můj Účet</Text>
              <Text style={styles.accountStatus}>
                {isGuest ? "Host" : "Člen"}
              </Text>
            </View>

            <Text style={styles.accountNick}>@{userData?.nick ?? "User"}</Text>

            <View style={styles.accountStats}>
              <View style={styles.accountStat}>
                <Text style={styles.accountStatLabel}>Poslechnuto</Text>
                <Text style={styles.accountStatValue}>
                  {totalHours}h {totalMins}m
                </Text>
              </View>
              <View style={styles.accountStat}>
                <Text style={styles.accountStatLabel}>Body</Text>
                <Text style={styles.accountStatValue}>
                  {userData?.points ?? 0}
                </Text>
              </View>
            </View>

            {isGuest && (
              <Pressable
                style={({ pressed }) => [
                  styles.accountCta,
                  pressed && styles.pressed,
                ]}
                onPress={handleAccountAccess}
              >
                <Text style={styles.accountCtaText}>
                  Přihlášení / Registrace
                </Text>
              </Pressable>
            )}
          </View>

          {/* 3. Donate Button - Prominent position */}
          <Pressable
            style={({ pressed }) => [
              styles.donateButton,
              pressed && styles.donateButtonPressed,
            ]}
            onPress={handleDonate}
          >
            <View style={styles.menuButtonIcon}>
              <HeartIcon />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.donateText}>Podpořte Astra Radio</Text>
              <Text style={styles.donateSubtext}>
                Pomozte nám růst – každý příspěvek se počítá ❤️
              </Text>
            </View>
            <ArrowIcon />
          </Pressable>

          {/* 4. Glassy Menu Buttons */}
          <View style={styles.menuGroup}>
            <MenuButton
              icon={<ShopIcon />}
              label="Obchod"
              onPress={() => {
                onClose();
                onNavigateToShop();
              }}
              isFirst
            />
            <MenuButton
              icon={<EmailIcon />}
              label="Kontakt"
              onPress={handleContact}
            />
            <MenuButton
              icon={<DocumentIcon />}
              label="Zásady ochrany údajů"
              onPress={handlePrivacyPolicy}
            />
            <MenuButton
              icon={<DocumentIcon />}
              label="Podmínky použití"
              onPress={handleTermsOfService}
            />

            {__DEV__ && (
              <MenuButton
                icon={<DocumentIcon />}
                label="Test Ads"
                onPress={handleTestSuite}
              />
            )}
          </View>
        </View>

        {/* Logout & Delete Account - Only for logged-in users */}
        {!isGuest && (
          <View>
            <Pressable
              style={({ pressed }) => [
                styles.deleteAccountButton,
                pressed && styles.pressed,
              ]}
              onPress={handleDeleteAccount}
            >
              <View style={styles.menuButtonIcon}>
                <TrashIcon />
              </View>
              <Text style={styles.deleteAccountText}>Smazat účet</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.logoutButton,
                pressed && styles.pressed,
              ]}
              onPress={handleLogout}
            >
              <View style={styles.menuButtonIcon}>
                <LogoutIcon />
              </View>
              <Text style={styles.logoutText}>Odhlásit se</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// Helper Component for Buttons
function MenuButton({ icon, label, onPress, isFirst }: any) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuButton,
        isFirst && { marginTop: 0 },
        pressed && styles.menuButtonPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.menuButtonIcon}>{icon}</View>
      <Text style={styles.menuButtonText}>{label}</Text>
      <ArrowIcon />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent", // IMPORTANT: Transparent
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 24,
    backgroundColor: "transparent",
  },
  title: {
    fontSize: 30, // Slight bump to visually match
    fontFamily: "Inter-SemiBold",
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 1,
    marginTop: 24, // Push down significantly to align
    textTransform: "uppercase",
    textShadowColor: "rgba(0, 229, 255, 0.3)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  content: {
    paddingTop: 20, // Added top padding since header is gone
    paddingBottom: 120, // Clear the absolute TabBar (61px + 44px bottom)
    justifyContent: "space-between", // Distribute content
  },
  mainContent: {
    // Container for Account + Menu Buttons to keep them together at top
  },
  // Account Card Style (Glass)
  accountCard: {
    backgroundColor: colors.surfaceGlass,
    borderRadius: 24,
    padding: 20,
    marginTop: 20, // Extra margin from top to avoid status bar overlap
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accountHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  accountTitle: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  accountStatus: {
    color: colors.textMuted,
    fontSize: 12,
  },
  accountNick: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 16,
  },
  accountStats: {
    flexDirection: "row",
    // gap: 24, // Removed for iOS compatibility
    marginBottom: 8,
  },
  accountStat: {
    marginRight: 24, // Replaces gap: 24 for iOS compatibility
  },
  accountStatLabel: {
    color: colors.textMuted,
    fontSize: 11,
    textTransform: "uppercase",
  },
  accountStatValue: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 2,
  },
  accountCta: {
    marginTop: 16,
    backgroundColor: "rgba(0, 229, 255, 0.1)",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 229, 255, 0.3)",
  },
  accountCtaText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "600",
  },
  // Menu Buttons Group
  menuGroup: {
    // gap: 12, // Removed for iOS compatibility - using marginTop on children instead
  },
  menuButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceGlass,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 12, // Replaces gap: 12 from menuGroup for iOS compatibility
  },
  menuButtonPressed: {
    backgroundColor: "rgba(0, 229, 255, 0.1)",
    transform: [{ scale: 0.99 }],
  },
  menuButtonIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  menuButtonText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "500",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10, // Margin from Menu Group
    marginBottom: 110, // Ensure it clears the TabBar (61px + 44px bottom)
    padding: 16,
    borderRadius: 18,
    backgroundColor: "rgba(255, 107, 107, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 107, 107, 0.3)",
  },
  logoutText: {
    color: "#ff6b6b",
    fontSize: 15,
    fontWeight: "600",
  },
  deleteAccountButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "rgba(255, 107, 107, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 107, 107, 0.15)",
  },
  deleteAccountText: {
    color: "#ff6b6b",
    fontSize: 15,
    fontWeight: "500",
  },
  pressed: {
    opacity: 0.8,
  },
  donateButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 107, 157, 0.1)",
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 107, 157, 0.3)",
    marginBottom: 16,
  },
  donateButtonPressed: {
    backgroundColor: "rgba(255, 107, 157, 0.2)",
    transform: [{ scale: 0.99 }],
  },
  donateText: {
    color: "#ff6b9d",
    fontSize: 15,
    fontWeight: "600",
  },
  donateSubtext: {
    color: "rgba(255, 107, 157, 0.7)",
    fontSize: 12,
    marginTop: 2,
  },
});
