// Points Display Component - Shows in header

import React from "react";
import { View, Text, StyleSheet, Pressable, Image } from "react-native";
import { UserData } from "./types";

interface PointsDisplayProps {
  userData: UserData | null;
  sessionPoints?: number;
  onPress?: () => void;
}

const colors = {
  accent: "#00E5FF",
  textPrimary: "#ffffff",
  textMuted: "#cfeff0",
  surface: "#0f1a20",
  line: "rgba(0, 229, 255, 0.18)",
};

const fonts = {
  heading: "Inter-SemiBold", // Was Orbitron
  body: "Inter-Regular", // Was Poppins-Regular
  bodyMedium: "Inter-Regular", // Was Poppins-Medium
  bodySemi: "Inter-SemiBold", // Was Poppins-SemiBold
};

export default function PointsDisplay({
  userData,
  sessionPoints = 0,
  onPress,
}: PointsDisplayProps) {
  // DEBUG LOG
  React.useEffect(() => {
    console.log(
      "[PointsDisplay] Mounted. UserData:",
      userData ? "Present" : "Missing",
      "Points:",
      userData?.points,
    );
  }, [userData]);

  if (!userData) {
    console.log("[PointsDisplay] userData is missing, showing loading state");
    // Show a minimal pill instead of nothing — helps debug iOS rendering
    return (
      <View style={styles.container}>
        <View style={styles.pointsRow}>
          <Text style={styles.pointsValue}>...</Text>
        </View>
      </View>
    );
  }

  const formatPoints = (points: number = 0): string => {
    if (typeof points !== "number") return "0";
    if (points >= 1000000) {
      return (points / 1000000).toFixed(1) + "M";
    }
    if (points >= 1000) {
      return (points / 1000).toFixed(1) + "K";
    }
    return points.toString();
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={styles.pointsRow}>
        <Image
          source={require("../assets/star-point.png")}
          style={{
            width: 12,
            height: 12,
            marginRight: 6,
            tintColor: "#FFFFFF",
          }}
          resizeMode="contain"
        />
        <Text style={styles.pointsValue}>
          {formatPoints(userData?.points ?? 0)}
        </Text>
      </View>
      {sessionPoints > 0 && (
        <Text style={styles.sessionPoints}>+{sessionPoints}</Text>
      )}
    </Pressable>
  );
}

// Floating points popup animation component
export function PointsPopup({
  points,
  visible,
}: {
  points: number;
  visible: boolean;
}) {
  if (!visible || points === 0) return null;

  return (
    <View style={styles.popup}>
      <Text style={styles.popupText}>+{points}</Text>
      <Image
        source={require("../assets/star-point.png")}
        style={{ width: 16, height: 16, marginLeft: 4, tintColor: "#0B1014" }}
        resizeMode="contain"
      />
    </View>
  );
}

// Mini stats bar for player screen
export function PlayerStats({ userData }: { userData: UserData | null }) {
  if (!userData) return null;

  const weeklyHours = Math.floor(userData.weeklyListeningMinutes / 60);
  const weeklyMins = userData.weeklyListeningMinutes % 60;

  return (
    <View style={styles.statsBar}>
      <View style={styles.statItem}>
        <Image
          source={require("../assets/star-point.png")}
          style={{
            width: 12,
            height: 12,
            marginRight: 6,
            tintColor: colors.accent,
          }}
          resizeMode="contain"
        />
        <Text style={styles.statValue}>{userData.points}</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statIcon}>📻</Text>
        <Text style={styles.statValue}>
          {weeklyHours > 0
            ? `${weeklyHours}h ${weeklyMins}m`
            : `${weeklyMins}m`}
        </Text>
        <Text style={styles.statLabel}>tento týden</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 63, 98, 0.8)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    // borderWidth: 1, // Removed outline
    // borderColor: colors.line,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  pointsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  coinIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  pointsValue: {
    color: "#E6F1F5",
    fontSize: 12,
    fontFamily: "Inter-Regular",
    fontWeight: "400",
  },
  sessionPoints: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: fonts.body,
    marginLeft: 6,
    opacity: 0.8,
  },
  popup: {
    position: "absolute",
    top: -30,
    right: 0,
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popupText: {
    color: "#0B1014",
    fontSize: 12,
    fontFamily: fonts.bodySemi,
  },
  statsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: 8,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  statDivider: {
    width: 1,
    height: 16,
    backgroundColor: colors.line,
    marginHorizontal: 8,
  },
  statIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 13,
    fontFamily: fonts.bodySemi,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: fonts.body,
    marginLeft: 4,
  },
});
