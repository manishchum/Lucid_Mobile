import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import {
  createAudioPlayer,
  setAudioModeAsync,
  AudioPlayer,
} from "expo-audio";

export interface PodcastTrackInfo {
  audioUrl: string;
  title: string;
  artist?: string;
  rawTimeline?: string | null;
  transcript?: string | null;
  lang?: string;
}

interface PodcastPlayerContextType {
  isPlaying: boolean;
  isLoading: boolean;
  activeTrackInfo: PodcastTrackInfo | null;
  positionMillis: number;
  durationMillis: number;
  progressRatio: number;
  isMiniPlayerDismissed: boolean;
  isAccordionExpanded: boolean;
  pausedFromMiniPlayer: boolean;
  isMiniPlayerVisible: boolean;
  setAccordionExpanded: (expanded: boolean) => void;
  playPodcast: (info: PodcastTrackInfo) => Promise<void>;
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

  const playerRef = useRef<AudioPlayer | null>(null);

  const progressRatio =
    durationMillis > 0 ? positionMillis / durationMillis : 0;

  useEffect(() => {
    setAudioModeAsync({
      allowsRecording: false,
      shouldPlayInBackground: true,
      playsInSilentMode: true,
    }).catch((err) => {
      console.warn("[PodcastPlayerContext] setAudioModeAsync error:", err);
    });

    return () => {
      if (playerRef.current) {
        try {
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
            playerRef.current.pause();
            playerRef.current.remove();
          } catch {}
          playerRef.current = null;
        }

        setActiveTrackInfo(info);

        const player = createAudioPlayer({ uri: info.audioUrl });
        playerRef.current = player;

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

        player.play();
        setIsLoading(false);
        setIsPlaying(true);
      } catch (error) {
        console.error("[PodcastPlayerContext] Failed to play podcast:", error);
        setIsLoading(false);
        setIsPlaying(false);
      }
    },
    [],
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
        isMiniPlayerDismissed,
        isAccordionExpanded,
        pausedFromMiniPlayer,
        isMiniPlayerVisible,
        setAccordionExpanded,
        playPodcast,
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
