import { NativeEventEmitter, NativeModules, Platform } from "react-native";
import TrackPlayer from "react-native-track-player";
import { stations } from "./stations";

export function registerCarPlayService(): void {
  if (Platform.OS !== "ios") {
    return;
  }

  const { CarPlayBridge } = NativeModules;
  if (!CarPlayBridge) {
    return;
  }

  const emitter = new NativeEventEmitter(CarPlayBridge);

  emitter.addListener(
    "carplay_switch_station",
    async (event: { id: string }) => {
      const index = stations.findIndex((s) => s.id === event.id);
      if (index === -1) {
        return;
      }
      try {
        await TrackPlayer.skip(index);
        await TrackPlayer.play();
      } catch (error) {
        console.warn("CarPlay: failed to switch station", error);
      }
    }
  );
}
