import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type LogEntry = {
  timestamp: string;
  level: "log" | "warn" | "error";
  message: string;
};

// Global log buffer
const logBuffer: LogEntry[] = [];
const LISTENERS = new Set<() => void>();

function notifyListeners() {
  LISTENERS.forEach((l) => l());
}

// Hook console methods
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

const formatArgs = (args: any[]) => {
  return args
    .map((arg) => {
      if (typeof arg === "object") {
        try {
          return JSON.stringify(arg);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(" ");
};

console.log = (...args) => {
  originalLog(...args);
  const entry: LogEntry = {
    timestamp: new Date().toISOString().split("T")[1].slice(0, 8),
    level: "log",
    message: formatArgs(args),
  };
  logBuffer.push(entry);
  if (logBuffer.length > 500) logBuffer.shift(); // Keep last 500
  notifyListeners();
};

console.warn = (...args) => {
  originalWarn(...args);
  const entry: LogEntry = {
    timestamp: new Date().toISOString().split("T")[1].slice(0, 8),
    level: "warn",
    message: formatArgs(args),
  };
  logBuffer.push(entry);
  if (logBuffer.length > 500) logBuffer.shift();
  notifyListeners();
};

console.error = (...args) => {
  originalError(...args);
  const entry: LogEntry = {
    timestamp: new Date().toISOString().split("T")[1].slice(0, 8),
    level: "error",
    message: formatArgs(args),
  };
  logBuffer.push(entry);
  if (logBuffer.length > 500) logBuffer.shift();
  notifyListeners();
};

export function DebugOverlay() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isVisible, setIsVisible] = useState(false); // Hidden by default
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    const update = () => setLogs([...logBuffer]);
    LISTENERS.add(update);
    update(); // Initial load
    return () => {
      LISTENERS.delete(update);
    };
  }, []);

  if (!isVisible) {
    return (
      <View style={styles.triggerContainer} pointerEvents="box-none">
        <Pressable
          style={styles.triggerDetails}
          onLongPress={() => setIsVisible(true)}
          delayLongPress={2000} // 2 second hold to open
        >
          <Text style={{ color: "transparent" }}> Debug </Text>
        </Pressable>
      </View>
    );
  }

  if (isMinimized) {
    return (
      <View style={styles.minimizedContainer}>
        <Pressable
          style={styles.iconButton}
          onPress={() => setIsMinimized(false)}
        >
          <Text style={styles.iconText}>🔍</Text>
        </Pressable>
        <Pressable
          style={[styles.iconButton, styles.closeButton]}
          onPress={() => setIsVisible(false)}
        >
          <Text style={styles.iconText}>✕</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.window}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Debug Logs ({logs.length})</Text>
            <View style={styles.actions}>
              <Pressable
                onPress={() => {
                  logBuffer.length = 0;
                  setLogs([]);
                }}
                style={styles.actionBtn}
              >
                <Text style={styles.actionText}>Clear</Text>
              </Pressable>
              <Pressable
                onPress={() => setIsMinimized(true)}
                style={styles.actionBtn}
              >
                <Text style={styles.actionText}>_</Text>
              </Pressable>
              <Pressable
                onPress={() => setIsVisible(false)}
                style={styles.actionBtn}
              >
                <Text style={styles.actionText}>✕</Text>
              </Pressable>
            </View>
          </View>

          <ScrollView style={styles.logList} stickyHeaderIndices={[]}>
            {logs
              .slice()
              .reverse()
              .map(
                (
                  log,
                  i, // Show newest first
                ) => (
                  <View
                    key={i}
                    style={[
                      styles.logRow,
                      log.level === "error"
                        ? styles.errRow
                        : log.level === "warn"
                          ? styles.warnRow
                          : null,
                    ]}
                  >
                    <Text style={styles.timestamp}>{log.timestamp}</Text>
                    <Text
                      style={[
                        styles.message,
                        log.level === "error"
                          ? styles.errText
                          : log.level === "warn"
                            ? styles.warnText
                            : null,
                      ]}
                    >
                      {log.message}
                    </Text>
                  </View>
                ),
              )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  triggerContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    alignItems: "center",
    justifyContent: "flex-start",
    top: 40,
  },
  triggerDetails: {
    width: 60,
    height: 40,
    backgroundColor: "transparent", // Invisible
  },
  minimizedContainer: {
    position: "absolute",
    top: 100,
    right: 20,
    zIndex: 9999,
    flexDirection: "column",
    gap: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.8)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#00E5FF",
  },
  closeButton: {
    backgroundColor: "rgba(255, 68, 68, 0.8)",
    borderColor: "#ff4444",
  },
  iconText: {
    fontSize: 20,
    color: "#fff",
  },
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  safeArea: {
    flex: 1,
    margin: 10,
  },
  window: {
    flex: 1,
    backgroundColor: "#0B1014",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#1a262f",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  headerTitle: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#333",
    borderRadius: 4,
  },
  actionText: {
    color: "#fff",
    fontSize: 12,
  },
  logList: {
    flex: 1,
    padding: 10,
  },
  logRow: {
    marginBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#222",
    paddingBottom: 4,
  },
  timestamp: {
    color: "#666",
    fontSize: 10,
    marginBottom: 2,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  message: {
    color: "#ccc",
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  errRow: {
    backgroundColor: "rgba(255, 0, 0, 0.1)",
  },
  warnRow: {
    backgroundColor: "rgba(255, 165, 0, 0.1)",
  },
  errText: {
    color: "#ff6b6b",
  },
  warnText: {
    color: "#ffd93d",
  },
});
