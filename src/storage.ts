import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  UserData,
  ActiveReward,
  PurchaseRecord,
  ListeningSession,
} from "./types";
import { SHOP_REWARDS } from "./config";
import { syncUserData, fetchUserData } from "./api";

// Storage keys
const STORAGE_KEYS = {
  USER_DATA: "@astraradio_user_data",
  ACTIVE_REWARDS: "@astraradio_active_rewards",
  PURCHASE_HISTORY: "@astraradio_purchase_history",
  LISTENING_SESSION: "@astraradio_listening_session",
  ONBOARDING_COMPLETE: "@astraradio_onboarding_complete",
};

// In-memory cache with persistence via API
let memoryCache: {
  userData: UserData | null;
  activeRewards: ActiveReward[];
  purchaseHistory: PurchaseRecord[];
  listeningSession: ListeningSession | null;
  onboardingComplete: boolean;
} = {
  userData: null,
  activeRewards: [],
  purchaseHistory: [],
  listeningSession: null,
  onboardingComplete: false,
};

// Flag to track if we've loaded from storage
let initialized = false;

// Load data from AsyncStorage on app start
async function loadFromStorage() {
  if (initialized) return;

  try {
    const [
      userData,
      activeRewards,
      purchaseHistory,
      listeningSession,
      onboardingComplete,
    ] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.USER_DATA),
      AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_REWARDS),
      AsyncStorage.getItem(STORAGE_KEYS.PURCHASE_HISTORY),
      AsyncStorage.getItem(STORAGE_KEYS.LISTENING_SESSION),
      AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETE),
    ]);

    if (userData) memoryCache.userData = JSON.parse(userData);
    if (activeRewards) memoryCache.activeRewards = JSON.parse(activeRewards);
    if (purchaseHistory)
      memoryCache.purchaseHistory = JSON.parse(purchaseHistory);
    if (listeningSession)
      memoryCache.listeningSession = JSON.parse(listeningSession);
    if (onboardingComplete)
      memoryCache.onboardingComplete = JSON.parse(onboardingComplete);

    console.log("[Storage] Loaded from AsyncStorage:", {
      hasUser: !!memoryCache.userData,
      nick: memoryCache.userData?.nick,
      points: memoryCache.userData?.points,
      totalMinutes: memoryCache.userData?.totalListeningMinutes,
      raw: userData, // Log raw string to see if it exists
    });

    initialized = true;
  } catch (error) {
    console.error("[Storage] Failed to load from AsyncStorage:", error);
  }
}

// Save to AsyncStorage
// Save to AsyncStorage
async function saveToStorage() {
  try {
    const pairs: [string, string][] = [
      [STORAGE_KEYS.USER_DATA, JSON.stringify(memoryCache.userData)],
      [STORAGE_KEYS.ACTIVE_REWARDS, JSON.stringify(memoryCache.activeRewards)],
      [
        STORAGE_KEYS.PURCHASE_HISTORY,
        JSON.stringify(memoryCache.purchaseHistory),
      ],
      [
        STORAGE_KEYS.LISTENING_SESSION,
        JSON.stringify(memoryCache.listeningSession),
      ],
      [
        STORAGE_KEYS.ONBOARDING_COMPLETE,
        JSON.stringify(memoryCache.onboardingComplete),
      ],
    ];

    await AsyncStorage.multiSet(pairs);
    console.log(
      "[Storage] Saved to AsyncStorage successfully via multiSet. User:",
      memoryCache.userData?.nick,
    );
  } catch (error) {
    console.error("[Storage] Failed to save to AsyncStorage:", error);
  }
}

// Default user data
const createDefaultUserData = (
  nick: string,
  hasAccount: boolean,
): UserData => ({
  nick,
  points: 0,
  totalListeningMinutes: 0,
  weeklyListeningMinutes: 0,
  weekStartDate: getWeekStartDate(),
  createdAt: new Date().toISOString(),
  hasAccount,
});

