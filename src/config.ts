// Points and Rewards Configuration

import { RewardItem } from "./types";

// Points earned per minute of listening (base rate, before multiplier)
export const POINTS_PER_MINUTE = 1;

// ─── Badge / Multiplier System ────────────────────────────────────────────────
// Each tier unlocks when the user reaches the required total listening hours.
// The multiplier is PERMANENT and applies to every point earned after unlock.
// Hard-capped at 1.8x — add custom bonuses in BADGE_BONUS_PERKS for cap users.
export interface BadgeTier {
  id: string;
  hoursRequired: number;
  multiplier: number;
  title: string;
  icon: string;
}

export const BADGE_TIERS: BadgeTier[] = [
  { id: 'badge_10h',  hoursRequired: 10,  multiplier: 1.10, title: 'Nováček',           icon: 'rank_wave_1' },
  { id: 'badge_50h',  hoursRequired: 50,  multiplier: 1.25, title: 'Stálý posluchač',   icon: 'rank_wave_2' },
  { id: 'badge_100h', hoursRequired: 100, multiplier: 1.40, title: 'Hudební průzkumník', icon: 'rank_note' },
  { id: 'badge_150h', hoursRequired: 150, multiplier: 1.50, title: 'Astra Insider',      icon: 'rank_mic' },
  { id: 'badge_200h', hoursRequired: 200, multiplier: 1.60, title: 'Astra Ambasador',    icon: 'rank_headset' },
  { id: 'badge_300h', hoursRequired: 300, multiplier: 1.70, title: 'Astra Virtuóz',      icon: 'rank_equalizer' },
  { id: 'badge_400h', hoursRequired: 400, multiplier: 1.75, title: 'Astra Elite',        icon: 'rank_crown' },
  { id: 'badge_500h', hoursRequired: 500, multiplier: 1.80, title: 'Astra Ikona',        icon: 'rank_star' },
];

// Absolute ceiling — never exceeded regardless of future tiers.
export const MAX_MULTIPLIER = 1.80;

// Reserved for future high-tier perks once the user hits MAX_MULTIPLIER.
// Add objects here (e.g. { type: 'exclusive_badge', id: 'hall_of_fame' }) —
// no code changes needed to the multiplier logic.
export const BADGE_BONUS_PERKS: { id: string; description: string }[] = [];

/** Returns the highest unlocked BadgeTier for the given total minutes, or null. */
export function getActiveBadgeTier(totalListeningMinutes: number): BadgeTier | null {
  const totalHours = totalListeningMinutes / 60;
  let active: BadgeTier | null = null;
  for (const tier of BADGE_TIERS) {
    if (totalHours >= tier.hoursRequired) {
      active = tier;
    }
  }
  return active;
}

/** Returns the current point multiplier for a given total minutes (1.0 if no badge). */
export function getPointMultiplier(totalListeningMinutes: number): number {
  const tier = getActiveBadgeTier(totalListeningMinutes);
  return tier ? Math.min(tier.multiplier, MAX_MULTIPLIER) : 1.0;
}

// Weekly listening requirement (in minutes) for weekly rewards
export const WEEKLY_HOURS_REQUIREMENT = 21; // 3 hours/day * 7 days
export const WEEKLY_MINUTES_REQUIREMENT = WEEKLY_HOURS_REQUIREMENT * 60;

// ─── Economy Scaling ─────────────────────────────────────────────────────────
// Lower cost during early growth phase (small user base, low multipliers).
// Revert AD_FREE_24H_COST back to 500 once multipliers of 1.4-1.8x are common.
export const AD_FREE_24H_COST = 300; // was 500 — revert when economy inflates

// Shop rewards configuration
export const SHOP_REWARDS: RewardItem[] = [
  {
    id: "ad_free_24h",
    type: "ad_free",
    title: "Bez reklam 24h",
    description: "Užij si 24 hodin poslechu bez reklam",
    cost: AD_FREE_24H_COST,
    duration: 24,
  },
  {
    id: "ad_free_week",
    type: "ad_free",
    title: "Bez reklam týden",
    description: "Celý týden bez reklam! Vyžaduje 21h poslechu za týden.",
    cost: 2500,
    duration: 168, // 7 * 24 hours
    requiresWeeklyHours: 21,
  },
  {
    id: "ad_free_month",
    type: "ad_free",
    title: "Bez reklam měsíc",
    description: "30 dní bez reklam",
    cost: 8000,
    duration: 720, // 30 * 24 hours
  },
  {
    id: "merch_sticker",
    type: "merch",
    title: "Astra Samolepky",
    description: "Balíček samolepek Astra Radio",
    cost: 50000,
  },
  {
    id: "merch_tshirt",
    type: "merch",
    title: "Astra Tričko",
    description: "Originální tričko Astra Radio",
    cost: 250000,
  },
  {
    id: "merch_hoodie",
    type: "merch",
    title: "Astra Mikina",
    description: "Prémiová mikina Astra Radio",
    cost: 500000,
  },
  {
    id: "merch_ultimate",
    type: "merch",
    title: "Astra Ultimate Pack",
    description: "Kompletní merch balíček - tričko, mikina, samolepky a více!",
    cost: 1000000,
  },
  {
    id: "badge_og_listener",
    type: "badge",
    title: "OG Listener",
    description: "Odznak pro první posluchače",
    cost: 10000,
  },
  {
    id: "badge_night_owl",
    type: "badge",
    title: "Noční Sova",
    description: "Pro ty, co poslouchají v noci",
    cost: 15000,
  },
];

// Ad configuration (Google AdMob)
export const AD_CONFIG = {
  // Show interstitial ad every X minutes of listening
  interstitialInterval: 10,
  // Show banner ad
  showBanner: true,
  debugBanner: false,
  debugAdapters: false,
  // Google AdMob App IDs
  adMobIds: {
    android: {
      interstitial: "ca-app-pub-4420537843593379/9721993954",
      rewarded: "ca-app-pub-4420537843593379/9199249774",
      banner: "ca-app-pub-4420537843593379/8754017902",
    },
    ios: {
      interstitial: "ca-app-pub-4420537843593379/6235263798",
      rewarded: "ca-app-pub-4420537843593379/1320538950",
      banner: "ca-app-pub-4420537843593379/8836212682",
    },
  },
  // Max number of rewarded ads per hour
  hourlyLimit: 10,
};

export const META_AUDIENCE_NETWORK = {
  appId: "2027739537792530",
  placements: {
    native: "12027739537792530_2032080357358448",
    nativeBanner: "2027739537792530_2032080270691790",
    interstitial: "2027739537792530_2032080214025129",
    banner: "2027739537792530_2032080087358475",
    rewardedInterstitial: "2027739537792530_2032079804025170",
  },
};

export const LEVELPLAY_AD_UNITS = {
  interstitial: "cg0epjwtnnsl8xa6",
  rewarded: "yzamjgyi54fljgin",
  banner: "r812qy61x4trdo7y",
};
