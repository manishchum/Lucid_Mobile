import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import { Image } from "react-native";
import {
  createAudioPlayer,
  setAudioModeAsync,
  AudioPlayer,
} from "expo-audio";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { mediaCoordinator } from "../utils/mediaCoordinator";

export interface PodcastTrackInfo {
  audioUrl: string;
  title: string;
  artist?: string;
  category?: string;
  rawTimeline?: string | null;
  transcript?: string | null;
  lang?: string;
  moduleId?: string;
  isFallbackLang?: boolean;
  fallbackNotice?: string | null;
  mediaType?: "podcast" | "content_library";
  artworkUrl?: string | null;
}

function resolveArtworkUri(explicitUrl?: string | null): string | undefined {
  if (explicitUrl && typeof explicitUrl === "string" && explicitUrl.trim().length > 0) {
    return explicitUrl.trim();
  }
  try {
    const resolved = Image.resolveAssetSource(require("../../assets/lucid_audio_cover.jpg"));
    if (resolved?.uri) {
      return resolved.uri;
    }
  } catch (err) {
    console.warn("[PodcastPlayerContext] Failed to resolve default artwork:", err);
  }
  return undefined;
}

interface PodcastPlayerContextType {
  isPlaying: boolean;
  isLoading: boolean;
  activeTrackInfo: PodcastTrackInfo | null;
  positionMillis: number;
  durationMillis: number;
  progressRatio: number;
  playbackSpeed: number;
  isMiniPlayerDismissed: boolean;
  isAccordionExpanded: boolean;
  pausedFromMiniPlayer: boolean;
  isMiniPlayerVisible: boolean;
  setAccordionExpanded: (expanded: boolean) => void;
  setPlaybackSpeed: (speed: number) => Promise<void>;
  playPodcast: (info: PodcastTrackInfo) => Promise<void>;
  switchTrackAudio: (
    newInfo: PodcastTrackInfo,
    resumePositionSec?: number,
    shouldPlay?: boolean
  ) => Promise<void>;
  pausePodcast: () => Promise<void>;
  togglePlayPause: () => Promise<void>;
  togglePlayPauseFromMiniPlayer: () => Promise<void>;
  seekTo: (positionSeconds: number) => Promise<void>;
  dismissMiniPlayer: () => Promise<void>;
  showMiniPlayerAgain: () => void;
}

const PodcastPlayerContext = createContext<PodcastPlayerContextType | null>(null);

