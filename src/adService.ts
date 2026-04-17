


function resolveInitStatus(status: 'success' | 'failed') {
  initStatus = status;
  const waiters = initWaiters;
  initWaiters = [];
  waiters.forEach((resolve) => resolve(status === 'success'));
}

async function waitForInitSuccess(timeoutMs = 8000): Promise<boolean> {
  if (initStatus === 'success') return true;
  if (initStatus === 'failed') return false;

  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      resolve(false);
    }, timeoutMs);

    initWaiters.push((ready) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(ready);
    });
  });
}

// Unity LevelPlay Ad Service - Real Ads Implementation
import { Platform } from 'react-native';
import { AD_CONFIG, LEVELPLAY_AD_UNITS } from './config';
import { isAdFreeActive } from './storage';

import {
  LevelPlay,
  LevelPlayInitRequest,
  LevelPlayAdSize,
  LevelPlayBannerAdView,
  LevelPlayInterstitialAd,
  LevelPlayRewardedAd,
} from 'unity-levelplay-mediation';
import TrackPlayer from 'react-native-track-player';

// Adapter classes for the service
const LevelPlayRewardedAdClass = LevelPlayRewardedAd;
const LevelPlayInterstitialAdClass = LevelPlayInterstitialAd;
const LevelPlayInitRequestClass = LevelPlayInitRequest;


// Track last rewarded ad time for 5 min cooldown
let lastRewardedAdTime = 0;

// Helper to check if SDK is actually loaded (native module exists)
function isLevelPlayAvailable() {
  return !!LevelPlay;
}

let isInitialized = false;
let rewardedAdInstance: any = null;
let interstitialAdInstance: any = null;
let initStatus: 'idle' | 'in_progress' | 'success' | 'failed' = 'idle';
let initWaiters: Array<(ready: boolean) => void> = [];

export async function initializeAds(userId?: string): Promise<boolean> {
  // If already successfully initialized, return true
  if (initStatus === 'success') return true;

  // If init is in progress, wait for it
  if (initStatus === 'in_progress') {
    console.log('[LevelPlay] Init already in progress, waiting...');
    return waitForInitSuccess();
  }

  const hasLevelPlay = isLevelPlayAvailable();

  if (!hasLevelPlay) {
    console.log('[LevelPlay] Running in mock mode - SDK not available');
    isInitialized = true;
    initStatus = 'success';
    return true;
  }

  try {
    if (AD_CONFIG.debugAdapters && LevelPlay.setAdaptersDebug) {
      await LevelPlay.setAdaptersDebug(true);
      console.log('[LevelPlay] Adapter debug enabled');
    }

    // Enable test ads/suite only in development builds
    // ⚠️  Never enable in production — test mode serves test ads, not real revenue ads
    if (__DEV__ && LevelPlay.setMetaData) {
      await LevelPlay.setMetaData('is_test_suite', ['enable']);
      console.log('[LevelPlay] Test mode enabled (dev only)');
    }

    // Mute ALL ad networks sounds (so radio continues playing during ads)
    if (LevelPlay.setMetaData) {
      // Mute Unity ads
      await LevelPlay.setMetaData('UnityAds_muteVideo', ['true']);
      // Mute IronSource ads
      await LevelPlay.setMetaData('is_muted', ['true']);
      // Mute Meta/Facebook ads
      await LevelPlay.setMetaData('Facebook_muted', ['true']);
      // Mute Yandex ads
      await LevelPlay.setMetaData('Yandex_muted', ['true']);
      // Mute AdMob ads
      await LevelPlay.setMetaData('AdMob_muted', ['true']);
      console.log('[LevelPlay] All ad networks muted - radio will continue playing');
    }
    // Initialize Unity LevelPlay with your actual app key
    const appKey = '24d3f298d'; // Your Astra Radio app key from Unity dashboard

    console.log('[LevelPlay] Initializing with app key:', appKey, 'Platform:', Platform.OS);

    // Use the real user ID (nick) for accurate Unity tracking.
    // Falls back to a timestamp-based ID for guests / pre-login init.
    const resolvedUserId = userId ?? ('guest-' + Date.now());
    console.log('[LevelPlay] Setting userId for tracking:', resolvedUserId);

    const initRequest = LevelPlayInitRequest.builder(appKey)
      .withUserId(resolvedUserId)
      .build();

    initStatus = 'in_progress';
    // Create initialization listener
    const initListener = {
      onInitSuccess: (config: any) => {
        console.log('[LevelPlay] ✅ Initialization SUCCESS!', JSON.stringify(config));
        // The config object lists active networks — check this log after each build
        // to confirm AdMob, Meta, Liftoff, and Yandex adapters are detected.
        const networks = config?.availableAdapters ?? config?.adapters ?? [];
        if (networks.length > 0) {
          console.log('[LevelPlay] Active mediation networks:', networks.map((n: any) => n?.name ?? n).join(', '));
        }
        isInitialized = true;
        resolveInitStatus('success');

        // Create ad instances AFTER successful initialization
        // Using your actual ad unit IDs from Unity dashboard
        if (LevelPlayRewardedAdClass && !rewardedAdInstance) {
          rewardedAdInstance = new LevelPlayRewardedAdClass(LEVELPLAY_AD_UNITS.rewarded);
          console.log('[LevelPlay] Created rewarded ad instance after init success');
        }

        if (LevelPlayInterstitialAdClass && !interstitialAdInstance) {
          interstitialAdInstance = new LevelPlayInterstitialAdClass(LEVELPLAY_AD_UNITS.interstitial);
          console.log('[LevelPlay] Created interstitial ad instance after init success');
        }

        // Preload ads after initialization succeeds
        setTimeout(() => {
          console.log('[LevelPlay] Starting to preload ads after init success...');
          loadInterstitial();
          loadRewardedAd();
        }, 100);
      },
      onInitFailed: (error: any) => {
        console.warn('[LevelPlay] ❌ Initialization FAILED:', JSON.stringify(error));
        resolveInitStatus('failed');
      },
    };

    // Initialize SDK
    await LevelPlay.init(initRequest, initListener);

    // Validate integration in dev mode
    if (__DEV__ && LevelPlay.validateIntegration) {
      console.log('[LevelPlay] Development mode - validating integration');
      await LevelPlay.validateIntegration();
    }

    console.log('[LevelPlay] SDK init called, waiting for success callback...');

    // IMPORTANT: Wait for the actual init callback before returning
    const initSuccess = await waitForInitSuccess(10000); // 10 second timeout
    console.log('[LevelPlay] Init wait completed, success:', initSuccess);

    return initSuccess;
  } catch (error) {
    console.warn('[LevelPlay] Initialization failed, falling back to mock:', error);
    resolveInitStatus('failed');
    isInitialized = true;
    return false;
  }
}

