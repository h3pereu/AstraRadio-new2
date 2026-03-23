// Points and Rewards Configuration

import { RewardItem } from "./types";

// Points earned per minute of listening
export const POINTS_PER_MINUTE = 1;

// Weekly listening requirement (in minutes) for weekly rewards
export const WEEKLY_HOURS_REQUIREMENT = 21; // 3 hours/day * 7 days
export const WEEKLY_MINUTES_REQUIREMENT = WEEKLY_HOURS_REQUIREMENT * 60;

// Shop rewards configuration
export const SHOP_REWARDS: RewardItem[] = [
  {
    id: "ad_free_24h",
    type: "ad_free",
    title: "Bez reklam 24h",
    description: "Užij si 24 hodin poslechu bez reklam",
    cost: 500,
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
