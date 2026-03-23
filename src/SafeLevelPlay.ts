// Safe mock for Unity LevelPlay Mediation
import { View } from 'react-native';

const MockLevelPlayMediation = {
    initialize: async () => { },
    loadAd: async () => { },
    showAd: async () => { },
    isAdReady: async () => false,
    createBannerAd: () => { },
    destroyBannerAd: () => { },
};

const LevelPlayAdSize = {
    BANNER: 'BANNER',
    LARGE_BANNER: 'LARGE_BANNER',
    MEDIUM_RECTANGLE: 'MEDIUM_RECTANGLE',
    LEADERBOARD: 'LEADERBOARD',
};

const LevelPlayBannerAdView = (props: any) => {
    return null;
};

// Mock Interstitial Class matching the library's structure
export class LevelPlayInterstitialAdClass {
    constructor(adUnitId: string) { }
    loadAd() { }
    showAd() { }
    isAdReady() { return false; }
    setListener(listener: any) { }
}

// Mock Rewarded Class matching the library's structure
export class LevelPlayRewardedAdClass {
    constructor(adUnitId: string) { }
    loadAd() { }
    showAd() { }
    isAdReady() { return false; }
    setListener(listener: any) { }
}

let LevelPlayMediationExport = MockLevelPlayMediation;
let LevelPlayInterstitialAdExport = LevelPlayInterstitialAdClass;
let LevelPlayRewardedAdExport = LevelPlayRewardedAdClass;
let LevelPlayAdSizeExport = LevelPlayAdSize;
let LevelPlayBannerAdViewExport = LevelPlayBannerAdView;

try {
    const LP = require('unity-levelplay-mediation');
    if (LP) {
        if (LP.LevelPlayMediation) LevelPlayMediationExport = LP.LevelPlayMediation;
        if (LP.LevelPlayInterstitialAd) LevelPlayInterstitialAdExport = LP.LevelPlayInterstitialAd;
        if (LP.LevelPlayRewardedAd) LevelPlayRewardedAdExport = LP.LevelPlayRewardedAd;
        if (LP.LevelPlayAdSize) LevelPlayAdSizeExport = LP.LevelPlayAdSize;
        if (LP.LevelPlayBannerAdView) LevelPlayBannerAdViewExport = LP.LevelPlayBannerAdView;
    }
} catch (e) {
    console.warn('SafeLevelPlay: Native module missing, using MOCK.');
}

export {
    LevelPlayMediationExport as LevelPlayMediation,
    LevelPlayInterstitialAdExport as LevelPlayInterstitialAd,
    LevelPlayRewardedAdExport as LevelPlayRewardedAd,
    LevelPlayAdSizeExport as LevelPlayAdSize,
    LevelPlayBannerAdViewExport as LevelPlayBannerAdView,
};