export async function launchTestSuite(): Promise<boolean> {
  const hasLevelPlay = isLevelPlayAvailable();
  if (!hasLevelPlay || !LevelPlay?.launchTestSuite) {
    console.warn('[LevelPlay] Test suite not available');
    return false;
  }

  try {
    if (!isInitialized) {
      await initializeAds();
    }
    const initReady = await waitForInitSuccess();
    if (!initReady) {
      console.warn('[LevelPlay] Test suite blocked - init not ready:', initStatus);
      return false;
    }
    await LevelPlay.launchTestSuite();
    console.log('[LevelPlay] Test suite launched');
    return true;
  } catch (error) {
    console.warn('[LevelPlay] Failed to launch test suite:', error);
    return false;
  }
}

// Integration Helper - validates SDK and adapter integration
// Call this to verify all ad networks are properly integrated
// Check logcat for output with "IntegrationHelper" tag
export async function validateIntegration(): Promise<boolean> {
  const hasLevelPlay = isLevelPlayAvailable();
  if (!hasLevelPlay || !LevelPlay?.validateIntegration) {
    console.warn('[LevelPlay] validateIntegration not available');
    return false;
  }

  try {
    if (!isInitialized) {
      await initializeAds();
    }
    const initReady = await waitForInitSuccess();
    if (!initReady) {
      console.warn('[LevelPlay] validateIntegration blocked - init not ready');
      return false;
    }
    await LevelPlay.validateIntegration();
    console.log('[LevelPlay] Integration validation started - check logcat for results');
    return true;
  } catch (error) {
    console.warn('[LevelPlay] Failed to validate integration:', error);
    return false;
  }
}

export async function loadInterstitial(): Promise<boolean> {
  if (!interstitialAdInstance) return true;

  try {
    console.log('[LevelPlay] Loading interstitial ad...');
    await interstitialAdInstance.loadAd();
    return true;
  } catch (error) {
    console.warn('[LevelPlay] Failed to load interstitial:', error);
    return false;
  }
}

