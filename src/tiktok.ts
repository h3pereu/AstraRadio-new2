// TikTok Business SDK Integration
// App ID: cz.astraradio.radio
// TikTok App ID: 7605321084539322386

import {
  TikTokBusiness,
  TikTokEventName,
} from "react-native-tiktok-business-sdk";

const TIKTOK_APP_ID = "cz.astraradio.radio";
const TIKTOK_TT_APP_ID = "7605321084539322386";
// TODO: Replace with your actual App Secret from TikTok Events Manager
const TIKTOK_ACCESS_TOKEN = "TTqlrzgFIe8T9Wt9edAWrVjmz5IB5Aiv";

let isInitialized = false;

/**
 * Initialize TikTok Business SDK.
 * Call once on app startup (e.g. in AppRoot).
 */
export async function initTikTok(debug = __DEV__): Promise<void> {
  if (isInitialized) return;
  try {
    await TikTokBusiness.initializeSdk(
      TIKTOK_APP_ID,
      TIKTOK_TT_APP_ID,
      TIKTOK_ACCESS_TOKEN,
      debug,
    );
    isInitialized = true;
    console.log("[TikTok] SDK initialized");
  } catch (error) {
    console.warn("[TikTok] SDK init failed:", error);
  }
}

/**
 * Identify the current user.
 * Call on login, register, profile update, or app reopen with remembered user.
 */
export async function identifyUser(
  externalId: string,
  externalUserName: string,
  email?: string,
  phoneNumber?: string,
): Promise<void> {
  try {
    await TikTokBusiness.identify(
      externalId,
      externalUserName,
      phoneNumber ?? "",
      email ?? "",
    );
    console.log("[TikTok] User identified:", externalUserName);
  } catch (error) {
    console.warn("[TikTok] identify failed:", error);
  }
}

/**
 * Track user registration event.
 */
export async function trackRegistration(): Promise<void> {
  try {
    await TikTokBusiness.trackEvent(TikTokEventName.REGISTRATION);
    console.log("[TikTok] Registration tracked");
  } catch (error) {
    console.warn("[TikTok] trackRegistration failed:", error);
  }
}

/**
 * Track user login event.
 */
export async function trackLogin(): Promise<void> {
  try {
    await TikTokBusiness.trackEvent(TikTokEventName.LOGIN);
    console.log("[TikTok] Login tracked");
  } catch (error) {
    console.warn("[TikTok] trackLogin failed:", error);
  }
}

/**
 * Track user logout.
 */
export async function logoutTikTok(): Promise<void> {
  try {
    await TikTokBusiness.logout();
    console.log("[TikTok] User logged out");
  } catch (error) {
    console.warn("[TikTok] logout failed:", error);
  }
}

/**
 * Track a custom event by name.
 */
export async function trackCustom(
  eventName: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  try {
    await TikTokBusiness.trackCustomEvent(eventName, properties);
  } catch (error) {
    console.warn("[TikTok] trackCustom failed:", error);
  }
}