// Get Monday of current week
function getWeekStartDate(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

// Check if we need to reset weekly minutes
function shouldResetWeeklyMinutes(weekStartDate: string): boolean {
  const currentWeekStart = getWeekStartDate();
  return (
    currentWeekStart !== weekStartDate.split("T")[0] + "T00:00:00.000Z" &&
    new Date(currentWeekStart) > new Date(weekStartDate)
  );
}

// User Data Operations
export async function getUserData(): Promise<UserData | null> {
  await loadFromStorage();

  if (!memoryCache.userData) return null;

  // Check if we need to reset weekly minutes
  if (shouldResetWeeklyMinutes(memoryCache.userData.weekStartDate)) {
    memoryCache.userData.weeklyListeningMinutes = 0;
    memoryCache.userData.weekStartDate = getWeekStartDate();
    await saveToStorage();
  }

  return memoryCache.userData;
}

export async function saveUserData(userData: UserData): Promise<boolean> {
  memoryCache.userData = userData;
  await saveToStorage();

  // Sync to server if user has account
  if (userData.hasAccount) {
    try {
      await syncUserData(userData);
      console.log("[Storage] User data synced to server");
    } catch (error) {
      console.warn("[Storage] Failed to sync user data:", error);
      // Don't fail the save, just log the error
    }
  }

  return true;
}

// Sync with remote server (Max Value Merge)
export async function syncWithRemote(nick?: string): Promise<UserData | null> {
  await loadFromStorage();

  const user = memoryCache.userData;
  const targetNick = nick || user?.nick;

  if (!targetNick) return null;

  try {
    console.log("[Storage] Syncing with remote for:", targetNick);
    const serverResponse = await fetchUserData(targetNick);

    if (serverResponse.success && serverResponse.userData) {
      const serverUser = serverResponse.userData;
      const localUser = memoryCache.userData;

      // Initial state if no local user
      if (!localUser || localUser.nick !== targetNick) {
        console.log("[Storage] No local user, taking server data");
        await saveUserData(serverUser);
        return serverUser;
      }

      // Merge Logic: Take MAX values
      const mergedUser: UserData = {
        ...serverUser,
        points: Math.max(serverUser.points, localUser.points),
        totalListeningMinutes: Math.max(
          serverUser.totalListeningMinutes,
          localUser.totalListeningMinutes,
        ),
        // For weekly, if weeks match, take max. If server is newer, take server.
        weeklyListeningMinutes:
          serverUser.weekStartDate === localUser.weekStartDate
            ? Math.max(
                serverUser.weeklyListeningMinutes,
                localUser.weeklyListeningMinutes,
              )
            : serverUser.weeklyListeningMinutes, // Server likely has correct week reset
      };

      // If local had more progress, pushing back to server is important
      if (
        mergedUser.points > serverUser.points ||
        mergedUser.totalListeningMinutes > serverUser.totalListeningMinutes
      ) {
        console.log("[Storage] Local ahead of server, pushing merge...");
        await syncUserData(mergedUser);
      }

      // Update local storage
      await saveUserData(mergedUser);
      return mergedUser;
    }
  } catch (err) {
    console.warn("[Storage] Remote sync failed, using local data:", err);
  }

  return memoryCache.userData;
}

export async function createUser(
  nick: string,
  hasAccount: boolean,
): Promise<UserData> {
  const userData = createDefaultUserData(nick, hasAccount);
  memoryCache.userData = userData;
  memoryCache.onboardingComplete = true;
  await saveToStorage();
  return userData;
}

export async function addPoints(minutes: number): Promise<UserData | null> {
  if (!memoryCache.userData) return null;

  memoryCache.userData.points += minutes;
  memoryCache.userData.totalListeningMinutes += minutes;
  memoryCache.userData.weeklyListeningMinutes += minutes;

  await saveToStorage();

  // Sync to server if user has account
  if (memoryCache.userData.hasAccount) {
    try {
      await syncUserData(memoryCache.userData);
      console.log("[Storage] Points synced to server:", minutes);
    } catch (error) {
      console.warn("[Storage] Failed to sync points:", error);
    }
  }

  return memoryCache.userData;
}

// Add bonus points (e.g. from watching a rewarded ad) without affecting listening minutes
export async function addBonusPoints(amount: number): Promise<UserData | null> {
  if (!memoryCache.userData) return null;

  memoryCache.userData.points += amount;
  await saveToStorage();

  // Sync to server if user has account
  if (memoryCache.userData.hasAccount) {
    try {
      await syncUserData(memoryCache.userData);
      console.log("[Storage] Bonus points synced to server:", amount);
    } catch (error) {
      console.warn("[Storage] Failed to sync bonus points:", error);
    }
  }

  return memoryCache.userData;
}

export async function spendPoints(amount: number): Promise<boolean> {
  if (!memoryCache.userData || memoryCache.userData.points < amount)
    return false;

  memoryCache.userData.points -= amount;

  await saveToStorage();

  // Sync to server if user has account
  if (memoryCache.userData.hasAccount) {
    try {
      await syncUserData(memoryCache.userData);
      console.log("[Storage] Points spent synced to server:", amount);
    } catch (error) {
      console.warn("[Storage] Failed to sync points spending:", error);
    }
  }

  return true;
}

// Active Rewards Operations
export async function getActiveRewards(): Promise<ActiveReward[]> {
  await loadFromStorage();

  // Filter out expired rewards
  const now = new Date();
  memoryCache.activeRewards = memoryCache.activeRewards.filter((reward) => {
    if (!reward.expiresAt) return true;
    return new Date(reward.expiresAt) > now;
  });

  return memoryCache.activeRewards;
}

export async function saveActiveRewards(
  rewards: ActiveReward[],
): Promise<boolean> {
  memoryCache.activeRewards = rewards;
  await saveToStorage();
  return true;
}

export async function activateReward(
  rewardId: string,
  durationHours?: number,
): Promise<boolean> {
  const now = new Date();
  const newReward: ActiveReward = {
    rewardId,
    activatedAt: now.toISOString(),
  };

  if (durationHours) {
    const expiresAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000);
    newReward.expiresAt = expiresAt.toISOString();
  }

  // Remove existing reward of same type if exists
  memoryCache.activeRewards = memoryCache.activeRewards.filter(
    (r) => r.rewardId !== rewardId,
  );
  memoryCache.activeRewards.push(newReward);

  await saveToStorage();

  return true;
}