export async function loadRewardedAd(): Promise<boolean> {
  if (!rewardedAdInstance) {
    console.log('[LevelPlay] Rewarded ad instance not available');
    return true;
  }

  try {
    console.log('[LevelPlay] Loading rewarded ad...');

    // Set up load listeners to see what happens
    rewardedAdInstance.setListener({
      onAdLoaded: (adInfo: any) => {
        console.log('[LevelPlay] ✅ Rewarded ad loaded successfully!', JSON.stringify(adInfo));
      },
      onAdLoadFailed: (error: any) => {
        console.warn('[LevelPlay] ❌ Rewarded ad load failed:', JSON.stringify(error));
      },
      onAdDisplayed: (adInfo: any) => {
        console.log('[LevelPlay] ✅ Rewarded ad displayed!', JSON.stringify(adInfo));
      },
      onAdDisplayFailed: (adInfo: any, error: any) => {
        console.warn('[LevelPlay] ❌ Rewarded ad display failed:', JSON.stringify(error));
      },
      onAdClicked: (adInfo: any) => {
        console.log('[LevelPlay] Ad clicked', JSON.stringify(adInfo));
      },
      onAdClosed: (adInfo: any) => {
        console.log('[LevelPlay] Ad closed', JSON.stringify(adInfo));
      },
      onAdRewarded: (adInfo: any, reward: any) => {
        console.log('[LevelPlay] ✅ User rewarded!', JSON.stringify(reward));
      },
    });

    await rewardedAdInstance.loadAd();
    console.log('[LevelPlay] Rewarded ad load request sent');
    return true;
  } catch (error) {
    console.warn('[LevelPlay] Failed to load rewarded ad - exception:', error);
    return false;
  }
}

export async function showInterstitial(): Promise<boolean> {
  try {
    const adFree = await isAdFreeActive();
    if (adFree) {
      console.log('[LevelPlay] User has ad-free active, skipping ad');
      return false;
    }

    if (!isInitialized) {
      console.log('[LevelPlay] Not initialized');
      return false;
    }

    if (!interstitialAdInstance) {
      console.log('[LevelPlay] Mock interstitial (no package)');
      return true;
    }

    const isReady = await interstitialAdInstance.isAdReady();
    if (!isReady) {
      console.log('[LevelPlay] Interstitial not ready, loading...');
      await loadInterstitial();
      return false;
    }

    console.log('[LevelPlay] Showing interstitial ad (muted)');

    // Import TrackPlayer to pause/resume audio

    return new Promise((resolve) => {
      let wasPlaying = false;

      // Set up listener to pause audio and handle lifecycle
      interstitialAdInstance.setListener({
        onAdLoaded: (adInfo: any) => {
          console.log('[LevelPlay] Interstitial loaded');
        },
        onAdLoadFailed: (error: any) => {
          console.warn('[LevelPlay] Interstitial load failed:', error);
        },
        onAdDisplayed: async (adInfo: any) => {
          console.log('[LevelPlay] Interstitial displayed - pausing audio');
          // Pause audio while ad is showing (effectively mutes the ad)
          try {
            const state = await TrackPlayer.getPlaybackState();
            wasPlaying = state.state === 'playing';
            if (wasPlaying) {
              await TrackPlayer.pause();
            }
          } catch (err) {
            console.warn('[LevelPlay] Failed to pause audio:', err);
          }
        },
        onAdDisplayFailed: (error: any) => {
          console.warn('[LevelPlay] Interstitial display failed:', error);
          resolve(false);
        },
        onAdClicked: (adInfo: any) => {
          console.log('[LevelPlay] Interstitial clicked');
        },
        onAdClosed: async (adInfo: any) => {
          console.log('[LevelPlay] Interstitial closed - resuming audio');
          // Resume audio after ad closes
          try {
            if (wasPlaying) {
              await TrackPlayer.play();
            }
          } catch (err) {
            console.warn('[LevelPlay] Failed to resume audio:', err);
          }

          // Preload next ad
          loadInterstitial();
          resolve(true);
        },
      });

      interstitialAdInstance.showAd().catch((error: any) => {
        console.warn('[LevelPlay] Show interstitial error:', error);
        resolve(false);
      });
    });
  } catch (error) {
    console.warn('[LevelPlay] Interstitial error:', error);
    return false;
  }
}

// Check if 5 minutes have passed since last rewarded ad
export function canShowRewardedAd(): boolean {
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
  const timeSinceLastAd = now - lastRewardedAdTime;

  if (timeSinceLastAd < fiveMinutes) {
    const remainingSeconds = Math.ceil((fiveMinutes - timeSinceLastAd) / 1000);
    console.log(`[LevelPlay] Rewarded ad cooldown: ${remainingSeconds}s remaining`);
    return false;
  }

  return true;
}

