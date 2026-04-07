import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  AppStateStatus,
  Dimensions,
  PixelRatio,
  Easing,
  PermissionsAndroid,
  Image,
  Platform,
  Pressable,
  ScrollView,
  LayoutAnimation,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  useWindowDimensions,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Svg, {
  Circle,
  Defs,
  G,
  Path,
  RadialGradient,
  Stop,
} from "react-native-svg";
import SystemNavigationBar from "react-native-system-navigation-bar";
import { BlurredOrb } from "./src/BlurredOrb";
import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  Event,
  RepeatMode,
  useActiveTrack,
  useIsPlaying,
  useTrackPlayerEvents,
} from "react-native-track-player";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import {
  LevelPlayAdSize,
  LevelPlayBannerAdView,
  type LevelPlayBannerAdViewMethods,
} from "unity-levelplay-mediation";

import { AD_CONFIG, LEVELPLAY_AD_UNITS } from "./src/config";
import { stations } from "./src/stations";
import { fetchIcecastStatus, normalizeSources } from "./src/icecast";
import { UserData } from "./src/types";
import PointsDisplay from "./src/PointsDisplay";
import ShopScreen from "./src/ShopScreen";
import MenuScreen from "./src/MenuScreen";
import useListeningTracker from "./src/useListeningTracker";
import { showBanner, initializeAds } from "./src/adService";
import StarryBackground from "./src/StarryBackground";

const colors = {
  background: "#0B1014",
  backgroundAlt: "#0B1014",
  surface: "#0f1a20",
  surfaceStrong: "#12232c",
  accent: "#00E5FF",
  accentStrong: "#45a29e",
  accentSoft: "rgba(0, 229, 255, 0.2)",
  textPrimary: "#ffffff",
  textMuted: "#cfeff0",
  line: "rgba(0, 229, 255, 0.18)",
};

const fonts = {
  heading: "Inter-SemiBold", // Was 'Orbitron'
  headingAlt: "Inter-SemiBold", // Was 'Orbitron'
  body: "Inter-Regular", // Was 'Poppins-Regular'
  bodyMedium: "Inter-Regular", // Was 'Poppins-Medium' (Use Regular if you don't have Medium loaded)
  bodySemi: "Inter-SemiBold", // Was 'Poppins-SemiBold'
};

const systemFontFamily =
  Platform.select({ ios: "System", android: "sans-serif" }) ?? "System";

// Font for non-Latin text (Cyrillic, Japanese, Chinese, Korean)
// Use system font which has built-in Cyrillic support
const nonLatinFontFamily =
  Platform.select({
    ios: "System",
    android: "sans-serif",
  }) ?? "System";
const nonLatinFontFamilySemi =
  Platform.select({
    ios: "System",
    android: "sans-serif-medium",
  }) ?? "System";

const API_BASE = "https://astraradio.cz/api";
const JINGLE_TITLE = "Astra Radio";
const JINGLE_ARTWORK = "https://astraradio.cz/logo.png";
const JINGLE_TITLE_LOWER = JINGLE_TITLE.toLowerCase();
const isJingleTitle = (title?: string) =>
  title?.trim().toLowerCase() === JINGLE_TITLE_LOWER;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const BASE_WIDTH = 390; // iPhone 13/14 base
const globalScale = (size: number) => {
  const scale = SCREEN_WIDTH / BASE_WIDTH;
  const newSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

// ─── Tablet detection ─────────────────────────────────────────────────────────
// A device is treated as a tablet when its shortest side is ≥ 600 dp.
// This matches Android's "sw600dp" tablet qualifier used in Material Design.
const TABLET_BREAKPOINT = 600;
const isTabletDevice = () => Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) >= TABLET_BREAKPOINT;
// Maximum content width on tablets — keeps text and cards comfortable to read.
const TABLET_MAX_CONTENT_WIDTH = 680;

type TabKey = "player" | "news" | "playlist" | "menu";

const tabs: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: "player", label: "Přehrávač", icon: "\u{1F3B5}" },
  { key: "news", label: "Novinky", icon: "\u{1F4F0}" },
  { key: "playlist", label: "Playlist", icon: "\u{1F4DC}" },
  { key: "menu", label: "Menu", icon: "\u2630" }, // Hamburger menu icon
];

type Post = {
  slug?: string;
  title_cz?: string;
  title_en?: string;
  excerpt_cz?: string;
  excerpt_en?: string;
  content_cz?: string;
  content_en?: string;
  cover_url?: string;
  published_at?: string;
};

type HistoryItem = {
  title?: string;
  started_at?: string;
  ended_at?: string;
};

interface AppProps {
  userData: UserData | null;
  onUserDataChange: (userData: UserData) => void;
  onRequestLogin: () => void;
  onLogout: () => void;
}