export async function isAdFreeActive(): Promise<boolean> {
  const activeRewards = await getActiveRewards();
  return activeRewards.some((r) => {
    const reward = SHOP_REWARDS.find((sr) => sr.id === r.rewardId);
    return reward?.type === "ad_free";
  });
}

// Purchase History Operations
export async function getPurchaseHistory(): Promise<PurchaseRecord[]> {
  await loadFromStorage();
  return memoryCache.purchaseHistory;
}

export async function addPurchaseRecord(
  rewardId: string,
  pointsSpent: number,
): Promise<boolean> {
  memoryCache.purchaseHistory.push({
    rewardId,
    purchasedAt: new Date().toISOString(),
    pointsSpent,
  });
  await saveToStorage();
  return true;
}

// Listening Session Operations
export async function startListeningSession(): Promise<void> {
  memoryCache.listeningSession = {
    startedAt: new Date().toISOString(),
    minutesEarned: 0,
  };
  await saveToStorage();
}

export async function getListeningSession(): Promise<ListeningSession | null> {
  await loadFromStorage();
  return memoryCache.listeningSession;
}

export async function updateListeningSession(
  minutesEarned: number,
): Promise<void> {
  if (memoryCache.listeningSession) {
    memoryCache.listeningSession.minutesEarned = minutesEarned;
    await saveToStorage();
  }
}

export async function endListeningSession(): Promise<number> {
  const minutes = memoryCache.listeningSession?.minutesEarned ?? 0;
  memoryCache.listeningSession = null;
  await saveToStorage();
  return minutes;
}

// Onboarding
export async function isOnboardingComplete(): Promise<boolean> {
  await loadFromStorage();
  return memoryCache.onboardingComplete;
}

export async function setOnboardingComplete(): Promise<void> {
  memoryCache.onboardingComplete = true;
  await saveToStorage();
}

// Load user data from server (for accounts with sync)
export async function loadUserFromServer(
  nick: string,
): Promise<UserData | null> {
  // This will be called after successful login
  // The API response will contain the user data
  return memoryCache.userData;
}