export async function showRewardedAdForQuality(): Promise<{ completed: boolean; allowChange: boolean }> {
  console.log('[LevelPlay] showRewardedAdForQuality called');

  // Check ad-free status
  const adFree = await isAdFreeActive();
  if (adFree) {
    console.log('[LevelPlay] User has ad-free, allowing quality change without ad');
    return { completed: true, allowChange: true };
  }

  // DEV MODE BYPASS: Skip ads in development builds
  if (__DEV__) {
    console.log('[LevelPlay] Dev mode - bypassing ad requirement for quality change');
    return { completed: true, allowChange: true };
  }

  // Check cooldown
  if (!canShowRewardedAd()) {
    console.log('[LevelPlay] Cooldown active, allowing quality change without ad');
    return { completed: true, allowChange: true };
  }

  // Show rewarded ad
  const result = await showRewardedAd();

  // Start cooldown regardless of ad result (to prevent spam)
  lastRewardedAdTime = Date.now();
  console.log('[LevelPlay] Cooldown started after quality change attempt');

  // If ad completed, great! If not (no fill, failed, etc.), still allow change
  // This prevents users from being stuck when ads aren't available
  if (result.completed) {
    console.log('[LevelPlay] Rewarded ad completed successfully');
  } else {
    console.log('[LevelPlay] Rewarded ad did not complete (no fill or cancelled), allowing change anyway');
  }

  return {
    completed: result.completed,
    allowChange: true  // Always allow change after ad attempt
  };
}

export async function showRewardedAd(): Promise<{ completed: boolean; reward?: number; error?: string }> {
  console.log('[LevelPlay] showRewardedAd called');

  if (!isInitialized) {
    console.log('[LevelPlay] Not initialized, attempting to initialize...');
    const initialized = await initializeAds();
    if (!initialized) {
      console.log('[LevelPlay] Failed to initialize');
      return { completed: false, error: 'init_failed' };
    }
    // Wait a bit for ad instances to be created
    await new Promise(resolve => setTimeout(() => resolve(undefined), 2000));
  }

  // If package not loaded or instance missing
  if (!rewardedAdInstance) {
    console.log('[LevelPlay] SDK not available or instance missing - cannot show ad');
    return { completed: false, error: 'sdk_missing' };
  }

  try {
    console.log('[LevelPlay] Checking if rewarded ad is ready...');
    const isReady = await rewardedAdInstance.isAdReady();
    console.log('[LevelPlay] Rewarded ad ready status:', isReady);

    if (!isReady) {
      console.log('[LevelPlay] Rewarded ad not ready, loading with retries...');

      // Retry up to 3 times with 2 second intervals
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        attempts++;
        console.log(`[LevelPlay] Loading rewarded ad (attempt ${attempts}/${maxAttempts})...`);

        await loadRewardedAd();

        // Wait for ad to load
        console.log('[LevelPlay] Waiting 2 seconds for ad to load...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        const isReadyNow = await rewardedAdInstance.isAdReady();
        console.log(`[LevelPlay] Rewarded ad ready after attempt ${attempts}:`, isReadyNow);

        if (isReadyNow) {
          break;
        }
      }

      // Final check
      const finalReady = await rewardedAdInstance.isAdReady();
      if (!finalReady) {
        console.log('[LevelPlay] Rewarded ad still not ready after all retries');
        return { completed: false, error: 'not_ready' };
      }
    }

    console.log('[LevelPlay] Attempting to show rewarded ad...');

    // Import TrackPlayer to keep music playing during ad
    const { default: TrackPlayer } = await import('react-native-track-player');

    return new Promise((resolve) => {
      let didComplete = false;
      let didClose = false;
      let wasPlaying = false;
      let resolveTimeout: NodeJS.Timeout | null = null;

      // Helper to resolve safely
      const safeResolve = (result: { completed: boolean; reward?: number; error?: string }) => {
        if (!didClose) {
          didClose = true;
          if (resolveTimeout) clearTimeout(resolveTimeout);
          resolve(result);
        }
      };

      // Set up one-time listeners for this ad show
      const listener = {
        onAdLoaded: (adInfo: any) => {
          console.log('[LevelPlay] Rewarded ad loaded event', JSON.stringify(adInfo));
        },
        onAdLoadFailed: (error: any) => {
          console.warn('[LevelPlay] Rewarded ad load failed:', JSON.stringify(error));
        },
        onAdDisplayed: async (adInfo: any) => {
          console.log('[LevelPlay] ✅ Rewarded ad displayed - pausing audio');
          // Pause audio while ad is showing (mutes ad sound)
          try {
            const state = await TrackPlayer.getPlaybackState();
            wasPlaying = state.state === 'playing' || state.state === 'buffering';
            if (wasPlaying) {
              await TrackPlayer.pause();
            }
          } catch (err) {
            console.warn('[LevelPlay] Failed to pause audio:', err);
          }
        },
        onAdDisplayFailed: (adInfo: any, error: any) => {
          console.warn('[LevelPlay] ❌ Rewarded ad display failed:', JSON.stringify(error));
          safeResolve({ completed: false, error: 'display_failed' });
        },
        onAdClicked: (adInfo: any) => {
          console.log('[LevelPlay] Ad clicked', JSON.stringify(adInfo));
        },
        onAdClosed: async (adInfo: any) => {
          console.log('[LevelPlay] Rewarded ad closed - resuming audio, didComplete:', didComplete);

          // Resume audio after ad closes
          try {
            if (wasPlaying) {
              await TrackPlayer.play();
            }
          } catch (err) {
            console.warn('[LevelPlay] Failed to resume audio:', err);
          }

          // Preload next rewarded ad
          loadRewardedAd();

          // Wait a moment before resolving, just in case the reward callback is slightly delayed
          // This fixes race conditions where onAdClosed fires before onAdRewarded
          setTimeout(() => {
            if (didComplete) {
              console.log('[LevelPlay] Resolving with reward: 50 points');
              safeResolve({ completed: true, reward: 50 });
            } else {
              console.log('[LevelPlay] Resolving without reward - user did not complete ad');
              safeResolve({ completed: false, error: 'early_close' });
            }
          }, 1000);
        },
        onAdRewarded: (adInfo: any, reward: any) => {
          console.log('[LevelPlay] ✅ User earned reward!', JSON.stringify(reward));
          didComplete = true; // Mark as completed, wait for close to resolve
        },
      };

      // Set listener
      rewardedAdInstance.setListener(listener);
      console.log('[LevelPlay] Listeners registered');

      // Show the ad (default placement)
      console.log('[LevelPlay] Calling showAd()...');
      rewardedAdInstance.showAd()
        .then(() => {
          console.log('[LevelPlay] showAd() promise resolved');
        })
        .catch((error: any) => {
          console.warn('[LevelPlay] ❌ Show rewarded ad error:', JSON.stringify(error));
          safeResolve({ completed: false, error: 'show_error' });
        });

      // Timeout after 90 seconds (increased from 60s)
      resolveTimeout = setTimeout(() => {
        console.log('[LevelPlay] ⏱️ Timeout reached (90s)');
        safeResolve({ completed: false, error: 'timeout' });
      }, 90000);
    });
  } catch (error) {
    console.warn('[LevelPlay] ❌ Rewarded ad exception:', error);
    return { completed: false, error: 'exception' };
  }
}

