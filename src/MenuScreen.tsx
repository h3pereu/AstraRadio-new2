import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  Alert,
  TextInput,
  Platform,
  useWindowDimensions,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { clearAllData } from "./storage";
import { deleteAccount } from "./api";
import { UserData } from "./types";
import { getActiveBadgeTier, BADGE_TIERS } from "./config";

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

const RankIcon = ({
  tierId,
  size = 24,
}: {
  tierId?: string;
  size?: number;
}) => {
  switch (tierId) {
    case "badge_10h":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 13c2-2 4-2 6 0s4 2 6 0 4-2 4-2"
            stroke={colors.accent}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </Svg>
      );
    case "badge_50h":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 10c2-2 4-2 6 0s4 2 6 0 4-2 4-2"
            stroke={colors.accent}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <Path
            d="M4 14c2-2 4-2 6 0s4 2 6 0 4-2 4-2"
            stroke={colors.accent}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </Svg>
      );
    case "badge_100h":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M10 5v10.5a2.5 2.5 0 11-2-2.45V7l8-2v8.5a2.5 2.5 0 11-2-2.45V5"
            stroke={colors.accent}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case "badge_150h":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 15a4 4 0 004-4V8a4 4 0 10-8 0v3a4 4 0 004 4zm0 0v4m-3 0h6"
            stroke={colors.accent}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case "badge_200h":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 13v-1a8 8 0 0116 0v1m-2 0v3a2 2 0 01-2 2h-1m-6 0H8a2 2 0 01-2-2v-3m6 5v2"
            stroke={colors.accent}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case "badge_300h":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M6 18V9m6 9V5m6 13v-7"
            stroke={colors.accent}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </Svg>
      );
    case "badge_400h":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 7l4 4 4-5 4 5 4-4-2 11H6L4 7z"
            stroke={colors.accent}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case "badge_500h":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.3-4.8-2.6-4.8 2.6.9-5.3-3.9-3.8 5.4-.8L12 4z"
            stroke={colors.accent}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    default:
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 5v14m-7-7h14"
            stroke={colors.accent}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </Svg>
      );
  }
};

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
  const totalMinutes = Math.max(0, userData.totalListeningMinutes || 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalMins = totalMinutes % 60;
  const isGuest = !userData.hasAccount;
  const { height } = useWindowDimensions();
  const isCompact = height < 760;
  const footerClearance = isCompact ? 108 : 116;

  // Badge progress
  const activeTier = getActiveBadgeTier(totalMinutes);
  const nextTier = BADGE_TIERS.find(t => (totalMinutes / 60) < t.hoursRequired) ?? null;
  const multiplier = activeTier ? activeTier.multiplier : 1.0;

  return (
    <View style={styles.container}>
      {/* 1. Transparent Header Area - REMOVED "MENU" TITLE per user request */}

      <View style={styles.accountFixedArea}>
        {/* 2. Glassy Account Card */}
        <View style={[styles.accountCard, isCompact && styles.accountCardCompact]}>
          <View style={styles.accountHeader}>
            <Text style={styles.accountTitle}>Můj Účet</Text>
            <Text style={styles.accountStatus}>{isGuest ? "Host" : "Člen"}</Text>
          </View>

          <Text style={[styles.accountNick, isCompact && styles.accountNickCompact]}>
            @{userData?.nick ?? "User"}
          </Text>

          <View style={styles.accountStats}>
            <View style={[styles.accountStat, isCompact && styles.accountStatCompact]}>
              <Text style={styles.accountStatLabel}>Poslechnuto</Text>
              <Text style={styles.accountStatValue}>
                {totalHours}h {totalMins}m
              </Text>
            </View>
            <View style={[styles.accountStat, isCompact && styles.accountStatCompact]}>
              <Text style={styles.accountStatLabel}>Body</Text>
              <Text style={styles.accountStatValue}>{userData?.points ?? 0}</Text>
            </View>
            <View style={[styles.accountStat, isCompact && styles.accountStatCompact]}>
              <Text style={styles.accountStatLabel}>Multiplikátor</Text>
              <Text style={styles.accountStatValue}>{multiplier.toFixed(2)}×</Text>
            </View>
          </View>

          {/* Badge row */}
          {activeTier ? (
            <View style={[styles.badgeRow, isCompact && styles.badgeRowCompact]}>
              <View style={[styles.badgeIcon, isCompact && styles.badgeIconCompact]}>
                <RankIcon tierId={activeTier.id} size={isCompact ? 20 : 24} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.badgeTitle}>{activeTier.title}</Text>
                {nextTier ? (
                  <Text style={[styles.badgeNext, isCompact && styles.badgeNextCompact]}>
                    Další odznak za {Math.ceil(nextTier.hoursRequired - totalMinutes / 60)}h poslechu
                  </Text>
                ) : (
                  <Text style={[styles.badgeNext, isCompact && styles.badgeNextCompact]}>
                    Maximální úroveň
                  </Text>
                )}
              </View>
            </View>
          ) : nextTier ? (
            <View style={[styles.badgeRow, isCompact && styles.badgeRowCompact]}>
              <View style={[styles.badgeIcon, isCompact && styles.badgeIconCompact]}>
                <RankIcon tierId={nextTier.id} size={isCompact ? 20 : 24} />
              </View>
              <Text style={[styles.badgeNext, isCompact && styles.badgeNextCompact]}>
                První odznak za {Math.ceil(nextTier.hoursRequired - totalMinutes / 60)}h poslechu
              </Text>
            </View>
          ) : null}

          {isGuest && (
            <Pressable
              style={({ pressed }) => [
                styles.accountCta,
                isCompact && styles.accountCtaCompact,
                pressed && styles.pressed,
              ]}
              onPress={handleAccountAccess}
            >
              <Text style={styles.accountCtaText}>Přihlášení / Registrace</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View
        style={[
          styles.actionsArea,
          !isGuest && styles.actionsAreaWithFooter,
          !isGuest && { paddingBottom: footerClearance },
        ]}
      >
        <View style={styles.primaryActions}>
          {/* 3. Donate Button - Hidden on iOS (Apple IAP policy 3.1.1) */}
          {Platform.OS !== "ios" && (
            <Pressable
              style={({ pressed }) => [
                styles.donateButton,
                isCompact && styles.donateButtonCompact,
                pressed && styles.donateButtonPressed,
              ]}
              onPress={handleDonate}
            >
              <View style={styles.menuButtonIcon}>
                <HeartIcon />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.donateText, isCompact && styles.donateTextCompact]}>
                  Podpořte Astra Radio
                </Text>
                {!isCompact && (
                  <Text style={styles.donateSubtext}>
                    Pomozte nám růst – každý příspěvek se počítá ❤️
                  </Text>
                )}
              </View>
              <ArrowIcon />
            </Pressable>
          )}

          {/* 4. Main actions without scrolling */}
          <View style={styles.menuGrid}>
            <MenuTile
              icon={<ShopIcon />}
              label="Obchod"
              onPress={() => {
                onClose();
                onNavigateToShop();
              }}
              compact={isCompact}
            />
            <MenuTile
              icon={<EmailIcon />}
              label="Kontakt"
              onPress={handleContact}
              compact={isCompact}
            />
            <MenuTile
              icon={<DocumentIcon />}
              label="Zásady ochrany údajů"
              onPress={handlePrivacyPolicy}
              compact={isCompact}
            />
            <MenuTile
              icon={<DocumentIcon />}
              label="Podmínky použití"
              onPress={handleTermsOfService}
              compact={isCompact}
            />
          </View>
        </View>

        {/* Logout & Delete Account - Only for logged-in users */}
        {!isGuest && (
          <View style={styles.accountActionsRow}>
            <SecondaryActionButton
              icon={<TrashIcon />}
              label="Smazat účet"
              onPress={handleDeleteAccount}
              compact={isCompact}
            />
            <SecondaryActionButton
              icon={<LogoutIcon />}
              label="Odhlásit se"
              onPress={handleLogout}
              compact={isCompact}
            />
          </View>
        )}
      </View>
    </View>
  );
}

