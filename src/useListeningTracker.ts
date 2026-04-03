// Custom hook to track listening time and award points
import { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { UserData } from "./types";
import {
  addPoints,
  getUserData,
  addDailyListeningMinutes,
  checkAndAwardDailyBonus,
} from "./storage";
import {
  POINTS_PER_MINUTE,
  BADGE_TIERS,
  getActiveBadgeTier,
  getPointMultiplier,
} from "./config";
import { updateAdTimer, shouldShowAd, showInterstitial } from "./adService";
import { maybeRequestReview } from "./reviewPrompt";

/**
 * Hook that tracks listening time and awards points
 * @param isPlaying - Whether audio is currently playing
 * @param userData - Current user data
 * @param onUserDataChange - Callback to update user data in parent
 * @returns Object containing sessionPoints
 */
export default function useListeningTracker(
  isPlaying: boolean,
  userData: UserData | null,
  onUserDataChange: (userData: UserData) => void,
) {
  const [sessionPoints, setSessionPoints] = useState(0);
  const [totalMinutesListened, setTotalMinutesListened] = useState(0);
  const [dailyBonusAwarded, setDailyBonusAwarded] = useState(false);
  const lastUpdateRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onUserDataChangeRef = useRef(onUserDataChange);

  // Keep ref updated
  useEffect(() => {
    onUserDataChangeRef.current = onUserDataChange;
  }, [onUserDataChange]);

  useEffect(() => {
    if (!userData) {
      // No user logged in, don't track
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      lastUpdateRef.current = null;
      setSessionPoints(0);
      return;
    }

    if (isPlaying) {
      // Start tracking
      console.log("[useListeningTracker] Starting listening tracker");
      lastUpdateRef.current = Date.now();

      // Award points every minute
      intervalRef.current = setInterval(async () => {
        const now = Date.now();
        const elapsed = now - (lastUpdateRef.current || now);
        const minutesElapsed = elapsed / (60 * 1000);

        if (minutesElapsed >= 1) {
          // Apply badge multiplier to base rate, rounded to nearest integer
          const currentUser = await getUserData();
          const totalMinutes = currentUser?.totalListeningMinutes ?? (userData?.totalListeningMinutes ?? 0);
          const multiplier = getPointMultiplier(totalMinutes);
          const pointsToAward = Math.round(POINTS_PER_MINUTE * multiplier);

          console.log(
            `[useListeningTracker] Awarding ${pointsToAward} points (${POINTS_PER_MINUTE} × ${multiplier}x multiplier)`,
          );

          try {
            // Add points to storage
            const updatedUser = await addPoints(pointsToAward);

            if (updatedUser) {
              // Also track daily listening minutes for daily bonus
              await addDailyListeningMinutes(1);

              // ── Badge unlock check ──────────────────────────────────────
              const prevEarned = updatedUser.earnedBadgeIds ?? [];
              const activeTier = getActiveBadgeTier(updatedUser.totalListeningMinutes);
              if (activeTier && !prevEarned.includes(activeTier.id)) {
                // New badge unlocked — persist it and update multiplier
                const newEarned = [...prevEarned, activeTier.id];
                // Collect ALL tiers now unlocked (in case of first-run catch-up)
                const allUnlocked = BADGE_TIERS
                  .filter(t => (updatedUser.totalListeningMinutes / 60) >= t.hoursRequired)
                  .map(t => t.id);
                updatedUser.earnedBadgeIds = allUnlocked;
                updatedUser.currentMultiplier = activeTier.multiplier;
                await import('./storage').then(({ saveUserData }) => saveUserData(updatedUser));
                console.log(`[useListeningTracker] Badge unlocked: ${activeTier.title} (${activeTier.multiplier}x)`);
                Alert.alert(
                  `${activeTier.icon} Nový odznak!`,
                  `Odemkl jsi odznak „${activeTier.title}"!\nTvůj multiplikátor bodů je nyní ${activeTier.multiplier}×.`,
                  [{ text: 'Super! 🎉' }],
                );
              }
              // ────────────────────────────────────────────────────────────

              // Check if daily bonus should be awarded (60+ minutes today)
              if (!dailyBonusAwarded) {
                const bonusResult = await checkAndAwardDailyBonus();
                if (bonusResult?.awarded) {
                  console.log(
                    "[useListeningTracker] Daily bonus awarded! +50 points",
                  );
                  setDailyBonusAwarded(true);

                  Alert.alert(
                    "🎉 Denní bonus!",
                    "Gratulujeme! Poslechl jsi dnes hodinu a získáváš 50 bonusových bodů!",
                    [{ text: "Super!" }],
                  );

                  const latestUser = await getUserData();
                  if (latestUser) {
                    onUserDataChangeRef.current(latestUser);
                  }
                } else {
                  onUserDataChangeRef.current(updatedUser);
                }
              } else {
                onUserDataChangeRef.current(updatedUser);
              }

              // Update session points with multiplied value
              setSessionPoints((prev) => prev + pointsToAward);

              // Check if we should show review prompt (every 10 min check)
              const userMinutes = updatedUser.totalListeningMinutes || 0;
              if (userMinutes > 0 && userMinutes % 10 === 0) {
                maybeRequestReview(userMinutes);
              }

              // Track total minutes for ad display
              setTotalMinutesListened((prev) => {
                const newTotalMinutes = prev + 1;

                updateAdTimer(newTotalMinutes);

                shouldShowAd().then((shouldShow) => {
                  if (shouldShow) {
                    console.log(
                      "[useListeningTracker] Showing interstitial ad",
                    );
                    showInterstitial().catch((err) => {
                      console.warn(
                        "[useListeningTracker] Failed to show ad:",
                        err,
                      );
                    });
                  }
                });

                return newTotalMinutes;
              });
            }
          } catch (err) {
            console.error("[useListeningTracker] Error adding points:", err);
          }

          lastUpdateRef.current = now;
        }
      }, 10000); // Check every 10 seconds
    } else {
      // Stop tracking
      console.log("[useListeningTracker] Stopping listening tracker");
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      lastUpdateRef.current = null;
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, userData]);

  // Reset session points and minutes when user changes
  useEffect(() => {
    setSessionPoints(0);
    setTotalMinutesListened(0);
    setDailyBonusAwarded(false);
  }, [userData?.nick]);

  return { sessionPoints };
}
