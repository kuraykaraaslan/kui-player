import { useCallback, useEffect, type RefObject } from 'react';
import type {
  CastState, CastFrameworkNs, ChromeCastNs,
  RemotePlayer, RemotePlayerController, VideoSource,
} from '../../modules/videoplayer/videoplayer.types';
import type { VideoPlayerEngine } from '../../modules/videoplayer/videoplayer.engine';

type Options = {
  enableCast: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  src: string | VideoSource | (string | VideoSource)[];
  title?: string;
  poster?: string;
  engine: VideoPlayerEngine;
  onCastStateChange?: (state: CastState) => void;
};

function mapState(s: string): CastState {
  if (s === 'CONNECTED') return 'connected';
  if (s === 'CONNECTING') return 'connecting';
  if (s === 'NO_DEVICES_AVAILABLE') return 'unavailable';
  return 'available';
}

export function useGoogleCast({ enableCast, videoRef, src, title, poster, engine, onCastStateChange }: Options) {
  const storeApi = engine.store;

  useEffect(() => {
    if (!enableCast || typeof window === 'undefined') return;

    const w = window as unknown as {
      cast?: { framework?: CastFrameworkNs };
      chrome?: { cast?: ChromeCastNs };
      __onGCastApiAvailable?: (available: boolean) => void;
    };

    let cleanupListener: (() => void) | undefined;

    const init = () => {
      const framework = w.cast?.framework;
      const chromeCast = w.chrome?.cast;
      if (!framework || !chromeCast) return;

      const context = framework.CastContext.getInstance();
      context.setOptions({
        receiverApplicationId: chromeCast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
        autoJoinPolicy: chromeCast.AutoJoinPolicy.ORIGIN_SCOPED,
      });

      const sync = () => {
        const next = mapState(context.getCastState());
        const session = context.getCurrentSession();
        storeApi.getState().setCastState(next);
        storeApi.getState().setCastDeviceName(
          next === 'connected' ? (session?.getCastDevice()?.friendlyName ?? null) : null,
        );
      };

      const handler = () => sync();
      context.addEventListener(framework.CastContextEventType.CAST_STATE_CHANGED, handler);
      sync();

      const remotePlayer: RemotePlayer = new framework.RemotePlayer();
      const remoteController: RemotePlayerController = new framework.RemotePlayerController(remotePlayer);
      engine.attachCast(remotePlayer, remoteController);

      const syncRemote = () => {
        if (!remotePlayer.isConnected) return;
        const s = storeApi.getState();
        s.setPlaying(!remotePlayer.isPaused);
        if (isFinite(remotePlayer.currentTime)) s.setCurrentTime(remotePlayer.currentTime);
        if (remotePlayer.duration > 0) s.setDuration(remotePlayer.duration);
        s.setVolume(remotePlayer.volumeLevel);
        s.setMuted(remotePlayer.isMuted);
      };
      remoteController.addEventListener(framework.RemotePlayerEventType.ANY_CHANGE, syncRemote);

      cleanupListener = () => {
        context.removeEventListener(framework.CastContextEventType.CAST_STATE_CHANGED, handler);
        remoteController.removeEventListener(framework.RemotePlayerEventType.ANY_CHANGE, syncRemote);
        engine.detachCast();
      };
    };

    if (w.cast?.framework) {
      init();
    } else {
      const SCRIPT_ID = 'google-cast-sdk';
      w.__onGCastApiAvailable = (available: boolean) => { if (available) init(); };
      if (!document.getElementById(SCRIPT_ID)) {
        const script = document.createElement('script');
        script.id = SCRIPT_ID;
        script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
        script.async = true;
        document.head.appendChild(script);
      }
    }

    return () => { cleanupListener?.(); };
  }, [enableCast, engine, storeApi]);

  useEffect(() => {
    return storeApi.subscribe((state, prev) => {
      if (state.castState !== prev.castState) onCastStateChange?.(state.castState);
    });
  }, [storeApi, onCastStateChange]);

  const toggleCast = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const w = window as unknown as {
      cast?: { framework?: CastFrameworkNs };
      chrome?: { cast?: ChromeCastNs };
    };
    const framework = w.cast?.framework;
    const chromeCast = w.chrome?.cast;
    if (!framework || !chromeCast) return;

    const context = framework.CastContext.getInstance();
    const castState = storeApi.getState().castState;
    if (castState === 'connected') { context.endCurrentSession(true); return; }

    try {
      await context.requestSession();
      const session = context.getCurrentSession();
      const v = videoRef.current;
      if (!session || !v) return;

      const first = Array.isArray(src) ? src[0] : src;
      const videoSrc = v.currentSrc || (typeof first === 'string' ? first : first?.src ?? '');
      const contentType = typeof first === 'string' ? 'video/mp4' : (first?.type ?? 'video/mp4');

      const mediaInfo = new chromeCast.media.MediaInfo(videoSrc, contentType);
      const metadata = new chromeCast.media.GenericMediaMetadata();
      if (title) metadata.title = title;
      if (poster) metadata.images = [new chromeCast.Image(poster)];
      mediaInfo.metadata = metadata;

      const request = new chromeCast.media.LoadRequest(mediaInfo);
      request.currentTime = v.currentTime;
      await session.loadMedia(request);
      v.pause();
    } catch {
      // user cancelled
    }
  }, [storeApi, src, title, poster, videoRef]);

  return { toggleCast };
}
