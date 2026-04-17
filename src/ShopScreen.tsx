// Shop Screen Component

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Image,
} from "react-native";
import { UserData, RewardItem, ActiveReward } from "./types";
import { SHOP_REWARDS, WEEKLY_MINUTES_REQUIREMENT } from "./config";
import {
  getActiveRewards,
  activateReward,
  spendPoints,
  addPurchaseRecord,
  getUserData,
} from "./storage";
import { submitMerchOrder } from "./api";
import { addPoints } from "./storage";
import { showRewardedAd } from "./adService";

interface ShopScreenProps {
  userData: UserData;
  onUserDataChange: (userData: UserData) => void;
  active: boolean;
  onClose?: () => void;
}

const colors = {
  background: "#0B1014",
  surface: "#0f1a20",
  surfaceStrong: "#12232c",
  accent: "#00E5FF",
  accentStrong: "#45a29e",
  textPrimary: "#ffffff",
  textMuted: "#cfeff0",
  line: "rgba(0, 229, 255, 0.18)",
  error: "#f39c9c",
  success: "#00E5FF",
  gold: "#ffd700",
};

const fonts = {
  heading: "Orbitron",
  body: "Poppins-Regular",
  bodyMedium: "Poppins-Medium",
  bodySemi: "Poppins-SemiBold",
};