// Set user data from server response
export async function setUserDataFromServer(userData: UserData): Promise<void> {
  memoryCache.userData = userData;
  memoryCache.onboardingComplete = true;
  initialized = true;
  await saveToStorage();
}

// Clear all data (for testing/logout)
export async function clearAllData(): Promise<void> {
  memoryCache = {
    userData: null,
    activeRewards: [],
    purchaseHistory: [],
    listeningSession: null,
    onboardingComplete: false,
  };
  initialized = false;

  // Clear AsyncStorage
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.USER_DATA,
      STORAGE_KEYS.ACTIVE_REWARDS,
      STORAGE_KEYS.PURCHASE_HISTORY,
      STORAGE_KEYS.LISTENING_SESSION,
      STORAGE_KEYS.ONBOARDING_COMPLETE,
    ]);
    console.log("[Storage] Cleared all data from AsyncStorage");
  } catch (error) {
    console.error("[Storage] Failed to clear AsyncStorage:", error);
  }
}

// Export memory cache for debugging
export function getMemoryCache() {
  return memoryCache;
}

// Daily Bonus Constants
const DAILY_BONUS_POINTS = 50;
const DAILY_BONUS_MINUTES_REQUIRED = 60; // 1 hour

// Get today's date as YYYY-MM-DD string
function getTodayDateString(): string {
  const now = new Date();
  return now.toISOString().split("T")[0];
}

// Add daily listening minutes (resets each day)
export async function addDailyListeningMinutes(
  minutes: number,
): Promise<UserData | null> {
  if (!memoryCache.userData) return null;

  const today = getTodayDateString();

  // Check if we need to reset daily minutes (new day)
  if (memoryCache.userData.dailyListeningDate !== today) {
    memoryCache.userData.dailyListeningMinutes = 0;
    memoryCache.userData.dailyListeningDate = today;
  }

  // Add minutes to today's count
  memoryCache.userData.dailyListeningMinutes =
    (memoryCache.userData.dailyListeningMinutes || 0) + minutes;

  await saveToStorage();

  return memoryCache.userData;
}

// Check and award daily bonus if eligible (60+ minutes and not yet awarded today)
export async function checkAndAwardDailyBonus(): Promise<{
  awarded: boolean;
  points: number;
} | null> {
  if (!memoryCache.userData) return null;

  const today = getTodayDateString();

  // Check if already awarded today
  if (memoryCache.userData.lastDailyBonusDate === today) {
    return { awarded: false, points: 0 };
  }

  // Check if daily minutes is on a different day (reset)
  if (memoryCache.userData.dailyListeningDate !== today) {
    return { awarded: false, points: 0 };
  }

  // Check if user has listened for 60+ minutes today
  const dailyMinutes = memoryCache.userData.dailyListeningMinutes || 0;
  if (dailyMinutes < DAILY_BONUS_MINUTES_REQUIRED) {
    return { awarded: false, points: 0 };
  }

  // Award the bonus!
  memoryCache.userData.points += DAILY_BONUS_POINTS;
  memoryCache.userData.lastDailyBonusDate = today;

  await saveToStorage();

  // Sync to server if user has account
  if (memoryCache.userData.hasAccount) {
    try {
      await syncUserData(memoryCache.userData);
      console.log(
        "[Storage] Daily bonus synced to server:",
        DAILY_BONUS_POINTS,
      );
    } catch (error) {
      console.warn("[Storage] Failed to sync daily bonus:", error);
    }
  }

  console.log("[Storage] Daily bonus awarded! +50 points");
  return { awarded: true, points: DAILY_BONUS_POINTS };
}

// Get current daily listening progress
export async function getDailyListeningProgress(): Promise<{
  minutes: number;
  bonusAwarded: boolean;
}> {
  await loadFromStorage();

  if (!memoryCache.userData) {
    return { minutes: 0, bonusAwarded: false };
  }

  const today = getTodayDateString();

  // Check if data is from today
  if (memoryCache.userData.dailyListeningDate !== today) {
    return { minutes: 0, bonusAwarded: false };
  }

  return {
    minutes: memoryCache.userData.dailyListeningMinutes || 0,
    bonusAwarded: memoryCache.userData.lastDailyBonusDate === today,
  };
}
