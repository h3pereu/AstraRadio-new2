// API Service for backend communication

import {
  UserData,
  NickCheckResponse,
  RegisterResponse,
  SyncResponse,
} from "./types";

const API_BASE = "https://astraradio.cz/api";

// Check if nickname is available
export async function checkNickAvailability(
  nick: string,
): Promise<NickCheckResponse> {
  try {
    const response = await fetch(`${API_BASE}/nick/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nick }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error checking nick availability:", error);
    return {
      available: false,
      message: "Nepodařilo se ověřit dostupnost nicku",
    };
  }
}

// Register new user (creates account on server)
export async function registerUser(
  nick: string,
  password: string,
): Promise<RegisterResponse> {
  try {
    const response = await fetch(`${API_BASE}/user/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nick, password }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error registering user:", error);
    return { success: false, message: "Registrace selhala. Zkuste to znovu." };
  }
}

// Login with existing nick and password
export async function loginUser(
  nick: string,
  password: string,
): Promise<SyncResponse> {
  try {
    const response = await fetch(`${API_BASE}/user/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nick, password }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error logging in:", error);
    return { success: false, message: "Přihlášení selhalo. Zkuste to znovu." };
  }
}

// Sync user data to server
export async function syncUserData(userData: UserData): Promise<SyncResponse> {
  try {
    const response = await fetch(`${API_BASE}/user/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nick: userData.nick,
        points: userData.points,
        totalListeningMinutes: userData.totalListeningMinutes,
        weeklyListeningMinutes: userData.weeklyListeningMinutes,
        weekStartDate: userData.weekStartDate,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error syncing user data:", error);
    return { success: false, message: "Synchronizace selhala" };
  }
}

// Get user data from server
export async function fetchUserData(nick: string): Promise<SyncResponse> {
  try {
    const response = await fetch(
      `${API_BASE}/user/${encodeURIComponent(nick)}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      },
    );

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching user data:", error);
    return { success: false, message: "Nepodařilo se načíst data" };
  }
}

// Submit merch order
export async function submitMerchOrder(
  nick: string,
  rewardId: string,
  contactInfo: {
    email: string;
    name: string;
    address: string;
    phone?: string;
  },
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await fetch(`${API_BASE}/shop/merch-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nick,
        rewardId,
        ...contactInfo,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error submitting merch order:", error);
    return { success: false, message: "Objednávka selhala. Zkuste to znovu." };
  }
}

// Delete user account
export async function deleteAccount(
  nick: string,
  password: string,
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await fetch(`${API_BASE}/user/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nick, password }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error deleting account:", error);
    return {
      success: false,
      message: "Smazání účtu selhalo. Zkuste to znovu.",
    };
  }
}