export const PodcastPlayerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [activeTrackInfo, setActiveTrackInfo] = useState<PodcastTrackInfo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);
  const [isMiniPlayerDismissed, setIsMiniPlayerDismissed] = useState(false);
  const [isAccordionExpanded, setIsAccordionExpanded] = useState(false);
  const [pausedFromMiniPlayer, setPausedFromMiniPlayer] = useState(false);
  const [playbackSpeed, setPlaybackSpeedState] = useState<number>(1.0);

  const playerRef = useRef<AudioPlayer | null>(null);

  const progressRatio =
    durationMillis > 0 ? positionMillis / durationMillis : 0;

  // Listen for video playback starting to pause audio
  useEffect(() => {
    const unsub = mediaCoordinator.onPauseAudio(() => {
      if (playerRef.current && isPlaying) {
        try {
          playerRef.current.pause();
        } catch {}
        setPausedFromMiniPlayer(true);
        setIsPlaying(false);
      }
    });
    return unsub;
  }, [isPlaying]);

  // Keep screen awake while audio is actively playing in foreground
  useEffect(() => {
    if (isPlaying) {
      activateKeepAwakeAsync("PodcastAudioPlayer").catch(() => {});
    } else {
      deactivateKeepAwake("PodcastAudioPlayer").catch(() => {});
    }
    return () => {
      deactivateKeepAwake("PodcastAudioPlayer").catch(() => {});
    };
  }, [isPlaying]);

  const setPlaybackSpeed = useCallback(async (speed: number) => {
    setPlaybackSpeedState(speed);
    if (playerRef.current) {
      try {
        playerRef.current.setPlaybackRate(speed);
      } catch (err) {
        console.warn("[PodcastPlayerContext] setPlaybackRate error:", err);
      }
    }
  }, []);

  useEffect(() => {
    setAudioModeAsync({
      allowsRecording: false,
      shouldPlayInBackground: true,
      playsInSilentMode: true,
      interruptionMode: "doNotMix",
    }).catch((err) => {
      console.warn("[PodcastPlayerContext] setAudioModeAsync error:", err);
    });

    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.setActiveForLockScreen(false);
          playerRef.current.pause();
          playerRef.current.remove();
        } catch {}
        playerRef.current = null;
      }
    };
  }, []);

  const playPodcast = useCallback(
    async (info: PodcastTrackInfo) => {
      try {
        setPausedFromMiniPlayer(false);
        setIsMiniPlayerDismissed(false);
        setIsLoading(true);

        if (playerRef.current) {
          try {
            playerRef.current.setActiveForLockScreen(false);
            playerRef.current.pause();
            playerRef.current.remove();
          } catch {}
          playerRef.current = null;
        }

        setActiveTrackInfo(info);

        const player = createAudioPlayer({ uri: info.audioUrl });
        playerRef.current = player;

        // Setup lockscreen controls and notification center media player
        try {
          const coverArtwork = resolveArtworkUri(info.artworkUrl);
          player.setActiveForLockScreen(
            true,
            {
              title: info.title || "Lucid Audio Lesson",
              artist:
                info.artist ||
                (info.category
                  ? `Lucid • ${info.category}`
                  : info.mediaType === "content_library"
                  ? "Lucid Content Library"
                  : "Lucid Audio Studio"),
              albumTitle: info.category ? `${info.category} Series` : "Lucid Interactive",
              artworkUrl: coverArtwork,
            },
            {
              showSeekForward: true,
              showSeekBackward: true,
            }
          );
        } catch (e) {
          console.warn("[PodcastPlayerContext] setActiveForLockScreen error:", e);
        }

        if (playbackSpeed !== 1.0) {
          try {
            player.setPlaybackRate(playbackSpeed);
          } catch {}
        }

        player.addListener("playbackStatusUpdate", (status) => {
          setIsLoading(status.isBuffering);
          setIsPlaying(status.playing);
          setPositionMillis(Math.round((status.currentTime || 0) * 1000));
          setDurationMillis(Math.round((status.duration || 0) * 1000));

          if (status.playing === false && status.currentTime >= status.duration && status.duration > 0) {
            setIsPlaying(false);
            setPositionMillis(0);
            setPausedFromMiniPlayer(false);
          }
        });

        // Notify coordinator that audio started, so any video is paused
        mediaCoordinator.notifyAudioStarted();

        player.play();
        setIsLoading(false);
        setIsPlaying(true);
      } catch (error) {
        console.error("[PodcastPlayerContext] Failed to play podcast:", error);
        setIsLoading(false);
        setIsPlaying(false);
      }
    },
    [playbackSpeed],
  );

  const switchTrackAudio = useCallback(
    async (
      newInfo: PodcastTrackInfo,
      resumePositionSec?: number,
      shouldPlay?: boolean
    ) => {
      try {
        const targetPosSec =
          resumePositionSec !== undefined
            ? resumePositionSec
            : positionMillis > 0
            ? positionMillis / 1000
            : 0;
        const wasPlaying = shouldPlay !== undefined ? shouldPlay : isPlaying;

        setActiveTrackInfo(newInfo);

        // If the URL has not changed, don't recreate the native audio player
        if (
          playerRef.current &&
          activeTrackInfo?.audioUrl === newInfo.audioUrl
        ) {
          return;
        }

        setIsLoading(true);

        if (playerRef.current) {
          try {
            playerRef.current.setActiveForLockScreen(false);
            playerRef.current.pause();
            playerRef.current.remove();
          } catch {}
          playerRef.current = null;
        }

        let hasSought = false;
        const player = createAudioPlayer({ uri: newInfo.audioUrl });
        playerRef.current = player;

        // Setup lockscreen controls and notification center media player
        try {
          const coverArtwork = resolveArtworkUri(newInfo.artworkUrl);
          player.setActiveForLockScreen(
            true,
            {
              title: newInfo.title || "Lucid Audio Lesson",
              artist:
                newInfo.artist ||
                (newInfo.category
                  ? `Lucid • ${newInfo.category}`
                  : newInfo.mediaType === "content_library"
                  ? "Lucid Content Library"
                  : "Lucid Audio Studio"),
              albumTitle: newInfo.category ? `${newInfo.category} Series` : "Lucid Interactive",
              artworkUrl: coverArtwork,
            },
            {
              showSeekForward: true,
              showSeekBackward: true,
            }
          );
        } catch (e) {
          console.warn("[PodcastPlayerContext] setActiveForLockScreen error:", e);
        }

        if (playbackSpeed !== 1.0) {
          try {
            player.setPlaybackRate(playbackSpeed);
          } catch {}
        }

        player.addListener("playbackStatusUpdate", (status) => {
          setIsLoading(status.isBuffering);
          setIsPlaying(status.playing);
          setPositionMillis(Math.round((status.currentTime || 0) * 1000));
          setDurationMillis(Math.round((status.duration || 0) * 1000));

          if (!hasSought && (status.isLoaded || (status.duration || 0) > 0)) {
            hasSought = true;
            if (targetPosSec > 0) {
              const safeSeek =
                status.duration && status.duration > 0
                  ? Math.min(targetPosSec, Math.max(0, status.duration - 0.5))
                  : targetPosSec;
              player.seekTo(safeSeek).catch((err) => {
                console.warn("[PodcastPlayerContext] Error seeking after switch:", err);
              });
            }
            if (wasPlaying) {
              try {
                mediaCoordinator.notifyAudioStarted();
                player.play();
              } catch (err) {
                console.warn("[PodcastPlayerContext] Error playing after seek:", err);
              }
            }
          }

          if (
            status.playing === false &&
            status.currentTime >= status.duration &&
            status.duration > 0
          ) {
            setIsPlaying(false);
            setPositionMillis(0);
            setPausedFromMiniPlayer(false);
          }
        });

        if (wasPlaying) {
          mediaCoordinator.notifyAudioStarted();
          player.play();
          setIsPlaying(true);
        } else {
          player.pause();
          setPausedFromMiniPlayer(true);
          setIsPlaying(false);
        }

        setIsLoading(false);
      } catch (error) {
        console.error(
          "[PodcastPlayerContext] Failed to switch track audio:",
          error
        );
        setIsLoading(false);
      }
    },
    [positionMillis, isPlaying, activeTrackInfo, playbackSpeed]
  );

  const pausePodcast = useCallback(async () => {
    if (playerRef.current) {
      try {
        playerRef.current.pause();
      } catch {}
      setPausedFromMiniPlayer(false);
    }
  }, []);

  const togglePlayPause = useCallback(async () => {
    setPausedFromMiniPlayer(false);
    if (!playerRef.current && activeTrackInfo) {
      await playPodcast(activeTrackInfo);
      return;
    }
    if (playerRef.current) {
      try {
        if (isPlaying) {
          playerRef.current.pause();
        } else {
          setIsMiniPlayerDismissed(false);
          mediaCoordinator.notifyAudioStarted();
          playerRef.current.play();
        }
      } catch {}
    }
  }, [isPlaying, activeTrackInfo, playPodcast]);

  const togglePlayPauseFromMiniPlayer = useCallback(async () => {
    if (!playerRef.current && activeTrackInfo) {
      await playPodcast(activeTrackInfo);
      return;
    }
    if (playerRef.current) {
      try {
        if (isPlaying) {
          setPausedFromMiniPlayer(true);
          playerRef.current.pause();
        } else {
          setPausedFromMiniPlayer(false);
          mediaCoordinator.notifyAudioStarted();
          playerRef.current.play();
        }
      } catch {}
    }
  }, [isPlaying, activeTrackInfo, playPodcast]);

  const seekTo = useCallback(async (positionSeconds: number) => {
    if (playerRef.current) {
      try {
        await playerRef.current.seekTo(positionSeconds);
      } catch {}
    }
  }, []);

  const dismissMiniPlayer = useCallback(async () => {
    setIsMiniPlayerDismissed(true);
    setPausedFromMiniPlayer(false);
    if (playerRef.current) {
      try {
        playerRef.current.setActiveForLockScreen(false);
        playerRef.current.pause();
      } catch (err) {
        console.warn("[PodcastPlayerContext] Error pausing audio on dismiss:", err);
      }
    }
  }, []);

  const showMiniPlayerAgain = useCallback(() => {
    setIsMiniPlayerDismissed(false);
  }, []);

  const setAccordionExpanded = useCallback((expanded: boolean) => {
    setIsAccordionExpanded(expanded);
    if (expanded) {
      setPausedFromMiniPlayer(false);
    }
  }, []);

  const isMiniPlayerVisible =
    activeTrackInfo !== null &&
    !isMiniPlayerDismissed &&
    !isAccordionExpanded &&
    (isPlaying || pausedFromMiniPlayer);

  return (
    <PodcastPlayerContext.Provider
      value={{
        isPlaying,
        isLoading,
        activeTrackInfo,
        positionMillis,
        durationMillis,
        progressRatio,
        playbackSpeed,
        isMiniPlayerDismissed,
        isAccordionExpanded,
        pausedFromMiniPlayer,
        isMiniPlayerVisible,
        setAccordionExpanded,
        setPlaybackSpeed,
        playPodcast,
        switchTrackAudio,
        pausePodcast,
        togglePlayPause,
        togglePlayPauseFromMiniPlayer,
        seekTo,
        dismissMiniPlayer,
        showMiniPlayerAgain,
      }}
    >
      {children}
    </PodcastPlayerContext.Provider>
  );
};

export const usePodcastPlayer = () => {
  const context = useContext(PodcastPlayerContext);
  if (!context) {
    throw new Error(
      "usePodcastPlayer must be used within a PodcastPlayerProvider",
    );
  }
  return context;
};
