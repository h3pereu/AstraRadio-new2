import { Platform } from 'react-native';

// Define the shape of what we need from TrackPlayer to satisfy TypeScript
// We mirror the Enums and Types used in App.tsx

// MOCK ENUMS
// MOCK ENUMS
export enum MockCapability {
    Play = 'remote-play',
    Pause = 'remote-pause',
    Stop = 'remote-stop',
    SkipToNext = 'remote-next',
    SkipToPrevious = 'remote-previous',
    JumpForward = 'remote-jump-forward',
    JumpBackward = 'remote-jump-backward',
    SeekTo = 'remote-seek',
}

export enum MockEvent {
    PlaybackState = 'playback-state',
    PlaybackError = 'playback-error',
    PlaybackQueueEnded = 'playback-queue-ended',
    PlaybackTrackChanged = 'playback-track-changed',
    PlaybackActiveTrackChanged = 'playback-active-track-changed',
    RemotePlay = 'remote-play',
    RemotePause = 'remote-pause',
    RemoteStop = 'remote-stop',
    RemoteNext = 'remote-next',
    RemotePrevious = 'remote-previous',
}

export enum MockRepeatMode {
    Off = 'off',
    Track = 'track',
    Queue = 'queue',
}

export enum MockAppKilledPlaybackBehavior {
    StopPlaybackAndRemoveNotification = 'stop-playback-and-remove-notification',
}

export enum State {
    None = 'none',
    Ready = 'ready',
    Playing = 'playing',
    Paused = 'paused',
    Stopped = 'stopped',
    Buffering = 'buffering',
    Connecting = 'connecting',
}

// MOCK IMPLEMENTATION
const MockTrackPlayer = {
    setupPlayer: async () => { console.log('MockTrackPlayer: setupPlayer'); },
    updateOptions: async () => { console.log('MockTrackPlayer: updateOptions'); },
    add: async () => { console.log('MockTrackPlayer: add'); },
    skip: async () => { console.log('MockTrackPlayer: skip'); },
    play: async () => { console.log('MockTrackPlayer: play'); },
    pause: async () => { console.log('MockTrackPlayer: pause'); },
    stop: async () => { console.log('MockTrackPlayer: stop'); },
    reset: async () => { console.log('MockTrackPlayer: reset'); },
    setRepeatMode: async () => { console.log('MockTrackPlayer: setRepeatMode'); },
    getQueue: async () => [],
    getCurrentTrack: async () => null,
    getDuration: async () => 0,
    getPosition: async () => 0,
    getState: async () => State.None,
    addEventListener: () => { return { remove: () => { } }; },
    setQueue: async () => { console.log('MockTrackPlayer: setQueue'); },
    seekTo: async () => { console.log('MockTrackPlayer: seekTo'); },
    setVolume: async () => { console.log('MockTrackPlayer: setVolume'); },
    getVolume: async () => 1,

    // Hook mocks
    useTrackPlayerEvents: () => { },
    useIsPlaying: () => ({ playing: false, bufferingDuringPlay: false }),
    useActiveTrack: () => null,
    useProgress: () => ({ position: 0, duration: 0, buffered: 0 }),
};

// SAFE IMPORT LOGIC
let TrackPlayer = MockTrackPlayer;
let Capability = MockCapability;
let Event = MockEvent;
let RepeatMode = MockRepeatMode;
let AppKilledPlaybackBehavior = MockAppKilledPlaybackBehavior;
let useTrackPlayerEvents = MockTrackPlayer.useTrackPlayerEvents;
let useIsPlaying = MockTrackPlayer.useIsPlaying;
let useActiveTrack = MockTrackPlayer.useActiveTrack;

try {
    // Attempt to require the real library
    // We use a try-catch block to prevent crash if native module is missing
    const TP = require('react-native-track-player');

    // Verify that the module loaded correctly and has the expected exports
    if (TP && TP.default) {
        TrackPlayer = TP.default;
        Capability = TP.Capability || MockCapability;
        Event = TP.Event || MockEvent;
        RepeatMode = TP.RepeatMode || MockRepeatMode;
        AppKilledPlaybackBehavior = TP.AppKilledPlaybackBehavior || MockAppKilledPlaybackBehavior;
        useTrackPlayerEvents = TP.useTrackPlayerEvents || MockTrackPlayer.useTrackPlayerEvents;
        useIsPlaying = TP.useIsPlaying || MockTrackPlayer.useIsPlaying;
        useActiveTrack = TP.useActiveTrack || MockTrackPlayer.useActiveTrack;
    }
} catch (e) {
    console.warn('SafeTrackPlayer: Native module missing, using MOCK.');
}

export default TrackPlayer;
export {
    Capability,
    Event,
    RepeatMode,
    AppKilledPlaybackBehavior,
    useTrackPlayerEvents,
    useIsPlaying,
    useActiveTrack,
};
