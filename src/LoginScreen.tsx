// Login/Register Screen Component

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { checkNickAvailability, registerUser, loginUser } from "./api";
import {
  createUser,
  getUserData,
  saveUserData,
  setUserDataFromServer,
} from "./storage";
import { UserData } from "./types";
import StarryBackground from "./StarryBackground";
import { trackRegistration } from "./tiktok";

interface LoginScreenProps {
  onLoginComplete: (userData: UserData) => void;
}

type Mode = "choice" | "register" | "login";

const colors = {
  background: "#0B1014",
  surface: "#0f1a20",
  surfaceStrong: "#12232c",
  accent: "#00E5FF",
  accentStrong: "#45a29e",
  textPrimary: "#ffffff",
  textMuted: "#cfeff0",
  line: "rgba(0, 229, 255, 0.18)",
  error: "#f39c9c",
  success: "#00E5FF",
};

const fonts = {
  heading: "Inter-SemiBold", // Changed from Orbitron to match App.tsx
  body: "Inter-Regular", // Changed from Poppins
  bodyMedium: "Inter-Regular", // Changed from Poppins
  bodySemi: "Inter-SemiBold", // Changed from Poppins
};

export default function LoginScreen({ onLoginComplete }: LoginScreenProps) {
  const [mode, setMode] = useState<Mode>("choice");
  const [nick, setNick] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [nickAvailable, setNickAvailable] = useState<boolean | null>(null);
  const [checkingNick, setCheckingNick] = useState(false);

  const mergeLocalProgress = useCallback(async (serverUser: UserData) => {
    const localUser = await getUserData();
    if (!localUser || localUser.hasAccount) {
      return { user: serverUser, merged: false };
    }

    const sameWeek = localUser.weekStartDate === serverUser.weekStartDate;
    const mergedUser: UserData = {
      ...serverUser,
      points: serverUser.points + localUser.points,
      totalListeningMinutes:
        serverUser.totalListeningMinutes + localUser.totalListeningMinutes,
      weeklyListeningMinutes:
        serverUser.weeklyListeningMinutes +
        (sameWeek ? localUser.weeklyListeningMinutes : 0),
    };

    return { user: mergedUser, merged: true };
  }, []);

  const validateNick = (value: string): string | null => {
    if (value.length < 3) return "Nick musí mít alespoň 3 znaky";
    if (value.length > 20) return "Nick může mít maximálně 20 znaků";
    if (!/^[a-zA-Z0-9_]+$/.test(value))
      return "Nick může obsahovat pouze písmena, čísla a podtržítko";
    return null;
  };

  const validatePassword = (value: string): string | null => {
    if (value.length < 6) return "Heslo musí mít alespoň 6 znaků";
    return null;
  };

  const handleNickChange = useCallback(
    async (value: string) => {
      setNick(value);
      setError("");
      setNickAvailable(null);

      const validationError = validateNick(value);
      if (validationError) {
        if (value.length >= 3) setError(validationError);
        return;
      }

      if (mode === "register" && value.length >= 3) {
        setCheckingNick(true);
        try {
          const result = await checkNickAvailability(value);
          setNickAvailable(result.available);
          if (!result.available) {
            setError(result.message || "Tento nick je již obsazený");
          }
        } catch (err) {
          console.warn("[LoginScreen] Nick check error:", err);
        } finally {
          setCheckingNick(false);
        }
      }
    },
    [mode],
  );

  const handleRegister = useCallback(async () => {
    console.log("[LoginScreen] handleRegister called");

    const nickError = validateNick(nick);
    if (nickError) {
      setError(nickError);
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError("Hesla se neshodují");
      return;
    }

    setLoading(true);
    setError("");

    try {
      console.log("[LoginScreen] Checking nick availability...");
      const checkResult = await checkNickAvailability(nick);
      if (!checkResult.available) {
        setError("Tento nick je již obsazený");
        setLoading(false);
        return;
      }

      console.log("[LoginScreen] Registering user...");
      const registerResult = await registerUser(nick, password);
      console.log("[LoginScreen] Register result:", registerResult);

      if (!registerResult.success) {
        setError(registerResult.message || "Registrace selhala");
        setLoading(false);
        return;
      }

      if (registerResult.userData) {
        const mergeResult = await mergeLocalProgress(registerResult.userData);
        if (mergeResult.merged) {
          console.log(
            "[LoginScreen] Merging local progress into new account...",
          );
          await saveUserData(mergeResult.user);
        } else {
          console.log("[LoginScreen] Setting user data from server...");
          await setUserDataFromServer(mergeResult.user);
        }
        console.log("[LoginScreen] Calling onLoginComplete...");
        trackRegistration();
        onLoginComplete(mergeResult.user);
      } else {
        const localUser = await getUserData();
        if (localUser && !localUser.hasAccount) {
          const upgradedUser: UserData = {
            ...localUser,
            nick,
            hasAccount: true,
            createdAt: new Date().toISOString(),
          };
          console.log("[LoginScreen] Upgrading local user to account...");
          await saveUserData(upgradedUser);
          console.log(
            "[LoginScreen] Calling onLoginComplete with upgraded user...",
          );
          trackRegistration();
          onLoginComplete(upgradedUser);
        } else {
          console.log("[LoginScreen] Creating local user...");
          const userData = await createUser(nick, true);
          await saveUserData(userData);
          console.log(
            "[LoginScreen] Calling onLoginComplete with local user...",
          );
          trackRegistration();
          onLoginComplete(userData);
        }
      }
    } catch (err) {
      console.error("[LoginScreen] Register error:", err);
      setError("Něco se pokazilo. Zkuste to znovu.");
    } finally {
      setLoading(false);
    }
  }, [nick, password, confirmPassword, onLoginComplete, mergeLocalProgress]);
  const handleLogin = useCallback(async () => {
    console.log("[LoginScreen] handleLogin called");

    const nickError = validateNick(nick);
    if (nickError) {
      setError(nickError);
      return;
    }

    if (!password) {
      setError("Zadejte heslo");
      return;
    }

    setLoading(true);
    setError("");

    try {
      console.log("[LoginScreen] Logging in...");
      const loginResult = await loginUser(nick, password);
      console.log("[LoginScreen] Login result:", loginResult);

      if (!loginResult.success || !loginResult.userData) {
        setError(loginResult.message || "Přihlášení selhalo");
        setLoading(false);
        return;
      }

      const mergeResult = await mergeLocalProgress(loginResult.userData);
      if (mergeResult.merged) {
        console.log("[LoginScreen] Merging local progress into account...");
        await saveUserData(mergeResult.user);
      } else {
        console.log("[LoginScreen] Setting user data from server...");
        await setUserDataFromServer(mergeResult.user);
      }
      console.log("[LoginScreen] Calling onLoginComplete...");
      onLoginComplete(mergeResult.user);
    } catch (err) {
      console.error("[LoginScreen] Login error:", err);
      setError("Něco se pokazilo. Zkuste to znovu.");
    } finally {
      setLoading(false);
    }
  }, [nick, password, onLoginComplete, mergeLocalProgress]);

  const handleLocalOnly = useCallback(async () => {
    console.log("[LoginScreen] handleLocalOnly called");

    const validationError = validateNick(nick);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      console.log("[LoginScreen] Creating local user...");
      const userData = await createUser(nick, false);
      console.log("[LoginScreen] Calling onLoginComplete...");
      onLoginComplete(userData);
    } catch (err) {
      console.error("[LoginScreen] Local only error:", err);
      setError("Něco se pokazilo. Zkuste to znovu.");
    } finally {
      setLoading(false);
    }
  }, [nick, onLoginComplete]);

  const handleGuestMode = useCallback(async () => {
    setLoading(true);
    try {
      const guestNick = `guest_${Date.now()}`;
      console.log("[LoginScreen] Creating guest user...");
      const userData = await createUser(guestNick, false);
      console.log("[LoginScreen] Calling onLoginComplete with guest user...");
      onLoginComplete(userData);
    } catch (err) {
      console.error("[LoginScreen] Guest mode error:", err);
      setError("Něco se pokazilo. Zkuste to znovu.");
    } finally {
      setLoading(false);
    }
  }, [onLoginComplete]);

  if (mode === "choice") {
    return (
      <View style={styles.container}>
        <StarryBackground />
        <View style={styles.content}>
          <Text style={styles.logo}>ASTRA RADIO</Text>
          <Text style={styles.tagline}>Na druhé straně vlny</Text>

          <View style={styles.choiceBox}>
            <Text style={styles.welcomeText}>Vítej v Astra Radio!</Text>
            <Text style={styles.descText}>
              Poslouchej hudbu a získávej body za odměny v našem obchůdku.
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
                loading && styles.buttonDisabled,
              ]}
              onPress={() => setMode("register")}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>Vytvořit účet</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.buttonPressed,
                loading && styles.buttonDisabled,
              ]}
              onPress={() => setMode("login")}
              disabled={loading}
            >
              <Text style={styles.secondaryButtonText}>Přihlásit se</Text>
            </Pressable>

            <Text style={styles.orText}>nebo</Text>

            <Pressable
              style={({ pressed }) => [
                styles.tertiaryButton,
                pressed && styles.buttonPressed,
                loading && styles.buttonDisabled,
              ]}
              onPress={handleGuestMode}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.textMuted} />
              ) : (
                <Text style={styles.tertiaryButtonText}>
                  Pokračovat bez účtu
                </Text>
              )}
            </Pressable>
          </View>

          <Text style={styles.infoText}>
            S účtem se ti body a odměny synchronizují mezi zařízeními.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StarryBackground />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <Pressable
            style={styles.backButton}
            onPress={() => {
              setMode("choice");
              setNick("");
              setPassword("");
              setConfirmPassword("");
              setError("");
              setNickAvailable(null);
            }}
          >
            <Text style={styles.backIcon}>←</Text>
          </Pressable>

          <Text style={styles.logo}>ASTRA RADIO</Text>

          <View style={styles.formBox}>
            <Text style={styles.formTitle}>
              {mode === "register" ? "Vytvoř si účet" : "Přihlášení"}
            </Text>
            <Text style={styles.formDesc}>
              {mode === "register"
                ? "Vyber si unikátní přezdívku a heslo"
                : "Zadej svůj nick a heslo"}
            </Text>

            {/* Nick input */}
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Nick</Text>
              <TextInput
                style={[
                  styles.input,
                  error && styles.inputError,
                  nickAvailable === true && styles.inputSuccess,
                ]}
                placeholder="Tvůj nick"
                placeholderTextColor="rgba(207, 239, 240, 0.4)"
                value={nick}
                onChangeText={handleNickChange}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
              />
              {checkingNick && (
                <ActivityIndicator
                  style={styles.inputLoader}
                  size="small"
                  color={colors.accent}
                />
              )}
              {nickAvailable === true && !checkingNick && (
                <Text style={styles.inputCheck}>✓</Text>
              )}
            </View>

            {/* Password input */}
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Heslo</Text>
              <TextInput
                style={styles.input}
                placeholder="Tvoje heslo"
                placeholderTextColor="rgba(207, 239, 240, 0.4)"
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  setError("");
                }}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
            </View>

            {/* Confirm password (only for register) */}
            {mode === "register" && (
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Potvrdit heslo</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Heslo znovu"
                  placeholderTextColor="rgba(207, 239, 240, 0.4)"
                  value={confirmPassword}
                  onChangeText={(v) => {
                    setConfirmPassword(v);
                    setError("");
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />
              </View>
            )}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                loading && styles.buttonDisabled,
                pressed && styles.buttonPressed,
              ]}
              onPress={mode === "register" ? handleRegister : handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#0B1014" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {mode === "register" ? "Vytvořit účet" : "Přihlásit se"}
                </Text>
              )}
            </Pressable>

            {mode === "register" && (
              <View>
                <Text style={styles.orText}>nebo</Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.tertiaryButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={handleLocalOnly}
                  disabled={loading}
                >
                  <Text style={styles.tertiaryButtonText}>
                    Pokračovat bez účtu
                  </Text>
                </Pressable>
                <Text style={styles.warningText}>
                  Bez účtu se body nebudou synchronizovat
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
  },
  backIcon: {
    color: colors.accent,
    fontSize: 20,
    fontFamily: fonts.bodySemi,
  },
  logo: {
    fontFamily: "Onest-Bold",
    fontSize: 36,
    color: "#E6F1F5",
    fontWeight: "700",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: "#E6F1F5",
    marginTop: 4,
    marginBottom: 40,
    letterSpacing: 0,
  },
  choiceBox: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
  },
  formBox: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: 40,
  },
  welcomeText: {
    fontFamily: fonts.bodySemi,
    fontSize: 20,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: 8,
  },
  descText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  formTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  formDesc: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 20,
    lineHeight: 18,
  },
  inputWrapper: {
    position: "relative",
    marginBottom: 16,
  },
  inputLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.textPrimary,
    fontFamily: fonts.body,
  },
  inputError: {
    borderColor: colors.error,
  },
  inputSuccess: {
    borderColor: colors.success,
  },
  inputLoader: {
    position: "absolute",
    right: 16,
    bottom: 14,
  },
  inputCheck: {
    position: "absolute",
    right: 16,
    bottom: 12,
    color: colors.success,
    fontSize: 20,
    fontFamily: fonts.bodySemi,
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    fontFamily: fonts.body,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: "100%",
    alignItems: "center",
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: 16,
    fontFamily: fonts.bodySemi,
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: "100%",
    alignItems: "center",
    marginTop: 12,
  },
  secondaryButtonText: {
    color: colors.accent,
    fontSize: 16,
    fontFamily: fonts.bodySemi,
  },
  tertiaryButton: {
    backgroundColor: "transparent",
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: "100%",
    alignItems: "center",
  },
  tertiaryButtonText: {
    color: colors.textMuted,
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    textDecorationLine: "underline",
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  orText: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: fonts.body,
    marginVertical: 16,
    textAlign: "center",
  },
  infoText: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: fonts.body,
    textAlign: "center",
    marginTop: 24,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  warningText: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: fonts.body,
    textAlign: "center",
    marginTop: 12,
    opacity: 0.7,
  },
});