// Ad timing tracker
let lastAdTime = 0;
let minutesSinceLastAd = 0;
// Track rewarded ad completions for hourly limit
let rewardedAdsHistory: number[] = [];

export function updateAdTimer(minutesListened: number): void {
  minutesSinceLastAd = minutesListened - lastAdTime;
}

export async function shouldShowAd(): Promise<boolean> {
  try {
    const adFree = await isAdFreeActive();
    if (adFree) return false;

    if (minutesSinceLastAd >= AD_CONFIG.interstitialInterval) {
      lastAdTime = minutesSinceLastAd + lastAdTime;
      return true;
    }

    return false;
  } catch (error) {
    console.warn('[LevelPlay] shouldShowAd error:', error);
    return false;
  }
}

export function resetAdTimer(): void {
  lastAdTime = 0;
  minutesSinceLastAd = 0;
}

export async function showBanner(): Promise<boolean> {
  try {
    const adFree = await isAdFreeActive();
    if (adFree) return false;
    return AD_CONFIG.showBanner;
  } catch (error) {
    console.warn('[LevelPlay] showBanner error:', error);
    return false;
  }
}

export async function hideBanner(): Promise<void> {
  // Hide banner implementation
}

/**
 * Checks if the user has reached the hourly limit for rewarded ads
 * @returns { canShow: boolean, remainingTimeMs: number }
 */
export function checkHourlyAdLimit(): { canShow: boolean; remainingTimeMs: number } {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  // Filter out ads older than 1 hour
  rewardedAdsHistory = rewardedAdsHistory.filter(timestamp => timestamp > oneHourAgo);

  if (rewardedAdsHistory.length >= AD_CONFIG.hourlyLimit) {
    // Return time until the oldest ad expires
    const oldestAd = rewardedAdsHistory[0];
    const expiresAt = oldestAd + 60 * 60 * 1000;
    return { canShow: false, remainingTimeMs: expiresAt - now };
  }

  return { canShow: true, remainingTimeMs: 0 };
}

/**
 * Records a successful rewarded ad view
 */
export function recordRewardedAdView(): void {
  rewardedAdsHistory.push(Date.now());
}
