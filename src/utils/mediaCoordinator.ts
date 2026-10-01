type MediaCallback = () => void;

class MediaCoordinator {
  private audioPauseHandlers = new Set<MediaCallback>();
  private videoPauseHandlers = new Set<MediaCallback>();

  /**
   * Register a callback to pause audio (triggered when video starts playing)
   */
  onPauseAudio(handler: MediaCallback): () => void {
    this.audioPauseHandlers.add(handler);
    return () => {
      this.audioPauseHandlers.delete(handler);
    };
  }

  /**
   * Register a callback to pause video (triggered when audio starts playing)
   */
  onPauseVideo(handler: MediaCallback): () => void {
    this.videoPauseHandlers.add(handler);
    return () => {
      this.videoPauseHandlers.delete(handler);
    };
  }

  /**
   * Notify that an audio stream has started playing. Pauses any active video players.
   */
  notifyAudioStarted(): void {
    this.videoPauseHandlers.forEach((handler) => {
      try {
        handler();
      } catch (err) {
        console.warn("[MediaCoordinator] Error in video pause handler:", err);
      }
    });
  }

  /**
   * Notify that a video has started playing. Pauses any active audio players.
   */
  notifyVideoStarted(): void {
    this.audioPauseHandlers.forEach((handler) => {
      try {
        handler();
      } catch (err) {
        console.warn("[MediaCoordinator] Error in audio pause handler:", err);
      }
    });
  }
}

export const mediaCoordinator = new MediaCoordinator();
