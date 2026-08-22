import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import { Audio, AVPlaybackStatus } from "expo-av";

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
  dismissMiniPlayer: () => void;
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

  const soundRef = useRef<Audio.Sound | null>(null);

  const progressRatio =
    durationMillis > 0 ? positionMillis / durationMillis : 0;

  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
    }).catch((err) => {
      console.warn("[PodcastPlayerContext] setAudioModeAsync error:", err);
    });

    return () => {
      if (soundRef.current) {
        const soundToUnload = soundRef.current;
        soundRef.current = null;
        soundToUnload
          .stopAsync()
          .then(() => soundToUnload.unloadAsync())
          .catch(() => {});
      }
    };
  }, []);

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if (status.error) {
        console.error("[PodcastPlayerContext] Playback error:", status.error);
        setIsLoading(false);
        setIsPlaying(false);
      }
      return;
    }

    setIsLoading(status.isBuffering);
    setIsPlaying(status.isPlaying);
    setPositionMillis(status.positionMillis);
    setDurationMillis(status.durationMillis ?? 0);

    if (status.didJustFinish) {
      setIsPlaying(false);
      setPositionMillis(0);
      setPausedFromMiniPlayer(false);
    }
  }, []);

  const playPodcast = useCallback(
    async (info: PodcastTrackInfo) => {
      try {
        setPausedFromMiniPlayer(false);
        setIsMiniPlayerDismissed(false);
        setIsLoading(true);

        if (soundRef.current) {
          const oldSound = soundRef.current;
          soundRef.current = null;
          try {
            await oldSound.stopAsync();
            await oldSound.unloadAsync();
          } catch {}
        }

        setActiveTrackInfo(info);

        const { sound } = await Audio.Sound.createAsync(
          { uri: info.audioUrl },
          { shouldPlay: true },
          onPlaybackStatusUpdate,
        );

        soundRef.current = sound;
        setIsLoading(false);
        setIsPlaying(true);
      } catch (error) {
        console.error("[PodcastPlayerContext] Failed to play podcast:", error);
        setIsLoading(false);
        setIsPlaying(false);
      }
    },
    [onPlaybackStatusUpdate],
  );

  const pausePodcast = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.pauseAsync();
      } catch {}
      setPausedFromMiniPlayer(false);
    }
  }, []);

  const togglePlayPause = useCallback(async () => {
    setPausedFromMiniPlayer(false);
    if (!soundRef.current && activeTrackInfo) {
      await playPodcast(activeTrackInfo);
      return;
    }
    if (soundRef.current) {
      try {
        if (isPlaying) {
          await soundRef.current.pauseAsync();
        } else {
          await soundRef.current.playAsync();
        }
      } catch {}
    }
  }, [isPlaying, activeTrackInfo, playPodcast]);

  const togglePlayPauseFromMiniPlayer = useCallback(async () => {
    if (!soundRef.current && activeTrackInfo) {
      await playPodcast(activeTrackInfo);
      return;
    }
    if (soundRef.current) {
      try {
        if (isPlaying) {
          setPausedFromMiniPlayer(true);
          await soundRef.current.pauseAsync();
        } else {
          setPausedFromMiniPlayer(false);
          await soundRef.current.playAsync();
        }
      } catch {}
    }
  }, [isPlaying, activeTrackInfo, playPodcast]);

  const seekTo = useCallback(async (positionSeconds: number) => {
    if (soundRef.current) {
      try {
        await soundRef.current.setPositionAsync(Math.floor(positionSeconds * 1000));
      } catch {}
    }
  }, []);

  const dismissMiniPlayer = useCallback(() => {
    setIsMiniPlayerDismissed(true);
    setPausedFromMiniPlayer(false);
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