export default function ShopScreen({
  userData,
  onUserDataChange,
  active,
  onClose,
}: ShopScreenProps) {
  const [activeRewards, setActiveRewards] = useState<ActiveReward[]>([]);
  const [loading, setLoading] = useState(false);
  const [merchModalVisible, setMerchModalVisible] = useState(false);
  const [selectedMerch, setSelectedMerch] = useState<RewardItem | null>(null);
  const [merchForm, setMerchForm] = useState({
    email: "",
    name: "",
    address: "",
    phone: "",
  });

  useEffect(() => {
    if (active) {
      loadActiveRewards();
    }
  }, [active]);

  const loadActiveRewards = async () => {
    const rewards = await getActiveRewards();
    setActiveRewards(rewards);
  };

  const handleWatchRewardedAd = async () => {
    if (loading) return;

    // Import check function dynamically
    const { checkHourlyAdLimit, recordRewardedAdView } =
      await import("./adService");
    const limitCheck = checkHourlyAdLimit();

    if (!limitCheck.canShow) {
      const minutesRemaining = Math.ceil(
        limitCheck.remainingTimeMs / (60 * 1000),
      );
      Alert.alert(
        "Limit vyčerpán ⏳",
        `Můžeš shlédnout maximálně 10 reklam za hodinu. Další reklama bude dostupná za ${minutesRemaining} min.`,
      );
      return;
    }

    setLoading(true);
    try {
      const result = await showRewardedAd();

      if (result.completed && result.reward) {
        // Record successful view
        recordRewardedAdView();

        // Award bonus points
        const updatedUser = await addPoints(result.reward);
        if (updatedUser) {
          onUserDataChange(updatedUser);
        }
        Alert.alert(
          "Bonus body! 🎉",
          `Získal jsi ${result.reward} bonusových bodů za zhlédnutí reklamy!`,
        );
      } else {
        // Handle specific error cases
        if (result.error === "not_ready") {
          Alert.alert(
            "Reklama se načítá",
            "Prosím zkus to znovu za chvilku, připravujeme pro tebe reklamu.",
          );
        } else if (result.error === "early_close") {
          Alert.alert(
            "Reklama nedokončena",
            "Musíš shlédnout celou reklamu pro získání bodů.",
          );
        } else if (result.error === "display_failed") {
          Alert.alert(
            "Chyba zobrazení",
            "Reklamu se nepodařilo zobrazit. Zkus to prosím znovu.",
          );
        } else {
          Alert.alert("Reklama není dostupná", "Zkus to prosím později.");
        }
      }
    } catch (error) {
      console.error("[ShopScreen] Rewarded ad error:", error);
      Alert.alert(
        "Chyba",
        "Reklama není dostupná. Zkontroluj připojení k internetu.",
      );
    } finally {
      setLoading(false);
    }
  };

  const formatPoints = (points: number): string => {
    if (points >= 1000000) {
      return (points / 1000000).toFixed(1) + "M";
    }
    if (points >= 1000) {
      return (points / 1000).toFixed(1) + "K";
    }
    return points.toString();
  };

  const getTimeRemaining = (expiresAt: string): string => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();

    if (diff <= 0) return "Vypršelo";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  const canPurchase = (
    reward: RewardItem,
  ): { can: boolean; reason?: string } => {
    if (userData.points < reward.cost) {
      return { can: false, reason: "Nedostatek bodů" };
    }

    if (reward.requiresWeeklyHours) {
      const requiredMinutes = reward.requiresWeeklyHours * 60;
      if (userData.weeklyListeningMinutes < requiredMinutes) {
        const hoursNeeded = Math.ceil(
          (requiredMinutes - userData.weeklyListeningMinutes) / 60,
        );
        return {
          can: false,
          reason: `Potřebuješ ještě ${hoursNeeded}h poslechu tento týden`,
        };
      }
    }

    // Check if already active (for ad_free rewards)
    if (reward.type === "ad_free") {
      const isActive = activeRewards.some((r) => r.rewardId === reward.id);
      if (isActive) {
        return { can: false, reason: "Již aktivní" };
      }
    }

    return { can: true };
  };

  const handlePurchase = useCallback(
    async (reward: RewardItem) => {
      const { can, reason } = canPurchase(reward);
      if (!can) {
        Alert.alert("Nelze zakoupit", reason || "Tuto odměnu nelze zakoupit");
        return;
      }

      if (reward.type === "merch") {
        setSelectedMerch(reward);
        setMerchModalVisible(true);
        return;
      }

      Alert.alert(
        "Potvrdit nákup",
        `Opravdu chceš zakoupit "${reward.title}" za ${formatPoints(reward.cost)} bodů?`,
        [
          { text: "Zrušit", style: "cancel" },
          {
            text: "Zakoupit",
            onPress: async () => {
              setLoading(true);
              try {
                const success = await spendPoints(reward.cost);
                if (!success) {
                  Alert.alert("Chyba", "Nedostatek bodů");
                  return;
                }

                if (reward.type === "ad_free") {
                  await activateReward(reward.id, reward.duration);
                }

                await addPurchaseRecord(reward.id, reward.cost);

                const updatedUser = await getUserData();
                if (updatedUser) {
                  onUserDataChange(updatedUser);
                }

                await loadActiveRewards();

                Alert.alert("Úspěch! 🎉", `Zakoupeno: ${reward.title}`);
              } catch (error) {
                Alert.alert("Chyba", "Něco se pokazilo");
              } finally {
                setLoading(false);
              }
            },
          },
        ],
      );
    },
    [userData, activeRewards, onUserDataChange],
  );

  const handleMerchSubmit = useCallback(async () => {
    if (!selectedMerch) return;

    if (!merchForm.email || !merchForm.name || !merchForm.address) {
      Alert.alert("Chyba", "Vyplň prosím všechna povinná pole");
      return;
    }

    setLoading(true);
    try {
      const success = await spendPoints(selectedMerch.cost);
      if (!success) {
        Alert.alert("Chyba", "Nedostatek bodů");
        return;
      }

      const result = await submitMerchOrder(
        userData.nick,
        selectedMerch.id,
        merchForm,
      );

      if (!result.success) {
        // Refund points on failure
        const user = await getUserData();
        if (user) {
          user.points += selectedMerch.cost;
          onUserDataChange(user);
        }
        Alert.alert("Chyba", result.message || "Objednávka selhala");
        return;
      }

      await addPurchaseRecord(selectedMerch.id, selectedMerch.cost);

      const updatedUser = await getUserData();
      if (updatedUser) {
        onUserDataChange(updatedUser);
      }

      setMerchModalVisible(false);
      setSelectedMerch(null);
      setMerchForm({ email: "", name: "", address: "", phone: "" });

      Alert.alert(
        "Objednávka přijata! 🎉",
        "Ozveme se ti emailem s podrobnostmi o doručení.",
      );
    } catch (error) {
      Alert.alert("Chyba", "Něco se pokazilo");
    } finally {
      setLoading(false);
    }
  }, [selectedMerch, merchForm, userData, onUserDataChange]);

  const weeklyProgress = Math.min(
    (userData.weeklyListeningMinutes / WEEKLY_MINUTES_REQUIREMENT) * 100,
    100,
  );

  const adFreeRewards = SHOP_REWARDS.filter((r) => r.type === "ad_free");

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Obchůdek</Text>
        {onClose && (
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* Points Display */}
      <View style={styles.pointsCard}>
        <Text style={styles.pointsLabel}>Tvoje body</Text>
        <Text style={styles.pointsValue}>{formatPoints(userData.points)}</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {Math.floor(userData.totalListeningMinutes / 60)}h
            </Text>
            <Text style={styles.statLabel}>Celkem</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {Math.floor(userData.weeklyListeningMinutes / 60)}h
            </Text>
            <Text style={styles.statLabel}>Tento týden</Text>
          </View>
        </View>
        <View style={styles.weeklyProgress}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Týdenní cíl (21h)</Text>
            <Text style={styles.progressPercent}>
              {Math.round(weeklyProgress)}%
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${weeklyProgress}%` }]}
            />
          </View>
        </View>

        {/* Rewarded Ad Button - Watch ad for 50 bonus points */}
        {true && (
          <Pressable
            style={({ pressed }) => [
              styles.rewardedAdButton,
              pressed && styles.rewardedAdButtonPressed,
              loading && styles.rewardedAdButtonDisabled,
            ]}
            onPress={handleWatchRewardedAd}
            disabled={loading}
          >
            <Image
              source={require("../assets/ads-view.png")}
              style={styles.rewardedAdImage}
              resizeMode="contain"
            />
            <View style={styles.rewardedAdTextContainer}>
              <Text style={styles.rewardedAdTitle}>Sleduj reklamu</Text>
              <Text style={styles.rewardedAdSubtitle}>
                Získej 50 bonusových bodů
              </Text>
            </View>
            {loading && (
              <ActivityIndicator size="small" color={colors.accent} />
            )}
          </Pressable>
        )}
      </View>

      {/* Active Rewards */}
      {activeRewards.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Aktivní odměny</Text>
          {activeRewards.map((active) => {
            const reward = SHOP_REWARDS.find((r) => r.id === active.rewardId);
            if (!reward) return null;
            return (
              <View key={active.rewardId} style={styles.activeCard}>
                <View style={styles.activeInfo}>
                  <Text style={styles.activeTitle}>{reward.title}</Text>
                  {active.expiresAt && (
                    <Text style={styles.activeExpires}>
                      Vyprší za: {getTimeRemaining(active.expiresAt)}
                    </Text>
                  )}
                </View>
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>Aktivní</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Ad-Free Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Image
            source={require("../assets/ads.png")}
            style={styles.sectionIcon}
            resizeMode="contain"
          />
          <Text style={styles.sectionTitle}>Bez reklam</Text>
        </View>
        {adFreeRewards.map((reward) => {
          const { can, reason } = canPurchase(reward);
          return (
            <Pressable
              key={reward.id}
              style={({ pressed }) => [
                styles.rewardCard,
                !can && styles.rewardCardDisabled,
                pressed && can && styles.rewardCardPressed,
              ]}
              onPress={() => handlePurchase(reward)}
              disabled={!can || loading}
            >
              <View style={styles.rewardInfo}>
                <Text style={styles.rewardTitle}>{reward.title}</Text>
                <Text style={styles.rewardDesc}>{reward.description}</Text>
                {!can && reason && (
                  <Text style={styles.rewardReason}>{reason}</Text>
                )}
              </View>
              <View style={styles.rewardPrice}>
                <Text style={[styles.priceValue, !can && styles.priceDisabled]}>
                  {formatPoints(reward.cost)}
                </Text>
                <Text style={styles.priceLabel}>bodů</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Merch Section - Coming Soon */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Image
            source={require("../assets/shirt.png")}
            style={styles.sectionIcon}
            resizeMode="contain"
          />
          <Text style={styles.sectionTitle}>Merch</Text>
        </View>
        <View style={[styles.rewardCard, styles.comingSoonCard]}>
          <View style={styles.comingSoonContent}>
            <Text style={styles.comingSoonIcon}>🚀</Text>
            <Text style={styles.comingSoonTitle}>COMING SOON</Text>
            <Text style={styles.comingSoonText}>
              Brzy zde najdeš exkluzivní Astra Radio merch!
            </Text>
          </View>
        </View>
      </View>

      {/* Merch Order Modal */}
      <Modal
        visible={merchModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setMerchModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Objednat: {selectedMerch?.title}
            </Text>
            <Text style={styles.modalPrice}>
              Cena: {selectedMerch ? formatPoints(selectedMerch.cost) : 0} bodů
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Email *"
              placeholderTextColor="rgba(207, 239, 240, 0.4)"
              value={merchForm.email}
              onChangeText={(v) => setMerchForm({ ...merchForm, email: v })}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Jméno a příjmení *"
              placeholderTextColor="rgba(207, 239, 240, 0.4)"
              value={merchForm.name}
              onChangeText={(v) => setMerchForm({ ...merchForm, name: v })}
            />
            <TextInput
              style={[styles.modalInput, styles.modalInputMultiline]}
              placeholder="Doručovací adresa *"
              placeholderTextColor="rgba(207, 239, 240, 0.4)"
              value={merchForm.address}
              onChangeText={(v) => setMerchForm({ ...merchForm, address: v })}
              multiline
              numberOfLines={3}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Telefon (volitelné)"
              placeholderTextColor="rgba(207, 239, 240, 0.4)"
              value={merchForm.phone}
              onChangeText={(v) => setMerchForm({ ...merchForm, phone: v })}
              keyboardType="phone-pad"
            />

            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => {
                  setMerchModalVisible(false);
                  setSelectedMerch(null);
                }}
              >
                <Text style={styles.modalCancelText}>Zrušit</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalSubmitBtn,
                  loading && styles.buttonDisabled,
                ]}
                onPress={handleMerchSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#0B1014" />
                ) : (
                  <Text style={styles.modalSubmitText}>Objednat</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  screenTitle: {
    color: colors.accent,
    fontSize: 20,
    fontFamily: fonts.heading,
    letterSpacing: 0.8,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    fontSize: 20,
    color: colors.textMuted,
    fontWeight: "300",
  },
  pointsCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 20,
  },
  pointsLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  pointsValue: {
    color: colors.accent,
    fontSize: 42,
    fontFamily: fonts.heading,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: "row",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.line,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 18,
    fontFamily: fonts.bodySemi,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: fonts.body,
    marginTop: 2,
  },
  weeklyProgress: {
    marginTop: 16,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: fonts.body,
  },
  progressPercent: {
    color: colors.accent,
    fontSize: 12,
    fontFamily: fonts.bodySemi,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.surfaceStrong,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.accent,
    borderRadius: 4,
  },
  rewardedAdButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceStrong,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  rewardedAdButtonPressed: {
    backgroundColor: colors.surface,
    transform: [{ scale: 0.98 }],
  },
  rewardedAdButtonDisabled: {
    opacity: 0.5,
  },
  rewardedAdIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  rewardedAdImage: {
    width: 32,
    height: 32,
    marginRight: 12,
    tintColor: colors.accent,
  },
  rewardedAdTextContainer: {
    flex: 1,
  },
  rewardedAdTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  rewardedAdSubtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.accent,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionIcon: {
    width: 20,
    height: 20,
    marginRight: 8,
    tintColor: colors.accent,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontFamily: fonts.bodySemi,
  },
  activeCard: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  activeInfo: {
    flex: 1,
  },
  activeTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontFamily: fonts.bodySemi,
  },
  activeExpires: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: fonts.body,
    marginTop: 2,
  },
  activeBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeBadgeText: {
    color: colors.background,
    fontSize: 11,
    fontFamily: fonts.bodySemi,
  },
  rewardCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.line,
  },
  merchCard: {
    borderColor: colors.gold + "40",
  },
  rewardCardDisabled: {
    opacity: 0.5,
  },
  rewardCardPressed: {
    transform: [{ scale: 0.98 }],
  },
  rewardInfo: {
    flex: 1,
    marginRight: 12,
  },
  rewardTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontFamily: fonts.bodySemi,
  },
  rewardDesc: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: fonts.body,
    marginTop: 4,
    lineHeight: 16,
  },
  rewardReason: {
    color: colors.error,
    fontSize: 11,
    fontFamily: fonts.body,
    marginTop: 6,
  },
  rewardPrice: {
    alignItems: "flex-end",
  },
  priceValue: {
    color: colors.accent,
    fontSize: 18,
    fontFamily: fonts.bodySemi,
  },
  merchPrice: {
    color: colors.gold,
  },
  priceDisabled: {
    color: colors.textMuted,
  },
  priceLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: fonts.body,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: colors.line,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontFamily: fonts.bodySemi,
    marginBottom: 4,
  },
  modalPrice: {
    color: colors.accent,
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    marginBottom: 12,
  },
  modalInputMultiline: {
    height: 80,
    textAlignVertical: "top",
  },
  modalButtons: {
    flexDirection: "row",
    marginTop: 8,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    marginRight: 6,
  },
  modalCancelText: {
    color: colors.textMuted,
    fontSize: 14,
    fontFamily: fonts.bodySemi,
  },
  modalSubmitBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginLeft: 6,
  },
  modalSubmitText: {
    color: colors.background,
    fontSize: 14,
    fontFamily: fonts.bodySemi,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 15, 20, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  comingSoonCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  comingSoonContent: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 24,
  },
  comingSoonIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  comingSoonTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 18,
    color: colors.accent,
    marginBottom: 8,
    letterSpacing: 2,
  },
  comingSoonText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
  },
});
