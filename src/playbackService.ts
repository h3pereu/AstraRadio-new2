import TrackPlayer, { Event, State } from "react-native-track-player";
import { fetchIcecastStatus, normalizeSources } from "./icecast";
import { stations } from "./stations";

const METADATA_INTERVAL_MS = 15000;
const JINGLE_TITLE = "Astra Radio";
const NOWPLAYING_ARTWORK = "https://icecast.astraradio.cz/nowplaying.jpg";
const JINGLE_TITLE_LOWER = JINGLE_TITLE.toLowerCase();
const isJingleTitle = (title?: string) =>
  title?.trim().toLowerCase() === JINGLE_TITLE_LOWER;

let lastTitleLine: string | null = null;
let metadataInFlight = false;
let metadataTimer: ReturnType<typeof setInterval> | null = null;

const parseMetadata = (titleRaw?: string, artistRaw?: string) => {
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
};

const updateActiveTrackMetadata = async (metadata: {
  title?: string;
  artist?: string;
  artwork?: string;
}) => {
  const index = await TrackPlayer.getActiveTrackIndex();
  if (index == null) {
    return;
  }

  await TrackPlayer.updateMetadataForTrack(index, metadata);
};

const refreshIcecastMetadata = async () => {
  if (metadataInFlight) {
    return;
  }

  metadataInFlight = true;
  try {
    let index: number | undefined;
    try {
      index = await TrackPlayer.getActiveTrackIndex();
    } catch {
      return;
    }
    if (index == null) {
      return;
    }

    const track = await TrackPlayer.getTrack(index);
    if (!track) {
      return;
    }

    const station = stations.find((entry) => entry.id === track.id);
    const mount = station?.mount ?? "astra";

    const payload = await fetchIcecastStatus();
    if (!payload) {
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
    if (!titleLine || lastTitleLine === titleLine) {
      return;
    }

    lastTitleLine = titleLine;
    const { title, artist } = parseMetadata(titleLine);
    if (!title && !artist) {
      return;
    }

    const resolvedTitle = title ?? track.title?.toString();
    const resolvedArtist = artist ?? track.artist?.toString();
    const resolvedArtwork = isJingleTitle(resolvedTitle)
      ? NOWPLAYING_ARTWORK
      : NOWPLAYING_ARTWORK;

    await updateActiveTrackMetadata({
      title: resolvedTitle,
      artist: resolvedArtist,
      artwork: resolvedArtwork,
    });
  } catch (error) {
    console.warn("Background Icecast metadata fetch failed", error);
  } finally {
    metadataInFlight = false;
  }
};

const startMetadataPolling = () => {
  if (metadataTimer) {
    return;
  }

  metadataTimer = setInterval(() => {
    void refreshIcecastMetadata();
  }, METADATA_INTERVAL_MS);
};

const stopMetadataPolling = () => {
  if (!metadataTimer) {
    return;
  }

  clearInterval(metadataTimer);
  metadataTimer = null;
};

export default async function playbackService() {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.stop());
  TrackPlayer.addEventListener(Event.RemoteNext, async () => {
    try {
      await TrackPlayer.skipToNext();
      await TrackPlayer.play();
    } catch {
      // Ignore when there is no next item in the queue.
    }
  });
  TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
    try {
      await TrackPlayer.skipToPrevious();
      await TrackPlayer.play();
    } catch {
      // Ignore when there is no previous item in the queue.
    }
  });

  TrackPlayer.addEventListener(Event.PlaybackState, (event) => {
    if (event.state === State.Playing || event.state === State.Buffering) {
      startMetadataPolling();
      void refreshIcecastMetadata();
      return;
    }

    if (event.state === State.Stopped) {
      stopMetadataPolling();
    }
  });

  startMetadataPolling();
  void refreshIcecastMetadata();
}