// Helper Component for Main Tiles
function MenuTile({ icon, label, onPress, compact }: any) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuTile,
        compact && styles.menuTileCompact,
        pressed && styles.menuTilePressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.menuTileHeader}>
        <View style={styles.menuTileIcon}>{icon}</View>
        <View style={styles.menuTileArrow}>
          <ArrowIcon />
        </View>
      </View>
      <Text style={[styles.menuTileText, compact && styles.menuTileTextCompact]} numberOfLines={3}>
        {label}
      </Text>
    </Pressable>
  );
}

function SecondaryActionButton({ icon, label, onPress, compact }: any) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.secondaryActionButton,
        compact && styles.secondaryActionButtonCompact,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.secondaryActionIcon}>{icon}</View>
      <Text style={[styles.secondaryActionText, compact && styles.secondaryActionTextCompact]}>
        {label}
      </Text>
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
  accountFixedArea: {
    paddingHorizontal: 20,
  },
  actionsArea: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  actionsAreaWithFooter: {
    justifyContent: "space-between",
  },
  primaryActions: {
    flexShrink: 1,
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
  accountCardCompact: {
    marginTop: 14,
    marginBottom: 14,
    padding: 16,
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
  accountNickCompact: {
    fontSize: 20,
    marginBottom: 12,
  },
  accountStats: {
    flexDirection: "row",
    // gap: 24, // Removed for iOS compatibility
    marginBottom: 8,
  },
  accountStat: {
    marginRight: 24, // Replaces gap: 24 for iOS compatibility
  },
  accountStatCompact: {
    marginRight: 16,
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
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    backgroundColor: "rgba(0, 229, 255, 0.06)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(0, 229, 255, 0.12)",
  },
  badgeRowCompact: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeIcon: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  badgeIconCompact: {
    width: 24,
    height: 24,
    marginRight: 8,
  },
  badgeTitle: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "600",
  },
  badgeNext: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  badgeNextCompact: {
    fontSize: 10,
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
  accountCtaCompact: {
    marginTop: 12,
    paddingVertical: 8,
  },
  accountCtaText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "600",
  },
  menuGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 2,
  },
  menuTile: {
    width: "48.5%",
    backgroundColor: colors.surfaceGlass,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 10,
    minHeight: 92,
    justifyContent: "space-between",
  },
  menuTileCompact: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
    minHeight: 84,
  },
  menuTilePressed: {
    backgroundColor: "rgba(0, 229, 255, 0.1)",
    transform: [{ scale: 0.99 }],
  },
  menuTileHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  menuTileIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuTileArrow: {
    marginLeft: 8,
  },
  menuTileText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 18,
    marginTop: 8,
  },
  menuTileTextCompact: {
    fontSize: 13,
    lineHeight: 16,
    marginTop: 6,
  },
  menuButtonIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  accountActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    paddingBottom: 2,
  },
  secondaryActionButton: {
    width: "48.5%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: "rgba(255, 107, 107, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 107, 107, 0.3)",
  },
  secondaryActionButtonCompact: {
    paddingVertical: 10,
  },
  secondaryActionIcon: {
    marginRight: 8,
  },
  secondaryActionText: {
    color: "#ff6b6b",
    fontSize: 14,
    fontWeight: "600",
  },
  secondaryActionTextCompact: {
    fontSize: 13,
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
    marginBottom: 8,
  },
  donateButtonCompact: {
    paddingVertical: 12,
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
  donateTextCompact: {
    fontSize: 14,
  },
  donateSubtext: {
    color: "rgba(255, 107, 157, 0.7)",
    fontSize: 12,
    marginTop: 2,
  },
});