function formatDate(isoDate?: string) {
  if (!isoDate) {
    return "";
  }
  try {
    return new Date(isoDate).toLocaleDateString("cs-CZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function formatTime(isoDate?: string) {
  if (!isoDate) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat("cs-CZ", {
      timeZone: "Europe/Prague",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(isoDate));
  } catch {
    return new Date(isoDate).toLocaleTimeString("cs-CZ", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}

const TZ = "Europe/Prague";
const DAY_MINUTES = 24 * 60;

function toLocalMinutes(isoDate?: string) {
  if (!isoDate) {
    return null;
  }

  try {
    const date = new Date(isoDate);
    const parts = new Intl.DateTimeFormat("cs-CZ", {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const hours = parseInt(
      parts.find((part) => part.type === "hour")?.value ?? "0",
      10,
    );
    const minutes = parseInt(
      parts.find((part) => part.type === "minute")?.value ?? "0",
      10,
    );
    return (hours * 60 + minutes) % DAY_MINUTES;
  } catch {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return (date.getHours() * 60 + date.getMinutes()) % DAY_MINUTES;
  }
}

function parseTimeToMinutes(value: string) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) {
    return null;
  }
  const [hours, minutes] = value.split(":").map(Number);
  return (hours * 60 + minutes) % DAY_MINUTES;
}

function splitRange(startMin: number, endMin: number) {
  if (endMin >= startMin) {
    return [[startMin, endMin]];
  }
  return [
    [startMin, DAY_MINUTES],
    [0, endMin],
  ];
}

function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
) {
  const rangesA = splitRange(aStart, aEnd);
  const rangesB = splitRange(bStart, bEnd);
  for (const [startA, endA] of rangesA) {
    for (const [startB, endB] of rangesB) {
      if (Math.max(startA, startB) < Math.min(endA, endB)) {
        return true;
      }
    }
  }
  return false;
}

function getLocalizedText(post: Post, field: "title" | "excerpt" | "content") {
  if (field === "title") {
    return post.title_cz || post.title_en || "";
  }
  if (field === "excerpt") {
    return post.excerpt_cz || post.excerpt_en || "";
  }
  return post.content_cz || post.content_en || "";
}

function stripHtml(value: string) {
  return value
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/(div|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const NON_LATIN_REGEX =
  /[\u0400-\u04FF\u0500-\u052F\u2DE0-\u2DFF\uA640-\uA69F\u3040-\u30FF\u31F0-\u31FF\u4E00-\u9FFF\u3400-\u4DBF\uAC00-\uD7AF]/;

function pickFontForText(value: string | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }
  if (NON_LATIN_REGEX.test(value)) {
    // Use Noto Sans for non-Latin text (Cyrillic, Japanese, Chinese, Korean)
    // Match the weight of the fallback font
    if (fallback === fonts.bodySemi) {
      return nonLatinFontFamilySemi;
    }
    return nonLatinFontFamily;
  }
  return fallback;
}

const EMBED_REGEX = /\[\[(countdown:([^\]]+)|contest-form)\]\]/gi;
const CONTEST_POST_SLUG = "soutez-astra-elektronika";
const CONTEST_DEFAULT_COUNTDOWN = "2026-01-15 23:59";

type ContentBlock =
  | { type: "text"; value: string }
  | { type: "countdown"; value: string }
  | { type: "contest-form" };

function splitParagraphs(value: string) {
  const normalized = stripHtml(value);
  if (!normalized) {
    return [];
  }
  return normalized
    .split(/\n\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function parseCountdownTarget(rawValue: string) {
  const value = String(rawValue || "").trim();
  if (!value) {
    return null;
  }

  const czMatch = value.match(
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/,
  );
  if (czMatch) {
    const day = Number(czMatch[1]);
    const month = Number(czMatch[2]) - 1;
    const year = Number(czMatch[3]);
    const hours = czMatch[4] ? Number(czMatch[4]) : 23;
    const minutes = czMatch[5] ? Number(czMatch[5]) : 59;
    return new Date(year, month, day, hours, minutes, 59);
  }

  const localDateTime = value.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/,
  );
  if (localDateTime) {
    const year = Number(localDateTime[1]);
    const month = Number(localDateTime[2]) - 1;
    const day = Number(localDateTime[3]);
    const hours = Number(localDateTime[4]);
    const minutes = Number(localDateTime[5]);
    return new Date(year, month, day, hours, minutes, 59);
  }

  const localDate = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (localDate) {
    const year = Number(localDate[1]);
    const month = Number(localDate[2]) - 1;
    const day = Number(localDate[3]);
    return new Date(year, month, day, 23, 59, 59);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function getCountdownParts(targetDate: Date | null) {
  if (!targetDate) {
    return null;
  }
  const now = Date.now();
  const diffMs = targetDate.getTime() - now;
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return {
    totalSeconds,
    days,
    hours,
    minutes,
    seconds,
    ended: diffMs <= 0,
  };
}

function createSeededRandom(seed: number) {
  let value = seed % 2147483647;
  if (value <= 0) {
    value += 2147483646;
  }
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function buildContentBlocks(content: string) {
  if (!content) {
    return [];
  }

  EMBED_REGEX.lastIndex = 0;
  const blocks: ContentBlock[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;

  while ((match = EMBED_REGEX.exec(content)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({
        type: "text",
        value: content.slice(lastIndex, match.index),
      });
    }

    const raw = match[1];
    if (raw?.startsWith("countdown:")) {
      blocks.push({ type: "countdown", value: match[2]?.trim() || "" });
    } else {
      blocks.push({ type: "contest-form" });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    blocks.push({ type: "text", value: content.slice(lastIndex) });
  }

  return blocks;
}

function App({
  userData,
  onUserDataChange,
  onRequestLogin,
  onLogout,
}: AppProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("player");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [tabBarHeight, setTabBarHeight] = useState(0);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isTablet = Math.min(width, height) >= TABLET_BREAKPOINT;
  const { playing } = useIsPlaying();

  // Use listening tracker to earn points
  const { sessionPoints } = useListeningTracker(
    playing ?? false,
    userData,
    onUserDataChange,
  );

  // Fonts moved to AppRoot.tsx
  // const [fontsLoaded] = useFonts(...)

  // Enable LayoutAnimation for Android
  if (
    Platform.OS === "android" &&
    UIManager.setLayoutAnimationEnabledExperimental
  ) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  useEffect(() => {
    StatusBar.setHidden(true, "fade");
    StatusBar.setBarStyle("light-content");
    if (isLandscape && !isTablet) {
      setTabBarHeight(0);
    }
    if (Platform.OS === "android") {
      StatusBar.setTranslucent(true);
      StatusBar.setBackgroundColor("transparent");
      SystemNavigationBar.setFitsSystemWindows(false);
      SystemNavigationBar.stickyImmersive(true);
    }
  }, [isLandscape]);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" hidden={isLandscape && !isTablet} />
      <View style={styles.container}>
        <View style={styles.backgroundWash} />
        {/* Replaced Glow/Orb with blurred SVG equivalents */}
        <BlurredOrb
          color="#003F62"
          radius={140}
          opacity={0.6}
          style={{ position: "absolute", top: -120, right: -90 }}
        />
        <BlurredOrb
          color="#003F62"
          radius={160}
          opacity={0.6}
          style={{ position: "absolute", bottom: -160, left: -120 }}
        />
        <StarryBackground />

        <SafeAreaView
          style={styles.safeArea}
          edges={(isLandscape && !isTablet) ? ["left", "right"] : ["top"]}
        >
          {showNotifications ? (
            <NotificationsScreen onBack={() => setShowNotifications(false)} />
          ) : (
            <View style={styles.appShell}>
              <View
                style={[
                  styles.contentWrapper,
                  (isLandscape && !isTablet) ? styles.contentWrapperLandscape : null,
                  isTablet ? styles.contentWrapperTablet : null,
                ]}
              >
                {activeTab === "player" && (!isLandscape || isTablet) ? (
                  <MainHeader
                    onNotificationsPress={() => setShowNotifications(true)}
                    userData={userData}
                    sessionPoints={sessionPoints}
                    onPointsPress={() => setActiveTab("menu")}
                  />
                ) : null}
                <View
                  style={[
                    styles.screenArea,
                    (isLandscape && !isTablet) ? styles.screenAreaLandscape : null,
                  ]}
                >
                  <View
                    style={[
                      styles.screen,
                      activeTab === "player"
                        ? styles.screenActive
                        : styles.screenHidden,
                    ]}
                  >
                    <PlayerScreen
                      tabBarHeight={tabBarHeight}
                      isTablet={isTablet}
                      userData={userData}
                      onUserDataChange={onUserDataChange}
                    />
                  </View>
                  <View
                    style={[
                      styles.screen,
                      activeTab === "news"
                        ? styles.screenActive
                        : styles.screenHidden,
                    ]}
                  >
                    <NewsScreen active={activeTab === "news"} />
                  </View>
                  <View
                    style={[
                      styles.screen,
                      activeTab === "playlist"
                        ? styles.screenActive
                        : styles.screenHidden,
                    ]}
                  >
                    <PlaylistScreen active={activeTab === "playlist"} />
                  </View>
                  <View
                    style={[
                      styles.screenFullWidth,
                      activeTab === "menu"
                        ? styles.screenActive
                        : styles.screenHidden,
                    ]}
                  >
                    {/* Reverted debug check - rely on userData being present */}
                    {userData ? (
                      <View style={{ flex: 1, backgroundColor: "transparent" }}>
                        <MenuScreen
                          userData={userData}
                          onNavigateToShop={() => setShowShop(true)}
                          onLogout={() => {
                            onLogout();
                            setActiveTab("player");
                          }}
                          onClose={() => setActiveTab("player")}
                          onRequestLogin={() => {
                            onRequestLogin();
                            setActiveTab("player");
                          }}
                        />
                      </View>
                    ) : (
                      <View
                        style={{
                          flex: 1,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ color: "#cfeff0", fontSize: 14 }}>
                          Načítání...
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
              {(isLandscape && !isTablet) ? null : (
                <BottomTabs
                  activeTab={activeTab}
                  onChange={setActiveTab}
                  onHeightChange={setTabBarHeight}
                  isTablet={isTablet}
                />
              )}
            </View>
          )}
        </SafeAreaView>

        {showShop && userData ? (
          <View style={styles.overlay}>
            <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
              <ShopScreen
                userData={userData}
                onUserDataChange={onUserDataChange}
                active={true}
                onClose={() => {
                  setShowShop(false);
                  setActiveTab("menu");
                }}
              />
            </SafeAreaView>
          </View>
        ) : null}
      </View>
    </SafeAreaProvider>
  );
}

function Constellation({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 1400 600">
      <Defs>
        <RadialGradient id="starDot" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#CFFEF9" stopOpacity={1} />
          <Stop offset="65%" stopColor={colors.accent} stopOpacity={0.45} />
          <Stop offset="100%" stopColor={colors.accent} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <G stroke={colors.accent} strokeLinecap="round" fill="none">
        <G opacity={0.25} strokeWidth={6}>
          <Path d="M80 200 L300 180 L520 260 L780 300" />
          <Path d="M780 300 L1250 280 L1180 520 L860 500 Z" />
        </G>
        <G opacity={0.85} strokeWidth={2.2}>
          <Path d="M80 200 L300 180 L520 260 L780 300" />
          <Path d="M780 300 L1250 280 L1180 520 L860 500 Z" />
        </G>
      </G>
      <G opacity={0.95}>
        <Circle cx="80" cy="200" r="10" fill="url(#starDot)" />
        <Circle cx="300" cy="180" r="10" fill="url(#starDot)" />
        <Circle cx="520" cy="260" r="10" fill="url(#starDot)" />
        <Circle cx="780" cy="300" r="11" fill="url(#starDot)" />
        <Circle cx="1250" cy="280" r="11" fill="url(#starDot)" />
        <Circle cx="1180" cy="520" r="11" fill="url(#starDot)" />
        <Circle cx="860" cy="500" r="11" fill="url(#starDot)" />
      </G>
    </Svg>
  );
}

// ... (start of file imports if needed, but we can use require inside component)

function MainHeader({
  onNotificationsPress,
  userData,
  sessionPoints,
  onPointsPress,
}: {
  onNotificationsPress: () => void;
  userData: UserData | null;
  sessionPoints: number;
  onPointsPress: () => void;
}) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.brand}>ASTRA RADIO</Text>
        <Text style={styles.tagline}>Na druhé straně vlny</Text>
      </View>
      <View style={styles.headerRight}>
        <PointsDisplay
          userData={userData}
          sessionPoints={sessionPoints}
          onPress={onPointsPress}
        />
      </View>
    </View>
  );
}

function NotificationButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.notificationButton,
        pressed ? styles.notificationButtonPressed : null,
      ]}
    >
      <Image
        source={require("./assets/bell.png")}
        style={{ width: 22, height: 22, tintColor: colors.accent }}
        resizeMode="contain"
      />
    </Pressable>
  );
}

function BottomTabs({
  activeTab,
  onChange,
  onHeightChange,
  isTablet = false,
}: {
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
  onHeightChange?: (height: number) => void;
  isTablet?: boolean;
}) {
  const indicatorAnim = useRef(new Animated.Value(0)).current;

  const tabIndex = useMemo(
    () => tabs.findIndex((t) => t.key === activeTab),
    [activeTab],
  );

  useEffect(() => {
    Animated.spring(indicatorAnim, {
      toValue: tabIndex,
      useNativeDriver: true,
      tension: 60,
      friction: 10,
    }).start();
  }, [tabIndex, indicatorAnim]);

  // Calculations based on styles:
  // TabBar width: 302, PaddingH: 18.5 => ContentWidth: 265
  // TabItem width: 48. 4 tabs with justifyContent: 'space-between'
  // Center positions: 24, 96.33, 168.66, 241 (relative to 265 wide content)
  // Interval: 72.33px
  const STEP = 72.33;
  const translateX = indicatorAnim.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: [0, STEP, STEP * 2, STEP * 3],
  });

  const handleTabPress = (tab: TabKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onChange(tab);
  };

  return (
    <BlurView
      style={[styles.tabBar, isTablet ? styles.tabBarTablet : null]}
      intensity={80}
      tint="dark"
      onLayout={
        onHeightChange
          ? (event) =>
              onHeightChange(Math.round(event.nativeEvent.layout.height))
          : undefined
      }
    >
      <LinearGradient
        colors={["rgba(84, 198, 240, 0.13)", "rgba(84, 198, 240, 0.05)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        style={[
          styles.tabItemActiveBackground,
          {
            position: "absolute",
            left: 18.5 + 24 - 38, // PaddingH + (ItemWidth/2) - (IndicatorWidth/2)
            transform: [{ translateX }],
          },
        ]}
      >
        <BlurView style={StyleSheet.absoluteFill} intensity={60} tint="dark" />
        <LinearGradient
          colors={["rgba(64, 80, 87, 0.55)", "rgba(64, 80, 87, 0.25)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      {tabs.map((tab, index) => {
        const isActive = activeTab === tab.key;
        const iconColor = isActive ? "#00E5FF" : colors.textMuted;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="button"
            onPress={() => handleTabPress(tab.key)}
            style={({ pressed }) => [
              styles.tabItem,
              isTablet ? styles.tabItemTablet : null,
              pressed ? styles.tabItemPressed : null,
            ]}
          >
            <View style={styles.tabIconWrap}>
              <TabIcon type={tab.key} color={iconColor} />
            </View>
            <Text
              style={[styles.tabLabel, isActive ? styles.tabLabelActive : null]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </BlurView>
  );
}

function TabIcon({ type, color }: { type: TabKey; color: string }) {
  let source;

  switch (type) {
    case "player":
      source = require("./assets/play.png");
      break;
    case "news":
      source = require("./assets/news.png");
      break;
    case "playlist":
      source = require("./assets/playlist.png");
      break;
    case "menu":
      source = require("./assets/menu.png");
      break;
    default:
      return null;
  }

  const size = type === "menu" ? 22 : 24;

  return (
    <Image
      source={source}
      style={{ width: size, height: size, tintColor: color }}
      resizeMode="contain"
    />
  );
}

type ContestPlatform = "instagram" | "facebook";

function CountdownBlock({ target }: { target?: string }) {
  const targetDate = useMemo(
    () => parseCountdownTarget(target ?? ""),
    [target],
  );
  const [parts, setParts] = useState(() => getCountdownParts(targetDate));

  useEffect(() => {
    if (!targetDate) {
      setParts(null);
      return;
    }

    const tick = () => setParts(getCountdownParts(targetDate));
    tick();
    const interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  if (!targetDate || !parts) {
    return null;
  }

  const targetLabel = new Intl.DateTimeFormat("cs-CZ", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(targetDate);

  const formatUnit = (value: number) => String(value).padStart(2, "0");

  return (
    <View style={styles.countdownCard}>
      <Text style={styles.countdownTitle}>Odpočet</Text>
      <Text style={styles.countdownTarget}>Do {targetLabel}</Text>
      {parts.ended ? (
        <Text style={styles.countdownEnded}>Odpočet ukončen</Text>
      ) : (
        <View style={styles.countdownGrid}>
          <View style={styles.countdownItem}>
            <Text style={styles.countdownValue}>{parts.days}</Text>
            <Text style={styles.countdownLabel}>dny</Text>
          </View>
          <View style={styles.countdownItem}>
            <Text style={styles.countdownValue}>{formatUnit(parts.hours)}</Text>
            <Text style={styles.countdownLabel}>hod</Text>
          </View>
          <View style={styles.countdownItem}>
            <Text style={styles.countdownValue}>
              {formatUnit(parts.minutes)}
            </Text>
            <Text style={styles.countdownLabel}>min</Text>
          </View>
          <View style={styles.countdownItem}>
            <Text style={styles.countdownValue}>
              {formatUnit(parts.seconds)}
            </Text>
            <Text style={styles.countdownLabel}>sek</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function ContestForm({ postSlug }: { postSlug?: string }) {
  const [email, setEmail] = useState("");
  const [handle, setHandle] = useState("");
  const [platform, setPlatform] = useState<ContestPlatform | null>(null);
  const [status, setStatus] = useState<
    "idle" | "sending" | "success" | "error"
  >("idle");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    setEmail("");
    setHandle("");
    setPlatform(null);
    setStatus("idle");
    setStatusMessage("");
  }, [postSlug]);

  const lastInputRef = useRef({
    email: "",
    handle: "",
    platform: null as ContestPlatform | null,
  });

  useEffect(() => {
    const last = lastInputRef.current;
    const changed =
      last.email !== email ||
      last.handle !== handle ||
      last.platform !== platform;

    if (changed && status !== "idle" && status !== "sending") {
      setStatus("idle");
      setStatusMessage("");
    }

    lastInputRef.current = { email, handle, platform };
  }, [email, handle, platform, status]);

  const canSubmit =
    status !== "sending" && Boolean(email.trim() && handle.trim() && platform);

  const handleSubmit = useCallback(async () => {
    const trimmedEmail = email.trim();
    const trimmedHandle = handle.trim();

    if (!trimmedEmail || !trimmedHandle || !platform) {
      setStatus("error");
      setStatusMessage("Vyplňte e-mail, uživatelské jméno a platformu.");
      return;
    }

    setStatus("sending");
    setStatusMessage("");

    try {
      const response = await fetch(`${API_BASE}/contest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          handle: trimmedHandle,
          platform,
          post_slug: postSlug ?? "",
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload?.error || "Odeslání se nezdařilo. Zkuste to prosím znovu.",
        );
      }

      setStatus("success");
      setStatusMessage("Formulář byl odeslán. Děkujeme!");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Odeslání se nezdařilo. Zkuste to prosím znovu.";
      setStatus("error");
      setStatusMessage(message);
    }
  }, [email, handle, platform, postSlug]);

  return (
    <View style={styles.contestCard}>
      <Text style={styles.contestTitle}>Soutěžní formulář</Text>
      <Text style={styles.contestNote}>
        Vyplňte e-mail a uživatelské jméno, které jste použili na Instagramu
        nebo Facebooku.
      </Text>

      <View style={styles.contestField}>
        <Text style={styles.contestLabel}>E-mail</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="vas@email.cz"
          placeholderTextColor="rgba(207, 239, 240, 0.5)"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          style={styles.contestInput}
        />
      </View>

      <View style={styles.contestField}>
        <Text style={styles.contestLabel}>
          Uživatelské jméno (Instagram/Facebook)
        </Text>
        <TextInput
          value={handle}
          onChangeText={setHandle}
          placeholder="@astra.radio"
          placeholderTextColor="rgba(207, 239, 240, 0.5)"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.contestInput}
        />
      </View>

      <View style={styles.contestField}>
        <Text style={styles.contestLabel}>Platforma</Text>
        <View style={styles.contestPlatformRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setPlatform("instagram")}
            style={({ pressed }) => [
              styles.contestPlatformBtn,
              platform === "instagram" ? styles.contestPlatformBtnActive : null,
              pressed ? styles.contestPlatformBtnPressed : null,
            ]}
          >
            <Text
              style={[
                styles.contestPlatformText,
                platform === "instagram"
                  ? styles.contestPlatformTextActive
                  : null,
              ]}
            >
              Instagram
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setPlatform("facebook")}
            style={({ pressed }) => [
              styles.contestPlatformBtn,
              platform === "facebook" ? styles.contestPlatformBtnActive : null,
              pressed ? styles.contestPlatformBtnPressed : null,
            ]}
          >
            <Text
              style={[
                styles.contestPlatformText,
                platform === "facebook"
                  ? styles.contestPlatformTextActive
                  : null,
              ]}
            >
              Facebook
            </Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={!canSubmit}
        onPress={handleSubmit}
        style={({ pressed }) => [
          styles.contestSubmit,
          !canSubmit ? styles.contestSubmitDisabled : null,
          pressed ? styles.contestSubmitPressed : null,
        ]}
      >
        <Text style={styles.contestSubmitText}>
          {status === "sending" ? "OdesÃ­lÃ¡m..." : "Odeslat"}
        </Text>
      </Pressable>

      {statusMessage ? (
        <Text
          style={[
            styles.contestStatus,
            status === "success"
              ? styles.contestStatusOk
              : styles.contestStatusError,
          ]}
        >
          {statusMessage}
        </Text>
      ) : null}
    </View>
  );
}

function NewsScreen({ active }: { active: boolean }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    if (!active) {
      return;
    }

    let cancelled = false;

    const loadPosts = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE}/posts?limit=20`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        if (!cancelled) {
          setPosts(Array.isArray(payload) ? payload : []);
        }
      } catch {
        if (!cancelled) {
          setError("Nepodařilo se načíst novinky.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPosts();

    return () => {
      cancelled = true;
    };
  }, [active]);

  const handleOpenPost = useCallback(async (post: Post) => {
    if (!post.slug) {
      return;
    }

    setDetailLoading(true);
    setDetailError("");
    setSelectedPost(null);

    try {
      const response = await fetch(
        `${API_BASE}/posts/${encodeURIComponent(post.slug)}`,
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      setSelectedPost(payload);
    } catch {
      setDetailError("Nepodařilo se načíst článek.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleClosePost = useCallback(() => {
    setSelectedPost(null);
    setDetailError("");
  }, []);

  const contentBlocks = useMemo(() => {
    if (!selectedPost) {
      return [];
    }

    const contentRaw = getLocalizedText(selectedPost, "content");
    const baseBlocks = buildContentBlocks(contentRaw);

    if (selectedPost.slug !== CONTEST_POST_SLUG) {
      return baseBlocks;
    }

    const hasCountdown = baseBlocks.some((block) => block.type === "countdown");
    const hasContestForm = baseBlocks.some(
      (block) => block.type === "contest-form",
    );

    const mergedBlocks = [...baseBlocks];

    if (!hasCountdown) {
      mergedBlocks.push({
        type: "countdown",
        value: CONTEST_DEFAULT_COUNTDOWN,
      });
    }

    if (!hasContestForm) {
      mergedBlocks.push({ type: "contest-form" });
    }

    return mergedBlocks;
  }, [selectedPost]);

  if (detailLoading || detailError || selectedPost) {
    const title = selectedPost ? getLocalizedText(selectedPost, "title") : "";
    const published = selectedPost?.published_at
      ? formatDate(selectedPost.published_at)
      : "";

    return (
      <ScrollView
        contentContainerStyle={styles.screenContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.detailHeader}>
          <Pressable
            accessibilityRole="button"
            onPress={handleClosePost}
            style={({ pressed }) => [
              styles.backButton,
              pressed ? styles.backButtonPressed : null,
            ]}
          >
            <Text style={styles.backIcon}>{"\u2190"}</Text>
          </Pressable>
          <Text style={styles.detailHeaderTitle}>Novinky</Text>
          <View style={styles.headerSpacer} />
        </View>

        {detailLoading ? (
          <ActivityIndicator color={colors.accent} style={styles.loading} />
        ) : null}
        {detailError ? (
          <Text style={styles.errorText}>{detailError}</Text>
        ) : null}
        {selectedPost ? (
          <View style={styles.detailCard}>
            {selectedPost.cover_url ? (
              <Image
                source={{ uri: selectedPost.cover_url }}
                style={styles.detailImage}
              />
            ) : null}
            <Text style={styles.detailTitle}>{title}</Text>
            {published ? (
              <Text style={styles.detailMeta}>{published}</Text>
            ) : null}
            {contentBlocks.map((block, blockIndex) => {
              if (block.type === "text") {
                const paragraphs = splitParagraphs(block.value);
                if (!paragraphs.length) {
                  return null;
                }

                return (
                  <View key={`text-${blockIndex}`}>
                    {paragraphs.map((paragraph, paragraphIndex) => (
                      <Text
                        key={`paragraph-${blockIndex}-${paragraphIndex}`}
                        style={styles.detailParagraph}
                      >
                        {paragraph}
                      </Text>
                    ))}
                  </View>
                );
              }

              if (block.type === "countdown") {
                return (
                  <CountdownBlock
                    key={`countdown-${blockIndex}`}
                    target={block.value}
                  />
                );
              }

              return (
                <ContestForm
                  key={`contest-${blockIndex}`}
                  postSlug={selectedPost.slug}
                />
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.screenContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.screenTitle}>Novinky</Text>
      {loading ? (
        <ActivityIndicator color={colors.accent} style={styles.loading} />
      ) : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!loading && !error && posts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Zatím žádné novinky</Text>
          <Text style={styles.emptySubtitle}>
            Jakmile něco zveřejníme, uvidíte to tady.
          </Text>
        </View>
      ) : null}
      {posts.map((post, index) => {
        const title = getLocalizedText(post, "title");
        const excerpt = getLocalizedText(post, "excerpt");
        const published = formatDate(post.published_at);
        return (
          <Pressable
            key={post.slug ?? `${index}`}
            accessibilityRole="button"
            onPress={() => handleOpenPost(post)}
            style={({ pressed }) => [
              styles.newsCard,
              pressed ? styles.newsCardPressed : null,
            ]}
          >
            {post.cover_url ? (
              <Image
                source={{ uri: post.cover_url }}
                style={styles.newsImage}
              />
            ) : (
              <View style={styles.newsImagePlaceholder} />
            )}
            <View style={styles.newsContent}>
              <Text style={styles.newsTitle} numberOfLines={2}>
                {title}
              </Text>
              <Text style={styles.newsExcerpt} numberOfLines={3}>
                {excerpt}
              </Text>
              {published ? (
                <Text style={styles.newsMeta}>{published}</Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function PlaylistScreen({ active }: { active: boolean }) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");
  const [showBannerAd, setShowBannerAd] = useState(false);
  const bannerAdViewRef = useRef<LevelPlayBannerAdViewMethods>(null);
  const bannerLoadStarted = useRef(false);
  const bannerAdSize = LevelPlayAdSize.BANNER;
  const bannerAdUnitId = LEVELPLAY_AD_UNITS.banner;
  const bannerDebug = AD_CONFIG.debugBanner;
  const [bannerError, setBannerError] = useState<string | null>(null);
  const bannerListener = useMemo(
    () => ({
      onAdLoaded: (adInfo: any) => {
        console.log("[LevelPlay][Banner] loaded", adInfo);
        setBannerError(null);
      },
      onAdLoadFailed: (error: any) => {
        console.warn("[LevelPlay][Banner] load failed", error);
        setBannerError(`Chyba: ${error.message || JSON.stringify(error)}`);
        bannerLoadStarted.current = false;
      },
      onAdDisplayed: (adInfo: any) => {
        console.log("[LevelPlay][Banner] displayed", adInfo);
      },
      onAdDisplayFailed: (adInfo: any, error: any) => {
        console.warn("[LevelPlay][Banner] display failed", { adInfo, error });
        setBannerError(`Display Error: ${error.message || "Unknown"}`);
      },
      onAdClicked: (adInfo: any) => {
        console.log("[LevelPlay][Banner] clicked", adInfo);
      },
    }),
    [],
  );

  const [isAdSdkInitialized, setIsAdSdkInitialized] = useState(false);

  const loadBannerAd = useCallback(async () => {
    // Prevent multiple calls
    if (bannerLoadStarted.current) return;
    bannerLoadStarted.current = true;

    // Ensure SDK is initialized
    console.log("[LevelPlay][Banner] ensuring SDK init...");
    const initialized = await initializeAds();
    setIsAdSdkInitialized(initialized);

    // If failed, show error
    if (!initialized) {
      setBannerError("SDK Init Failed");
    }
  }, []);

  useEffect(() => {
    if (!active) {
      return;
    }

    let cancelled = false;

    const loadHistory = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE}/history?limit=120`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        if (!cancelled) {
          setItems(Array.isArray(payload) ? payload : []);
        }
      } catch {
        if (!cancelled) {
          setError("Nepodařilo se načíst playlist.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [active]);

  useEffect(() => {
    if (!active) {
      setShowBannerAd(false);
      return;
    }

    let cancelled = false;

    showBanner()
      .then((shouldShow) => {
        if (!cancelled) {
          if (bannerDebug) {
            console.log("[LevelPlay][Banner] showBanner result", shouldShow);
          }
          setShowBannerAd(shouldShow);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          if (bannerDebug) {
            console.warn("[LevelPlay][Banner] showBanner error", error);
          }
          setShowBannerAd(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [active, bannerDebug]);

  const filteredItems = useMemo(() => {
    const query = filterQuery.trim().toLowerCase();
    const fromMin = parseTimeToMinutes(timeFrom);
    const toMin = parseTimeToMinutes(timeTo);
    const useTimeFilter = fromMin != null && toMin != null;

    return items.filter((item) => {
      const title = (item.title ?? "").toString();
      if (query && !title.toLowerCase().includes(query)) {
        return false;
      }

      if (useTimeFilter) {
        const startMin = toLocalMinutes(item.started_at);
        const endMin =
          toLocalMinutes(item.ended_at) ??
          (startMin != null ? (startMin + 1) % DAY_MINUTES : null);

        if (startMin == null || endMin == null) {
          return false;
        }

        if (!rangesOverlap(startMin, endMin, fromMin, toMin)) {
          return false;
        }
      }

      return true;
    });
  }, [filterQuery, items, timeFrom, timeTo]);

  const handleResetFilters = useCallback(() => {
    setFilterQuery("");
    setTimeFrom("");
    setTimeTo("");
  }, []);

  const shouldRenderBanner = showBannerAd || bannerDebug;

  return (
    <ScrollView
      contentContainerStyle={styles.screenContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.screenTitle}>Playlist</Text>

      <View style={styles.filterBar}>
        <TextInput
          value={filterQuery}
          onChangeText={setFilterQuery}
          placeholder="Hledej skladbu"
          placeholderTextColor="rgba(207, 239, 240, 0.5)"
          style={styles.filterInput}
        />
        <View style={styles.filterRow}>
          <TextInput
            value={timeFrom}
            onChangeText={setTimeFrom}
            placeholder="Od 08:00"
            placeholderTextColor="rgba(207, 239, 240, 0.5)"
            style={[styles.filterInput, styles.filterInputSmall]}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
          <TextInput
            value={timeTo}
            onChangeText={setTimeTo}
            placeholder="Do 18:00"
            placeholderTextColor="rgba(207, 239, 240, 0.5)"
            style={[styles.filterInput, styles.filterInputSmall]}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
          <Pressable
            accessibilityRole="button"
            onPress={handleResetFilters}
            style={({ pressed }) => [
              styles.filterReset,
              pressed ? styles.filterResetPressed : null,
            ]}
          >
            <Text style={styles.filterResetText}>Reset</Text>
          </Pressable>
        </View>
      </View>

      {/* Trigger init check on mount */}
      <View onLayout={loadBannerAd} />

      {shouldRenderBanner && isAdSdkInitialized ? (
        bannerAdUnitId ? (
          <View style={styles.bannerAdContainer}>
            <LevelPlayBannerAdView
              ref={bannerAdViewRef}
              adUnitId={bannerAdUnitId}
              adSize={bannerAdSize}
              placementName="DefaultBanner"
              listener={bannerListener}
              style={{
                width: bannerAdSize.width,
                height: bannerAdSize.height,
                alignSelf: "center",
              }}
              onLayout={() => {
                // Load ad once the view is mounted (which happens after init)
                bannerAdViewRef.current?.loadAd();
              }}
            />
            {/* Error text suppressed as per request */}
          </View>
        ) : (
          <View style={styles.bannerAdContainer}>
            <Text style={styles.bannerAdText}>📢 Banner Ad Space</Text>
            <Text style={styles.bannerAdSubtext}>
              Unity LevelPlay banner will load here
            </Text>
          </View>
        )
      ) : null}
      {loading ? (
        <ActivityIndicator color={colors.accent} style={styles.loading} />
      ) : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!loading && !error && filteredItems.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>
            {filterQuery || timeFrom || timeTo
              ? "Nic nenalezeno"
              : "Žádné skladby"}
          </Text>
          <Text style={styles.emptySubtitle}>
            Jakmile začne hrát hudba, zobrazíme ji tady.
          </Text>
        </View>
      ) : null}
      {filteredItems.map((item, index) => (
        <View
          key={`${item.started_at ?? "track"}-${index}`}
          style={styles.listCard}
        >
          <Text style={styles.listTime}>
            {formatTime(item.started_at) || "--:--"}
          </Text>
          <Text style={styles.listTitle} numberOfLines={1}>
            {item.title || "â€”"}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

function NotificationsScreen({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.notificationsScreen}>
      <View style={styles.notificationsHeader}>
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={({ pressed }) => [
            styles.backButton,
            pressed ? styles.backButtonPressed : null,
          ]}
        >
          <Text style={styles.backIcon}>{"\u2190"}</Text>
        </Pressable>
        <Text style={styles.notificationsTitle}>Notifikace</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.notificationsBody}>
        <Text style={styles.emptyTitle}>Zatím žádné notifikace</Text>
        <Text style={styles.emptySubtitle}>
          Jakmile něco pošleme, uvidíte to tady.
        </Text>
      </View>
    </View>
  );
}

function ContactScreen() {
  return (
    <ScrollView
      contentContainerStyle={styles.screenContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.screenTitle}>Kontakt</Text>
      <View style={styles.contactCard}>
        <Text style={styles.contactLabel}>Provozovatel</Text>
        <Text style={styles.contactName}>OTS Outside The System s.r.o.</Text>
        <Text style={styles.contactText}>Dobrovského 874/29, Přívoz</Text>
        <Text style={styles.contactText}>702 00 Ostrava</Text>
        <Text style={styles.contactText}>Česká republika</Text>
        <View style={styles.contactDivider} />
        <Text style={styles.contactText}>info@astraradio.cz</Text>
        <Text style={styles.contactText}>web astraradio.cz</Text>
      </View>
    </ScrollView>
  );
}

function PlayerScreen({
  tabBarHeight,
  isTablet,
  userData,
  onUserDataChange,
}: {
  tabBarHeight?: number;
  isTablet?: boolean;
  userData?: UserData | null;
  onUserDataChange?: (userData: UserData) => void;
}) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const portraitScale = isLandscape
    ? 1
    : Math.min(1.05, Math.max(0.82, Math.min(width / 390, height / 860)));
  const useCompactLayout = !isLandscape && portraitScale < 0.95;
  const isCompact = !isLandscape && height < 700;
  const scale = isLandscape ? 1 : portraitScale;
  const artworkSize = Math.round(
    (isLandscape ? 110 : isCompact ? 110 : 120) * scale,
  );
  const titleSize = Math.round((isLandscape ? 18 : 16) * scale); // 16px base
  const artistSize = Math.round((isLandscape ? 12 : 10) * scale); // 10px base
  const playButtonSize = Math.round((isLandscape ? 64 : 84) * scale); // Increased from 76
  const waveRingSize = Math.round((isLandscape ? 132 : 156) * scale);
  const waveScale = isLandscape ? 1 : scale;
  const cardPadding = Math.round(20 * scale);
  const cardRadius = Math.round(24 * scale);
  const cardMarginTop = Math.round(12 * scale);
  const labelMarginBottom = Math.round(12 * scale);
  const artworkMarginBottom = Math.round(16 * scale);
  const artworkRadius = Math.round(22 * scale);
  const trackMarginTop = Math.round(6 * scale);
  const statusMarginTop = Math.round(14 * scale);
  const controlsMargin = Math.round(16 * scale);
  const qualityGap = Math.round(24 * scale);
  const qualityPadY = Math.round(14 * scale);
  const qualityRadius = Math.round(22 * scale);
  const qualityValueSize = Math.round(14 * scale); // Increased from 12
  const qualityUnitSize = Math.round(11 * scale); // Increased from 10
  const qualityCardHeight = Math.round(64 * scale); // Increased from 56
  const contentGap = Math.round((useCompactLayout ? 8 : 14) * scale);
  const baseTabBarHeight = isLandscape ? 64 : 38; // 38px Portrait
  const resolvedTabBarHeight = Math.max(tabBarHeight ?? 0, baseTabBarHeight);
  const contentPaddingBottom = (isLandscape && !isTablet)
    ? 0
    : Math.max(20, (tabBarHeight ?? 105) - (isCompact ? 10 : 0)); // Ensure clearance for navbar
  const waveRadius = waveRingSize / 2 - 10;
  const waveBarCount = 24;
  const landscapeMaxWidth = Math.min(width - 48, Math.round(width * 0.85));
  const leftColumnMaxWidth = Math.round(landscapeMaxWidth * 0.52);
  const rightColumnWidth = Math.round(landscapeMaxWidth * 0.38);
  const constellationWidth = Math.min(width * (isLandscape ? 1.1 : 1.25), 760);
  const constellationHeight = Math.round(constellationWidth * 0.43);
  const constellationLeft = Math.round((width - constellationWidth) / 2);
  const constellationTop = isLandscape ? -14 : -2;
  const pauseBarHeight = Math.max(16, Math.round(playButtonSize * 0.38));
  const pauseBarWidth = Math.max(5, Math.round(playButtonSize * 0.12));
  const pauseGap = Math.max(6, Math.round(playButtonSize * 0.08));
  const triangleHeight = Math.max(18, Math.round(playButtonSize * 0.4));
  const triangleWidth = Math.max(14, Math.round(playButtonSize * 0.3));
  const triangleOffset = Math.round(playButtonSize * 0.05);

  const [isReady, setIsReady] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [artworkLoading, setArtworkLoading] = useState(false);
  const [adRewardLoading, setAdRewardLoading] = useState(false);
  const [liveMetadata, setLiveMetadata] = useState<{
    title?: string;
    artist?: string;
    artwork?: string;
  } | null>(null);
  const waveSeedRef = useRef(Math.floor(Math.random() * 1000000));
  const setupRef = useRef(false);
  const artworkCacheRef = useRef(new Map<string, string | null>());
  const artworkFetchRef = useRef<string | null>(null);
  const liveMetadataRef = useRef<typeof liveMetadata>(null);
  const lastIcecastTitleRef = useRef<string | null>(null);
  const icecastCancelledRef = useRef(false);
  const waveBars = useMemo(
    () =>
      Array.from({ length: waveBarCount }, (_, index) => {
        const rand = createSeededRandom(waveSeedRef.current * 97 + index + 1);
        const randomValue = (min: number, max: number) =>
          min + (max - min) * rand();
        const jitter = randomValue(-6, 6);
        const progress = index / waveBarCount;
        const baseHeight = Math.round(randomValue(18, 44));
        const thickness = Math.round(randomValue(4, 6));
        const maxScale = randomValue(0.8, 1.2);
        const fillOpacity = randomValue(0.75, 1);
        const delay = Math.round(randomValue(0, 120));
        const duration = Math.round(randomValue(500, 900));
        const rest = Math.round(randomValue(60, 140));
        const offset = randomValue(0.68, 0.76);

        return {
          index,
          angle: progress * 360 + jitter,
          baseHeight,
          thickness,
          offset,
          maxScale,
          fillOpacity,
          delay,
          duration,
          rest,
        };
      }),
    [waveBarCount],
  );
  const waveAnims = useRef(
    Array.from({ length: waveBarCount }, () => new Animated.Value(0)),
  );
  const activeTrack = useActiveTrack();
  const { playing, bufferingDuringPlay } = useIsPlaying();

  useEffect(() => {
    let isMounted = true;

    const setup = async () => {
      if (setupRef.current) {
        return;
      }

      setupRef.current = true;

      try {
        await TrackPlayer.setupPlayer();
        if (Capability) {
          await TrackPlayer.updateOptions({
            android: {
              appKilledPlaybackBehavior:
                AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
            },
            capabilities: [
              Capability.Play,
              Capability.Pause,
              Capability.Stop,
              Capability.SkipToNext,
              Capability.SkipToPrevious,
            ],
            compactCapabilities: [
              Capability.Play,
              Capability.Pause,
              Capability.SkipToNext,
            ],
          });
        }

        await TrackPlayer.setRepeatMode(RepeatMode.Queue);
        await TrackPlayer.add(
          stations.map((station) => ({
            id: station.id,
            url: station.streamUrl,
            title: station.title,
            artist: station.artist,
            artwork: station.artwork,
          })),
        );

        // Set default quality to 128 kbps (index 1)
        await TrackPlayer.skip(1);

        // Initialize Unity LevelPlay ads with the real user ID for accurate tracking
        const { initializeAds } = await import("./src/adService");
        initializeAds(userData?.nick ?? undefined).catch((error) => {
          console.warn("[App] Failed to initialize ads:", error);
        });

        if (isMounted) {
          setIsReady(true);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.toLowerCase().includes("already been initialized")) {
          if (isMounted) {
            setIsReady(true);
          }
          return;
        }

        console.warn("TrackPlayer setup failed", error);
        if (isMounted) {
          setSetupError("Unable to initialize the audio engine.");
        }
      }
    };

    setup();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android" || Platform.Version < 33) {
      return;
    }

    PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
  }, []);

  const activeStation = useMemo(() => {
    if (!activeTrack) {
      return undefined;
    }

    return stations.find((station) => station.id === activeTrack.id);
  }, [activeTrack]);

  useEffect(() => {
    setLiveMetadata(null);
  }, [activeTrack?.id]);

  useEffect(() => {
    liveMetadataRef.current = liveMetadata;
  }, [liveMetadata]);

  useEffect(() => {
    icecastCancelledRef.current = false;
    return () => {
      icecastCancelledRef.current = true;
    };
  }, []);

  const parseMetadata = useCallback((titleRaw?: string, artistRaw?: string) => {
    let title = titleRaw?.trim() || undefined;
    let artist = artistRaw?.trim() || undefined;

    if (!artist && title && title.includes(" - ")) {
      const parts = title.split(" - ");
      if (parts.length >= 2) {
        artist = parts[0].trim();
        title = parts.slice(1).join(" - ").trim();
      }
    }

    return { title, artist };
  }, []);

  const applyMetadata = useCallback(
    (metadata: { title?: string; artist?: string; artwork?: string }) => {
      void TrackPlayer.getActiveTrackIndex().then((index) => {
        if (index == null) {
          return;
        }

        TrackPlayer.updateMetadataForTrack(index, metadata);
      });
    },
    [],
  );

  const fetchArtworkForTrack = useCallback(
    async (artist?: string, title?: string) => {
      const normalizedTitle = title?.trim();
      const normalizedArtist = artist?.trim();

      if (isJingleTitle(normalizedTitle)) {
        const resolvedTitle = normalizedTitle ?? JINGLE_TITLE;
        const resolvedArtist = normalizedArtist ?? JINGLE_TITLE;
        setLiveMetadata((current) => ({
          ...(current ?? {}),
          title: resolvedTitle,
          artist: resolvedArtist,
          artwork: JINGLE_ARTWORK,
        }));
        applyMetadata({
          title: resolvedTitle,
          artist: resolvedArtist,
          artwork: JINGLE_ARTWORK,
        });
        return;
      }

      if (!normalizedArtist || !normalizedTitle) {
        return;
      }

      const key = `${normalizedArtist} - ${normalizedTitle}`.toLowerCase();
      if (artworkCacheRef.current.has(key)) {
        const cachedArtwork = artworkCacheRef.current.get(key);
        if (cachedArtwork) {
          setLiveMetadata((current) => ({
            ...(current ?? {}),
            title: normalizedTitle,
            artist: normalizedArtist,
            artwork: cachedArtwork,
          }));
          applyMetadata({
            title: normalizedTitle,
            artist: normalizedArtist,
            artwork: cachedArtwork,
          });
        }
        return;
      }

      if (artworkFetchRef.current === key) {
        return;
      }

      artworkFetchRef.current = key;

      try {
        const term = encodeURIComponent(
          `${normalizedArtist} ${normalizedTitle}`,
        );
        const response = await fetch(
          `https://itunes.apple.com/search?term=${term}&entity=song&limit=1`,
        );
        if (!response.ok) {
          return;
        }

        const payload = await response.json();
        const artworkUrl = payload?.results?.[0]?.artworkUrl100;
        if (typeof artworkUrl !== "string" || !artworkUrl.length) {
          artworkCacheRef.current.set(key, null);
          return;
        }

        const highResArtwork = artworkUrl.replace("100x100bb", "600x600bb");
        artworkCacheRef.current.set(key, highResArtwork);
        setLiveMetadata((current) => ({
          ...(current ?? {}),
          title: normalizedTitle,
          artist: normalizedArtist,
          artwork: highResArtwork,
        }));
        applyMetadata({
          title: normalizedTitle,
          artist: normalizedArtist,
          artwork: highResArtwork,
        });
      } catch (error) {
        console.warn("Artwork lookup failed", error);
      } finally {
        if (artworkFetchRef.current === key) {
          artworkFetchRef.current = null;
        }
      }
    },
    [applyMetadata],
  );

  const refreshIcecast = useCallback(async () => {
    if (!activeStation || icecastCancelledRef.current) {
      return;
    }

    const mount = activeStation.mount ?? "astra";

    try {
      const payload = await fetchIcecastStatus();
      if (!payload || icecastCancelledRef.current) {
        return;
      }

      const sources = normalizeSources(payload.icestats?.source);

      if (!sources.length) {
        return;
      }

      const match =
        sources.find((source) => {
          const listenurl = (source?.listenurl ?? "").toString();
          return listenurl.includes(`/${mount}`);
        }) ?? sources[0];

      const titleLine =
        typeof match?.title === "string" ? match.title.trim() : "";
      if (!titleLine) {
        return;
      }

      if (lastIcecastTitleRef.current === titleLine) {
        return;
      }

      lastIcecastTitleRef.current = titleLine;
      const { title, artist } = parseMetadata(titleLine);

      if (!title && !artist) {
        return;
      }

      if (icecastCancelledRef.current) {
        return;
      }

      const resolvedTitle = title ?? activeStation.title;
      const resolvedArtist = artist ?? activeStation.artist;
      const isJingle = isJingleTitle(resolvedTitle);
      const resolvedArtwork = isJingle ? JINGLE_ARTWORK : activeStation.artwork;

      setLiveMetadata((current) => ({
        ...(current ?? {}),
        title: resolvedTitle,
        artist: resolvedArtist,
        artwork: isJingle ? JINGLE_ARTWORK : undefined,
      }));

      applyMetadata({
        title: resolvedTitle,
        artist: resolvedArtist,
        artwork: resolvedArtwork,
      });

      if (!isJingle) {
        void fetchArtworkForTrack(resolvedArtist, resolvedTitle);
      }
    } catch (error) {
      console.warn("Icecast metadata fetch failed", error);
    }
  }, [activeStation, applyMetadata, fetchArtworkForTrack, parseMetadata]);

  useEffect(() => {
    if (!activeStation) {
      return;
    }

    void refreshIcecast();
    const interval = setInterval(() => {
      void refreshIcecast();
    }, 15000);

    return () => {
      clearInterval(interval);
    };
  }, [activeStation, refreshIcecast]);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        void refreshIcecast();
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );
    return () => subscription.remove();
  }, [refreshIcecast]);

  useTrackPlayerEvents(
    [Event.PlaybackMetadataReceived, Event.MetadataCommonReceived],
    (event) => {
      if (event.type === Event.MetadataCommonReceived) {
        const artwork = event.metadata?.artworkUri?.trim() || undefined;

        if (!artwork) {
          return;
        }

        setLiveMetadata((current) => ({
          ...(current ?? {}),
          artwork,
        }));

        applyMetadata({
          title: liveMetadataRef.current?.title ?? activeStation?.title,
          artist: liveMetadataRef.current?.artist ?? activeStation?.artist,
          artwork,
        });
        return;
      }

      const { title, artist } = parseMetadata(
        event.title ?? undefined,
        event.artist ?? undefined,
      );

      if (!title && !artist) {
        return;
      }

      const resolvedTitle = title ?? activeStation?.title;
      const resolvedArtist = artist ?? activeStation?.artist;
      const isJingle = isJingleTitle(resolvedTitle);
      const resolvedArtwork = isJingle
        ? JINGLE_ARTWORK
        : activeStation?.artwork;

      setLiveMetadata((current) => ({
        ...(current ?? {}),
        title: resolvedTitle,
        artist: resolvedArtist,
        artwork: isJingle ? JINGLE_ARTWORK : undefined,
      }));

      applyMetadata({
        title: resolvedTitle,
        artist: resolvedArtist,
        artwork: resolvedArtwork,
      });

      if (!isJingle) {
        void fetchArtworkForTrack(resolvedArtist, resolvedTitle);
      }
    },
  );

  const isPlaying = playing ?? false;
  const isBuffering = bufferingDuringPlay ?? false;
  const statusLabel = isBuffering
    ? "Načítání"
    : isPlaying
      ? "Přehrávání"
      : "Pozastaveno";
  const artwork =
    liveMetadata?.artwork ??
    activeTrack?.artwork ??
    activeStation?.artwork ??
    JINGLE_ARTWORK;
  const displayTitle =
    liveMetadata?.title ?? activeTrack?.title ?? "Pick a station";
  const displayArtist =
    liveMetadata?.artist ?? activeTrack?.artist ?? "Astra Radio";
  const titleFont = useMemo(
    () => pickFontForText(displayTitle, fonts.bodySemi),
    [displayTitle],
  );
  const artistFont = useMemo(
    () => pickFontForText(displayArtist, fonts.body),
    [displayArtist],
  );

  useEffect(() => {
    if (artwork) {
      setArtworkLoading(true);
    } else {
      setArtworkLoading(false);
    }
  }, [artwork]);

  const handleTogglePlayback = useCallback(async () => {
    if (!isReady) {
      return;
    }

    if (isPlaying) {
      await TrackPlayer.pause();
      return;
    }

    if (!activeTrack) {
      await TrackPlayer.skip(0);
    }

    await TrackPlayer.play();
  }, [activeTrack, isPlaying, isReady]);

  const handleSelectStation = useCallback(
    async (index: number) => {
      if (!isReady) {
        return;
      }

      // Check if this is a different station than currently playing
      const currentStationId = activeTrack?.id;
      const newStationId = stations[index]?.id;

      if (currentStationId === newStationId) {
        // Same station, no change needed
        return;
      }

      // Import ad service dynamically
      const { showRewardedAdForQuality } = await import("./src/adService");

      // Show rewarded ad for quality change (with 5 min cooldown)
      const adResult = await showRewardedAdForQuality();

      if (!adResult.allowChange) {
        console.log("[App] Quality change blocked - user did not complete ad");
        return;
      }

      // User completed ad or cooldown active - allow quality change
      await TrackPlayer.skip(index);
      await TrackPlayer.play();
    },
    [isReady, activeTrack],
  );

  const handleWatchAdForPoints = useCallback(async () => {
    if (adRewardLoading) return;
    setAdRewardLoading(true);
    try {
      const { showRewardedAd } = await import("./src/adService");
      const result = await showRewardedAd();
      if (result.completed) {
        // Award 100 bonus points
        const { addBonusPoints } = await import("./src/storage");
        const updatedUser = await addBonusPoints(100);
        if (updatedUser && onUserDataChange) {
          onUserDataChange(updatedUser);
        }
        Alert.alert(
          "🎉 +100 bodů!",
          "Děkujeme za zhlédnutí reklamy! Získáváš 100 bodů.",
          [{ text: "Super!" }],
        );
      }
    } catch (err) {
      console.warn("[PlayerScreen] Ad reward error:", err);
    } finally {
      setAdRewardLoading(false);
    }
  }, [adRewardLoading, onUserDataChange]);

  useEffect(() => {
    if (!isPlaying) {
      waveAnims.current.forEach((anim) => {
        anim.stopAnimation(() => anim.setValue(0));
      });
      return;
    }

    const animations = waveAnims.current.map((anim, index) => {
      const spec = waveBars[index];
      const rise = Math.round(spec.duration * 0.48);
      const fall = Math.max(200, spec.duration - rise);

      return Animated.loop(
        Animated.sequence([
          Animated.delay(spec.delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: rise,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: fall,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.delay(spec.rest),
        ]),
      );
    });

    animations.forEach((animation) => animation.start());

    return () => {
      animations.forEach((animation) => animation.stop());
    };
  }, [isPlaying, waveBars]);

  const nowPlayingCard = (
    <LinearGradient
      colors={["rgba(0, 63, 98, 0.6)", "rgba(16, 24, 32, 0.6)"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[
        styles.nowPlayingCard,
        isLandscape ? styles.compactCard : null,
        isLandscape ? styles.nowPlayingCardLandscape : null,
        !isLandscape
          ? {
              padding: cardPadding,
              borderRadius: cardRadius,
              marginTop: cardMarginTop,
            }
          : null,
      ]}
    >
      {artwork ? (
        <View
          style={[
            styles.artworkWrap,
            { width: artworkSize, height: artworkSize },
            !isLandscape
              ? {
                  marginBottom: artworkMarginBottom,
                  borderRadius: artworkRadius,
                }
              : null,
          ]}
        >
          {artworkLoading ? (
            <View style={styles.artworkOverlay}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : null}
          <Image
            source={{ uri: artwork }}
            style={styles.artwork}
            onLoadStart={() => setArtworkLoading(true)}
            onLoadEnd={() => setArtworkLoading(false)}
            onError={() => setArtworkLoading(false)}
          />
        </View>
      ) : null}
      <Text
        style={[
          styles.trackTitle,
          { fontSize: titleSize, fontFamily: titleFont, textAlign: "left" },
        ]}
        numberOfLines={1}
      >
        {displayTitle}
      </Text>
      <Text
        style={[
          styles.trackArtist,
          {
            fontSize: artistSize,
            fontFamily: artistFont,
            marginTop: trackMarginTop,
            textAlign: "left",
          },
        ]}
        numberOfLines={1}
      >
        {displayArtist}
      </Text>

      {/* Status Row Removed */}
      {setupError ? <Text style={styles.errorText}>{setupError}</Text> : null}
    </LinearGradient>
  );

  const controlsBlock = (
    <View
      style={[
        styles.controls,
        isLandscape ? styles.controlsLandscape : null,
        !isLandscape ? { marginVertical: controlsMargin } : null,
      ]}
    >
      <View
        style={[
          styles.playWaveWrapper,
          { width: waveRingSize, height: waveRingSize },
        ]}
      >
        {isPlaying ? (
          <View
            pointerEvents="none"
            style={[
              styles.waveRing,
              { width: waveRingSize, height: waveRingSize },
            ]}
          >
            {waveBars.map((spec) => {
              const barHeight = Math.round(spec.baseHeight * waveScale);
              const barThickness = Math.max(
                2,
                Math.round(spec.thickness * waveScale),
              );
              const anim = waveAnims.current[spec.index];
              const fillScale = anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, spec.maxScale],
              });
              const translateOut = -waveRadius * spec.offset + barHeight / 2;

              return (
                <View
                  key={`wave-${spec.index}`}
                  style={[
                    styles.waveBarTrack,
                    {
                      width: barThickness,
                      height: barHeight,
                      borderRadius: barThickness,
                      transform: [
                        { translateX: -barThickness / 2 },
                        { translateY: -barHeight / 2 },
                        { rotate: `${spec.angle}deg` },
                        { translateY: translateOut },
                      ],
                    },
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.waveBarFill,
                      {
                        height: barHeight,
                        opacity: spec.fillOpacity,
                        borderRadius: barThickness,
                        transform: [
                          { translateY: barHeight / 2 },
                          { scaleY: fillScale },
                          { translateY: -barHeight / 2 },
                        ],
                      },
                    ]}
                  />
                </View>
              );
            })}
          </View>
        ) : null}
        <View style={{ alignItems: "center", justifyContent: "center" }}>
          {/* Blur Layer */}
          <View style={{ position: "absolute", zIndex: -1 }}>
            <BlurredOrb radius={60} color="#00E5FF" opacity={0.6} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? "Pozastavit" : "Přehrát"}
            disabled={!isReady}
            onPress={handleTogglePlayback}
            style={({ pressed }) => [
              styles.playButtonCircle,
              !isReady ? styles.disabledButton : null,
              pressed ? styles.playButtonCirclePressed : null,
            ]}
          >
            {/* Radial Gradient Background */}
            <Svg height="88" width="88" style={StyleSheet.absoluteFill}>
              <Defs>
                <RadialGradient
                  id="playBtnGrad"
                  cx="50%"
                  cy="50%"
                  rx="50%"
                  ry="50%"
                  fx="50%"
                  fy="50%"
                >
                  <Stop offset="0" stopColor="#00E5FF" stopOpacity="1" />
                  <Stop offset="1" stopColor="#003F62" stopOpacity="1" />
                </RadialGradient>
              </Defs>
              <Circle cx="44" cy="44" r="44" fill="url(#playBtnGrad)" />
            </Svg>

            {isPlaying ? (
              <View style={[styles.pauseIcon, { gap: pauseGap }]}>
                <View
                  style={[
                    styles.pauseBar,
                    { width: pauseBarWidth, height: pauseBarHeight },
                  ]}
                />
                <View
                  style={[
                    styles.pauseBar,
                    { width: pauseBarWidth, height: pauseBarHeight },
                  ]}
                />
              </View>
            ) : (
              <Image
                source={require("./assets/play.png")}
                style={{ width: 32, height: 36, tintColor: "#FFFFFF" }}
                resizeMode="contain"
              />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );

  const qualityBlock = (
    <View
      style={[
        styles.qualitySection,
        isLandscape ? styles.qualitySectionLandscape : null,
      ]}
    >
      <View style={styles.qualityLabelContainer}>
        <Text style={styles.sectionLabel}>Kvalita</Text>
      </View>
      <View
        style={[styles.qualityRow, !isLandscape ? { gap: qualityGap } : null]}
      >
        {stations.map((station, index) => {
          const isActive = activeStation?.id === station.id;
          const kbpsMatch = station.quality.match(/(\d+)\s*kbps/i);
          const fallbackNumbers = station.quality.match(/\d+/g);
          const bitrate =
            kbpsMatch?.[1] ??
            (fallbackNumbers
              ? fallbackNumbers[fallbackNumbers.length - 1]
              : null) ??
            station.quality;

          return (
            <Pressable
              key={station.id}
              accessibilityRole="button"
              onPress={() => handleSelectStation(index)}
              style={({ pressed }) => [
                styles.qualityCard,
                !isLandscape
                  ? {
                      paddingVertical: qualityPadY,
                      borderRadius: qualityRadius,
                      minHeight: qualityCardHeight,
                    }
                  : null,
                isLandscape ? { minHeight: qualityCardHeight } : null,
                isActive ? styles.qualityCardActive : null,
                pressed ? styles.qualityCardPressed : null,
              ]}
            >
              <Text
                style={[
                  styles.qualityValue,
                  !isLandscape ? { fontSize: qualityValueSize } : null,
                  isActive ? styles.qualityValueActive : null,
                ]}
              >
                {bitrate}
              </Text>
              <Text
                style={[
                  styles.qualityUnit,
                  !isLandscape ? { fontSize: qualityUnitSize } : null,
                  isActive ? styles.qualityUnitActive : null,
                ]}
              >
                KBPS
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <View
        style={[
          styles.playerContent,
          isLandscape
            ? styles.playerContentLandscape
            : styles.playerContentPortrait,
          { paddingBottom: contentPaddingBottom },
          !isLandscape ? { gap: contentGap } : null,
        ]}
      >
        <View
          pointerEvents="none"
          style={[
            styles.playerConstellation,
            {
              width: constellationWidth,
              height: constellationHeight,
              top: constellationTop,
              left: constellationLeft,
            },
          ]}
        >
          <Constellation
            width={constellationWidth}
            height={constellationHeight}
          />
        </View>
        {isLandscape ? (
          <View
            style={[styles.playerLandscapeRow, { width: landscapeMaxWidth }]}
          >
            <View
              style={[
                styles.playerLandscapeLeft,
                { width: leftColumnMaxWidth },
              ]}
            >
              {nowPlayingCard}
            </View>
            <View
              style={[styles.playerLandscapeRight, { width: rightColumnWidth }]}
            >
              {controlsBlock}
              {qualityBlock}
            </View>
          </View>
        ) : (
          <View
            style={{
              width: "100%", // Use full width of parent
              maxWidth: 340, // Cap it for aesthetics
              alignSelf: "center",
              marginTop: 0, // REMOVE the fixed margin
              paddingTop: 10, // Add a small safe padding
              flex: 1,
              // 'space-evenly' will distribute white space automatically between top, middle, bottom
              justifyContent: "space-evenly",
              // Ensure we clear the tab bar. 20 is a safe buffer.
              paddingBottom: (tabBarHeight || 80) + 20,
            }}
          >
            <View style={{ flexShrink: 1, justifyContent: "center" }}>
              <LinearGradient
                colors={["#003F62", "#101820"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={[styles.liveIndicator, { marginBottom: 4, alignSelf: "flex-start" }]}
              >
                <Text style={styles.liveText}>
                  <Text style={{ color: "#FFFFFF" }}>• </Text>
                  {statusLabel.toUpperCase()}
                </Text>
              </LinearGradient>
              {nowPlayingCard}
            </View>
            <View style={{ alignItems: "center" }}>{controlsBlock}</View>
            <View>{qualityBlock}</View>
            {/* Watch Ad for Points Banner */}
            <Pressable
              onPress={handleWatchAdForPoints}
              disabled={adRewardLoading}
              style={({ pressed }) => [
                styles.adRewardBanner,
                pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
                adRewardLoading && { opacity: 0.5 },
              ]}
            >
              <LinearGradient
                colors={["rgba(0, 229, 255, 0.12)", "rgba(0, 229, 255, 0.04)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.adRewardGradient}
              >
                <Text style={styles.adRewardIcon}>🎬</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.adRewardTitle}>
                    {adRewardLoading
                      ? "Načítání reklamy..."
                      : "Sleduj reklamu a získej body!"}
                  </Text>
                  <Text style={styles.adRewardSubtext}>+100 bodů zdarma</Text>
                </View>
                <View style={styles.adRewardBadge}>
                  <Text style={styles.adRewardBadgeText}>+100</Text>
                </View>
              </LinearGradient>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    // Transparent so global background (glow/orb/stars) is visible by default.
    // Individual screens (like Menu) can draw their own solid background.
    backgroundColor: "transparent",
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    zIndex: 1000,
  },
  backgroundWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.backgroundAlt,
    // opacity: 0.5, // Removed to ensure dark background
  },
  backgroundGlow: {
    position: "absolute",
    top: -120,
    right: -90,
    width: 280,
    height: 280,
    borderRadius: 200,
    backgroundColor: "#003F62",
    opacity: 0.6, // Adjusted for blur effect simulation
    shadowColor: "#003F62",
    shadowOpacity: 1,
    shadowRadius: 120, // 120 blur
    elevation: 24,
  },
  backgroundOrb: {
    position: "absolute",
    bottom: -160,
    left: -120,
    width: 320,
    height: 320,
    borderRadius: 200,
    backgroundColor: "#003F62",
    opacity: 0.6, // Adjusted for blur effect simulation
    shadowColor: "#003F62",
    shadowOpacity: 1,
    shadowRadius: 120, // 120 blur
    elevation: 24,
  },
  appShell: {
    flex: 1,
    zIndex: 1,
    backgroundColor: "transparent",
  },
  contentWrapper: {
    flex: 1,
    paddingHorizontal: 0, // Reset to 0, managed by components (Header 14px, Card centered/32px)
    paddingTop: 41, // Reduced from 56 (approx 15px less)
  },
  contentWrapperLandscape: {
    paddingTop: 0,
  },
  // Tablet: centre content and constrain max width for comfortable reading
  contentWrapperTablet: {
    alignSelf: "center",
    width: "100%",
    maxWidth: TABLET_MAX_CONTENT_WIDTH,
  },
  screenArea: {
    flex: 1,
    marginTop: 8,
  },
  screenAreaLandscape: {
    marginTop: 0,
  },
  screen: {
    flex: 1,
  },
  screenFullWidth: {
    flex: 1,
    width: "100%",
    backgroundColor: "transparent",
  },
  screenActive: {
    display: "flex",
  },
  screenHidden: {
    display: "none",
  },
  screenContent: {
    paddingTop: 4, // Reduced from 12
    paddingBottom: 140, // Increased to 140
    paddingHorizontal: 20,
  },
  playerContent: {
    flex: 1,
    paddingBottom: 12,
    position: "relative",
  },
  playerContentPortrait: {
    justifyContent: "flex-start",
  },
  playerContentLandscape: {
    justifyContent: "center",
    paddingTop: 8,
    paddingBottom: 8,
  },
  playerLandscapeRow: {
    flexGrow: 0,
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "center",
    alignSelf: "center",
    gap: 20,
  },
  playerLandscapeLeft: {
    flex: 0,
    justifyContent: "center",
  },
  playerLandscapeRight: {
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  playerConstellation: {
    position: "absolute",
    zIndex: 0,
    opacity: 0.6,
  },
  screenTitle: {
    color: "#FFFFFF",
    fontSize: 28, // Bigger
    fontFamily: "Inter-SemiBold", // Use your requested font
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 24,
    marginTop: 8,
    textTransform: "uppercase", // distinct "Header" feel
    // textShadow for depth against stars
    textShadowColor: "rgba(0, 229, 255, 0.3)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  bannerAdContainer: {
    backgroundColor: "rgba(15, 26, 32, 0.6)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.line,
    minHeight: 50,
  },
  bannerAdText: {
    color: colors.accent,
    fontSize: 14,
    fontFamily: fonts.bodySemi,
    marginBottom: 4,
  },
  bannerAdSubtext: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: fonts.body,
  },
  loading: {
    marginTop: 12,
    marginBottom: 12,
  },
  header: {
    paddingHorizontal: 14, // 14px from left corner
    marginTop: 14, // "Add another 14px" from top
    flexDirection: "row",
    alignItems: "flex-start", // Top alignment
    justifyContent: "space-between",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8, // Push down to visually center with "Astra Radio" text
  },
  // ... (skipping some lines) ...

  brand: {
    color: "#E6F1F5",
    fontSize: 24,
    fontFamily: "Onest-Bold",
    fontWeight: "700",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  tagline: {
    color: "#E6F1F5",
    fontSize: 12,
    marginTop: 4,
    fontFamily: "Inter-Regular",
    fontWeight: "400",
    letterSpacing: 0,
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 229, 255, 0.45)",
    backgroundColor: "rgba(0, 229, 255, 0.08)",
  },
  notificationButtonPressed: {
    transform: [{ scale: 0.96 }],
  },
  bellEmoji: {
    fontSize: 18,
    color: colors.accent,
  },
  nowPlayingCard: {
    marginTop: 0, // Reset margin to rely on Pill's marginBottom (10px) = 10px gap
    borderRadius: 20,
    padding: 20,
    // borderWidth: 0, // Removed duplicate
    // borderColor: colors.line,
    width: "100%", // Changed to 100% of wrapper (330px)
    alignItems: "flex-start", // Reverted to left content
    minHeight: 192,
    // alignSelf: 'center', // Managed by wrapper
    zIndex: 1,
    // Removed shadow/elevation to prevent "dark center" look on transparent card
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
  },
  nowPlayingCardLandscape: {
    marginTop: 0,
    alignSelf: "stretch",
    maxWidth: "100%",
    flex: 1,
    justifyContent: "center",
  },
  compactCard: {
    marginTop: 0,
    paddingVertical: 16,
  },
  artworkWrap: {
    width: 120,
    height: 120,
    borderRadius: 22,
    overflow: "visible", // Changed to visible for shadow?
    // borderWidth: 1, // Removed outline
    // borderColor: 'rgba(0, 229, 255, 0.4)',
    marginBottom: 16,
    // Shadow Request: #00E5FF 25% 0 4 20
    shadowColor: "#00E5FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    // shadowRadius: 20, // Removed duplicate
    // elevation: 12, // Removed to avoid black shadow on transparent card
  },
  artworkOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  artwork: {
    width: "100%",
    height: "100%",
    borderRadius: 16, // Added corner radius to image
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: "Inter-Regular",
    fontWeight: "400",
    letterSpacing: 0.5, // Reduced spacing
    marginBottom: 8,
    textTransform: "uppercase",
  },
  liveIndicator: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    // borderWidth: 1, // Removed red outline
    // borderColor: 'rgba(255, 68, 68, 0.2)',
  },
  liveText: {
    color: "#E6F1F5", // Removed red (#FF4444), using neutral/brand color
    fontSize: 10,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  qualityLabelContainer: {
    width: 309, // 3 * 87 + 2 * 24
    alignSelf: "center",
    marginBottom: 4,
  },
  trackTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    fontWeight: "600",
  },
  trackArtist: {
    color: "#E6F1F5",
    fontSize: 10, // Reverted to 10px per request
    marginTop: 2,
    fontFamily: "Inter-Regular",
    fontWeight: "400",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusDotLive: {
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.9,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
  },
  statusDotIdle: {
    backgroundColor: "rgba(207, 239, 240, 0.35)",
  },
  status: {
    color: colors.accent,
    fontSize: 11, // Changed size to 11 per request
    fontFamily: "Inter-Regular", // Changed font
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  errorText: {
    marginTop: 10,
    color: "#f39c9c",
    fontSize: 12,
    fontFamily: fonts.body,
  },
  controls: {
    alignItems: "center",
    marginVertical: 8,
  },
  controlsLandscape: {
    marginVertical: 0,
  },
  playWaveWrapper: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  waveRing: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  waveBarTrack: {
    position: "absolute",
    top: "50%",
    left: "50%",
    backgroundColor: colors.line,
  },
  waveBarFill: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#00E5FF", // Updated to Cyan
    shadowColor: "#00E5FF",
    shadowOpacity: 0.55,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 6,
  },
  playButtonCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden", // Clip gradient
  },
  playButtonCircleActive: {
    // No longer needed
  },
  playButtonCirclePressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.9,
  },
  pauseIcon: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  pauseBar: {
    backgroundColor: "#FFFFFF", // Updated to White
    borderRadius: 2,
  },
  playTriangle: {
    width: 0,
    height: 0,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: "#041316",
  },
  disabledButton: {
    opacity: 0.5,
  },
  qualitySection: {
    marginTop: 0,
  },
  qualitySectionLandscape: {
    marginTop: 0,
    width: "100%",
  },
  qualityRow: {
    flexDirection: "row",
    gap: 24, // Gap 24
    justifyContent: "center",
  },
  qualityCard: {
    width: 87,
    height: 56,
    backgroundColor: "transparent",
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#00E5FF", // Neon Cyan border for inactive
  },
  qualityCardActive: {
    backgroundColor: "#003F62", // Dark Blue active bg
    borderWidth: 0,
  },
  qualityCardPressed: {
    transform: [{ scale: 0.98 }],
  },
  qualityValue: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: "Inter-Regular",
  },
  qualityValueActive: {
    color: "#FFFFFF",
  },
  qualityUnit: {
    color: "rgba(255, 255, 255, 0.7)",
    fontFamily: "Inter-Regular",
    textTransform: "uppercase",
    marginTop: 0,
    fontSize: 10,
  },
  qualityUnitActive: {
    color: "#FFFFFF",
  },
  tabBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    position: "absolute",
    bottom: 44, // 38px Safe Area + 6px Gap
    alignSelf: "center", // Center horizontally
    width: 302, // Fixed width
    height: 61, // Fixed height
    paddingHorizontal: 18.5,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(84, 198, 240, 0.15)",
    backgroundColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
    overflow: "hidden", // Needed for BlurView rounded corners
    zIndex: 100,
  },
  // Tablet: slightly wider tab bar for comfortable spacing on large screens
  tabBarTablet: {
    width: 400,
    height: 68,
    bottom: 48,
    paddingHorizontal: 28,
  },
  tabItem: {
    width: 48,
    alignItems: "center",
    justifyContent: "center",
    height: 61,
    marginVertical: 0,
    borderRadius: 24,
    zIndex: 1,
  },
  // Tablet: larger tap target
  tabItemTablet: {
    width: 64,
    height: 68,
  },
  tabItemActiveBackground: {
    position: "absolute",
    width: 76,
    height: 49,
    borderRadius: 160,
    backgroundColor: "transparent",
    overflow: "hidden",
    zIndex: 0,
    top: 6, // (61 - 49) / 2 = 6 to center vertically
  },
  tabItemActiveFirst: {
    // No special corner needed with full radius
  },
  tabItemActiveLast: {
    // No special corner needed with full radius
  },
  tabItemPressed: {
    transform: [{ scale: 0.98 }],
  },
  tabIconWrap: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 0,
  },
  // ... (Icons) ...
  // Since user asked for "icon 32x32", I'm just centering whatever icon is there in the 32x32 box
  // I will make sure the label is hidden
  tabIconPlay: {
    width: 0,
    height: 0,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: "transparent",
  },
  tabIconNews: {
    width: 18,
    gap: 3,
  },
  tabIconNewsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  tabIconNewsDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
  },
  tabIconNewsLine: {
    flex: 1,
    height: 2,
    borderRadius: 2,
  },
  tabIconNote: {
    width: 18,
    height: 18,
  },
  tabIconNoteStem: {
    position: "absolute",
    right: 4,
    top: 2,
    width: 2,
    height: 10,
    borderRadius: 1,
  },
  tabIconNoteFlag: {
    position: "absolute",
    right: 4,
    top: 2,
    width: 6,
    height: 2,
    borderRadius: 1,
  },
  tabIconNoteHead: {
    position: "absolute",
    left: 2,
    bottom: 2,
    width: 6,
    height: 6,
    borderRadius: 4,
  },
  tabIconShop: {
    width: 16,
    height: 16,
    borderRadius: 2,
    borderWidth: 1.6,
  },
  tabIconShopTop: {
    width: 8,
    height: 2,
    borderTopWidth: 1.6,
    position: "absolute",
    top: -6,
    left: 2,
  },
  tabIconShopBottom: {
    width: 8,
    height: 6,
    borderRadius: 2,
    position: "absolute",
    bottom: 2,
    left: 2,
  },
  tabLabel: {
    display: "none",
  },
  tabLabelActive: {
    display: "none",
  },
  tabIconMenuLine: {
    width: "100%",
    height: 2,
    borderRadius: 1,
  },
  newsCard: {
    backgroundColor: "rgba(15, 26, 32, 0.75)", // Updated glass opacity
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(0, 229, 255, 0.2)", // Updated border opacity
    marginBottom: 16,
    overflow: "hidden",
  },
  newsCardPressed: {
    transform: [{ scale: 0.99 }],
  },
  newsImage: {
    width: "100%",
    height: 150,
  },
  newsImagePlaceholder: {
    width: "100%",
    height: 120,
    backgroundColor: "rgba(0, 229, 255, 0.06)",
  },
  newsContent: {
    padding: 16,
  },
  newsTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontFamily: fonts.bodySemi,
  },
  newsExcerpt: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
    fontFamily: fonts.body,
  },
  newsMeta: {
    color: colors.accent,
    fontSize: 11,
    marginTop: 10,
    fontFamily: fonts.bodyMedium,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  listCard: {
    backgroundColor: "rgba(15, 26, 32, 0.75)", // Updated glass opacity
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0, 229, 255, 0.2)", // Updated border opacity
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    flexDirection: "row", // Optional: align time/title better
    alignItems: "center",
  },
  listTime: {
    color: colors.accent,
    fontSize: 12,
    fontFamily: fonts.bodySemi,
    letterSpacing: 1.2,
    marginRight: 16, // Added space between time and title
  },
  listTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    marginTop: 0, // Removed top margin to aligning center
    fontFamily: fonts.body,
    flex: 1, // Ensure title takes remaining space
  },
  notificationsScreen: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 24,
    zIndex: 1,
  },
  notificationsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 229, 255, 0.35)",
    backgroundColor: "rgba(0, 229, 255, 0.05)",
  },
  backButtonPressed: {
    transform: [{ scale: 0.96 }],
  },
  backIcon: {
    color: colors.accent,
    fontSize: 18,
    fontFamily: fonts.bodySemi,
  },
  notificationsTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontFamily: fonts.bodySemi,
  },
  headerSpacer: {
    width: 8,
  },
  notificationsBody: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  filterBar: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  filterInput: {
    backgroundColor: "rgba(10, 15, 20, 0.7)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 229, 255, 0.25)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: 13,
    flex: 1,
  },
  filterInputSmall: {
    flex: 0.9,
  },
  filterReset: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 229, 255, 0.4)",
    backgroundColor: "rgba(0, 229, 255, 0.08)",
  },
  filterResetPressed: {
    transform: [{ scale: 0.97 }],
  },
  filterResetText: {
    color: colors.accent,
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  detailHeaderTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontFamily: fonts.bodySemi,
  },
  detailCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
  },
  detailImage: {
    width: "100%",
    height: 180,
    borderRadius: 16,
    marginBottom: 14,
  },
  detailTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontFamily: fonts.bodySemi,
  },
  detailMeta: {
    color: colors.accent,
    fontSize: 11,
    marginTop: 8,
    fontFamily: fonts.bodyMedium,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  detailParagraph: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    fontFamily: fonts.body,
  },
  countdownCard: {
    marginTop: 16,
    backgroundColor: colors.surfaceStrong,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
  },
  countdownTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontFamily: fonts.bodySemi,
  },
  countdownTarget: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 6,
    fontFamily: fonts.body,
  },
  countdownGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    marginHorizontal: -4,
  },
  countdownItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
    marginHorizontal: 4,
    backgroundColor: "rgba(10, 15, 20, 0.65)",
    borderWidth: 1,
    borderColor: "rgba(0, 229, 255, 0.18)",
  },
  countdownValue: {
    color: colors.textPrimary,
    fontSize: 18,
    fontFamily: fonts.bodySemi,
  },
  countdownLabel: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontFamily: fonts.bodyMedium,
  },
  countdownEnded: {
    color: colors.accent,
    fontSize: 12,
    marginTop: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontFamily: fonts.bodySemi,
  },
  contestCard: {
    marginTop: 16,
    backgroundColor: colors.surfaceStrong,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
  },
  contestTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontFamily: fonts.bodySemi,
  },
  contestNote: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    fontFamily: fonts.body,
  },
  contestField: {
    marginTop: 12,
  },
  contestLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 6,
    fontFamily: fonts.bodyMedium,
  },
  contestInput: {
    backgroundColor: "rgba(10, 15, 20, 0.7)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 229, 255, 0.25)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  contestPlatformRow: {
    flexDirection: "row",
    marginHorizontal: -4,
    marginTop: 6,
  },
  contestPlatformBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 229, 255, 0.35)",
    backgroundColor: "rgba(10, 15, 20, 0.65)",
  },
  contestPlatformBtnActive: {
    borderColor: colors.accent,
    backgroundColor: "rgba(0, 229, 255, 0.18)",
  },
  contestPlatformBtnPressed: {
    transform: [{ scale: 0.98 }],
  },
  contestPlatformText: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  contestPlatformTextActive: {
    color: colors.accent,
  },
  contestSubmit: {
    marginTop: 16,
    backgroundColor: colors.accentStrong,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 229, 255, 0.45)",
  },
  contestSubmitDisabled: {
    opacity: 0.6,
  },
  contestSubmitPressed: {
    transform: [{ scale: 0.98 }],
  },
  contestSubmitText: {
    color: "#041316",
    fontSize: 14,
    fontFamily: fonts.bodySemi,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  contestStatus: {
    marginTop: 12,
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
  },
  contestStatusOk: {
    color: colors.accent,
  },
  contestStatusError: {
    color: "#f39c9c",
  },
  contactCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
  },
  contactLabel: {
    color: colors.accent,
    fontSize: 12,
    fontFamily: fonts.bodySemi,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  contactName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontFamily: fonts.bodySemi,
    marginBottom: 8,
  },
  contactText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.body,
  },
  contactDivider: {
    height: 1,
    backgroundColor: "rgba(0, 229, 255, 0.12)",
    marginVertical: 12,
  },
  emptyState: {
    paddingVertical: 30,
    alignItems: "center",
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontFamily: fonts.bodySemi,
    textAlign: "center",
  },
  emptySubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
    fontFamily: fonts.body,
  },
  adRewardBanner: {
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 8,
  },
  adRewardGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0, 229, 255, 0.2)",
  },
  adRewardIcon: {
    fontSize: 22,
    marginRight: 10,
  },
  adRewardTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    fontFamily: fonts.bodySemi,
  },
  adRewardSubtext: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
  },
  adRewardBadge: {
    backgroundColor: "rgba(0, 229, 255, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(0, 229, 255, 0.3)",
  },
  adRewardBadgeText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
  },
});

export default App;
