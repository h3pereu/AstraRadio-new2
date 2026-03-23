// In-app review prompt logic
import * as StoreReview from "expo-store-review";
import AsyncStorage from "@react-native-async-storage/async-storage";

const REVIEW_KEY = "@astra_review_status";
const REVIEW_PROMPTED_AT_KEY = "@astra_review_prompted_at";
const MIN_LISTENING_MINUTES = 30; // Show after 30 minutes of listening
const MIN_SESSIONS = 3; // Show after 3 app sessions
const COOLDOWN_DAYS = 60; // Don't ask again for 60 days

interface ReviewStatus {
  sessionCount: number;
  hasReviewed: boolean;
  lastPromptedAt: number | null;
}

async function getReviewStatus(): Promise<ReviewStatus> {
  try {
    const raw = await AsyncStorage.getItem(REVIEW_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { sessionCount: 0, hasReviewed: false, lastPromptedAt: null };
}

async function saveReviewStatus(status: ReviewStatus): Promise<void> {
  try {
    await AsyncStorage.setItem(REVIEW_KEY, JSON.stringify(status));
  } catch {}
}

// Call this on every app start to increment session count
export async function trackAppSession(): Promise<void> {
  const status = await getReviewStatus();
  status.sessionCount += 1;
  await saveReviewStatus(status);
}

// Call this after some listening time to maybe show review prompt
export async function maybeRequestReview(
  totalListeningMinutes: number,
): Promise<void> {
  const status = await getReviewStatus();

  // Never prompt again if user already reviewed
  if (status.hasReviewed) return;

  // Check cooldown
  if (status.lastPromptedAt) {
    const daysSince =
      (Date.now() - status.lastPromptedAt) / (1000 * 60 * 60 * 24);
    if (daysSince < COOLDOWN_DAYS) return;
  }

  // Check minimum thresholds
  if (status.sessionCount < MIN_SESSIONS) return;
  if (totalListeningMinutes < MIN_LISTENING_MINUTES) return;

  // Check if store review is available
  const isAvailable = await StoreReview.isAvailableAsync();
  if (!isAvailable) return;

  // Show the native review prompt
  try {
    await StoreReview.requestReview();
    status.lastPromptedAt = Date.now();
    await saveReviewStatus(status);
    console.log("[Review] Review prompt shown");
  } catch (err) {
    console.warn("[Review] Failed to show review prompt:", err);
  }
}

// Call this if user explicitly says they reviewed
export async function markAsReviewed(): Promise<void> {
  const status = await getReviewStatus();
  status.hasReviewed = true;
  await saveReviewStatus(status);
}
