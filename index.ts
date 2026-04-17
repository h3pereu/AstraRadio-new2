// Entry point - Use AppRoot with login flow
import { LogBox } from "react-native";
import { registerRootComponent } from "expo";
import TrackPlayer from "react-native-track-player";
import AppRoot from "./AppRoot";
import playbackService from "./src/playbackService";
import { registerCarPlayService } from "./src/carplayService";

// Suppress harmless warnings from react-native-track-player v4.x
// Sleep timer methods are declared in JS but not implemented in the iOS native module
LogBox.ignoreLogs(["The objective-c", "will not be available"]);

registerRootComponent(AppRoot);
TrackPlayer.registerPlaybackService(() => playbackService);
registerCarPlayService();
