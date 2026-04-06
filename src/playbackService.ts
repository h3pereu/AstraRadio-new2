import TrackPlayer, { Event, State } from "react-native-track-player";
import { fetchIcecastStatus, normalizeSources } from "./icecast";
import { stations } from "./stations";

const METADATA_INTERVAL_MS = 15000;
const JINGLE_TITLE = "Astra Radio";
const JINGLE_ARTWORK = "https://astraradio.cz/logo.png";
const NOWPLAYING_ARTWORK = "https://icecast.astraradio.cz/nowplaying.jpg";
const JINGLE_TITLE_LOWER = JINGLE_TITLE.toLowerCase();
const isJingleTitle = (title?: string) =>
  title?.trim().toLowerCase() === JINGLE_TITLE_LOWER;

const artworkCache = new Map<string, string | null>();
let artworkFetchKey: string | null = null;
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

const fetchArtworkForTrack = async (artist?: string, title?: string) => {
  const normalizedTitle = title?.trim();
  const normalizedArtist = artist?.trim();

  if (isJingleTitle(normalizedTitle)) {
    const resolvedTitle = normalizedTitle ?? JINGLE_TITLE;
    const resolvedArtist = normalizedArtist ?? JINGLE_TITLE;
    await updateActiveTrackMetadata({
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
  if (artworkCache.has(key)) {
    const cachedArtwork = artworkCache.get(key);
    if (cachedArtwork) {
      await updateActiveTrackMetadata({
        title: normalizedTitle,
        artist: normalizedArtist,
        artwork: cachedArtwork,
      });
    }
    return;
  }

  if (artworkFetchKey === key) {
    return;
  }

  artworkFetchKey = key;

  // Show nowplaying.jpg immediately while iTunes lookup runs
  await updateActiveTrackMetadata({
    title: normalizedTitle,
    artist: normalizedArtist,
    artwork: NOWPLAYING_ARTWORK,
  });

  try {
    const response = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(
        `${normalizedArtist} ${normalizedTitle}`,
      )}&media=music&limit=1`,
    );
    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    const artworkUrl = payload?.results?.[0]?.artworkUrl100;
    if (typeof artworkUrl !== "string" || !artworkUrl.length) {
      // iTunes found nothing — keep nowplaying.jpg as fallback
      artworkCache.set(key, NOWPLAYING_ARTWORK);
      return;
    }

    const highResArtwork = artworkUrl.replace("100x100bb", "600x600bb");
    artworkCache.set(key, highResArtwork);
    await updateActiveTrackMetadata({
      title: normalizedTitle,
      artist: normalizedArtist,
      artwork: highResArtwork,
    });
  } catch (error) {
    console.warn("Background artwork lookup failed", error);
    // Network error — keep nowplaying.jpg
    artworkCache.set(key, NOWPLAYING_ARTWORK);
  } finally {
    if (artworkFetchKey === key) {
      artworkFetchKey = null;
    }
  }
};

const refreshIcecastMetadata = async () => {
  if (metadataInFlight) {
    return;
  }

  metadataInFlight = true;
  try {
    // Check if player is initialized before accessing it
    let index: number | undefined;
    try {
      index = await TrackPlayer.getActiveTrackIndex();
    } catch {
      // Player not initialized yet, skip
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
    const isJingle = isJingleTitle(resolvedTitle);
    const resolvedArtwork = isJingle ? JINGLE_ARTWORK : track.artwork;
    await updateActiveTrackMetadata({
      title: resolvedTitle,
      artist: resolvedArtist,
      artwork: resolvedArtwork,
    });

    if (!isJingle) {
      await fetchArtworkForTrack(resolvedArtist, resolvedTitle);
    }
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
