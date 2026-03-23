// User and Points System Types

export interface UserData {
  nick: string;
  points: number;
  totalListeningMinutes: number;
  weeklyListeningMinutes: number;
  weekStartDate: string; // ISO date string
  createdAt: string;
  lastSyncAt?: string;
  hasAccount: boolean; // true = synced with server, false = local only
  // Daily bonus tracking
  lastDailyBonusDate?: string; // YYYY-MM-DD format - last day bonus was awarded
  dailyListeningMinutes?: number; // Today's listening minutes
  dailyListeningDate?: string; // YYYY-MM-DD format - date for dailyListeningMinutes
}

export interface RewardItem {
  id: string;
  type: 'ad_free' | 'merch' | 'badge';
  title: string;
  description: string;
  cost: number;
  duration?: number; // hours for ad_free items
  requiresWeeklyHours?: number; // e.g., 21 hours/week
  imageUrl?: string;
  isUnlocked?: boolean;
}

export interface ActiveReward {
  rewardId: string;
  activatedAt: string; // ISO date
  expiresAt?: string; // ISO date for time-limited rewards
}

export interface ShopState {
  rewards: RewardItem[];
  activeRewards: ActiveReward[];
  purchaseHistory: PurchaseRecord[];
}

export interface PurchaseRecord {
  rewardId: string;
  purchasedAt: string;
  pointsSpent: number;
}

export interface ListeningSession {
  startedAt: string;
  endedAt?: string;
  minutesEarned: number;
}

// API Response types
export interface NickCheckResponse {
  available: boolean;
  message?: string;
}

export interface RegisterResponse {
  success: boolean;
  message?: string;
  userData?: UserData;
}

export interface SyncResponse {
  success: boolean;
  userData?: UserData;
  message?: string;
}
