import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type {
  CastState, CastFrameworkNs, CastMediaSession, CastQueueItem, ChromeCastNs,
  RemotePlayer, RemotePlayerController, SubtitleTrack, VideoSource,
} from '../../modules/videoplayer/videoplayer.types.js';
import type { VideoPlayerEngine } from '../../modules/videoplayer/videoplayer.engine.js';

type Options = {
  enableCast: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  src: string | VideoSource | (string | VideoSource)[];
  title?: string;
  poster?: string;
  subtitles?: SubtitleTrack[];
  queue?: CastQueueItem[];
  receiverAppId?: string;
  engine: VideoPlayerEngine;
  onCastStateChange?: (state: CastState) => void;
};

type CastWindow = {
  cast?: { framework?: CastFrameworkNs };
  chrome?: { cast?: ChromeCastNs };
  __onGCastApiAvailable?: (available: boolean) => void;
};

const SDK_SRC = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
const SCRIPT_ID = 'google-cast-sdk';

function mapState(s: string): CastState {
  if (s === 'CONNECTED') return 'connected';
  if (s === 'CONNECTING') return 'connecting';
  if (s === 'NO_DEVICES_AVAILABLE') return 'unavailable';
  return 'available';
}

/** Build the receiver-side track list from our subtitle props. */
function buildTracks(chromeCast: ChromeCastNs, subtitles: SubtitleTrack[] | undefined): unknown[] {
  const Track = chromeCast.media.Track;
  const TrackType = chromeCast.media.TrackType;
  const TextTrackType = chromeCast.media.TextTrackType;
  if (!Track || !TrackType || !TextTrackType || !subtitles?.length) return [];

  return subtitles.map((sub, i) => {
    const track = new Track(i + 1, TrackType.TEXT);
    track.trackContentId = sub.src;
    track.trackContentType = 'text/vtt';
    track.subtype = TextTrackType.SUBTITLES;
    track.name = sub.label;
    track.language = sub.srclang ?? '';
    return track;
  });
}

/**
 * Google Cast, with the session treated as a real playback target rather than a
 * bolt-on: the queue, the receiver app, subtitle selection and the handoff back
 * to local playback all belong to it.
 *
 * The sender SDK is fetched from gstatic.com the first time this runs — the one
 * external request the library can make, and only when `enableCast` is on.
 */
export function useGoogleCast({
  enableCast, videoRef, src, title, poster, subtitles, queue, receiverAppId, engine, onCastStateChange,
}: Options) {
  const storeApi = engine.store;
  const sessionRef = useRef<CastMediaSession | null>(null);
  /** Where the receiver was when the session ended, so local playback resumes there. */
  const handoff = useRef<{ time: number; playing: boolean } | null>(null);

  useEffect(() => {
    if (!enableCast || typeof window === 'undefined') return;
    const w = window as unknown as CastWindow;
    let cleanupListener: (() => void) | undefined;

    const init = () => {
      const framework = w.cast?.framework;
      const chromeCast = w.chrome?.cast;
      if (!framework || !chromeCast) return;

      const context = framework.CastContext.getInstance();
      context.setOptions({
        receiverApplicationId: receiverAppId ?? chromeCast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
        autoJoinPolicy: chromeCast.AutoJoinPolicy.ORIGIN_SCOPED,
      });

      const sync = () => {
        const s = storeApi.getState();
        const next = mapState(context.getCastState());
        const session = context.getCurrentSession();
        const wasConnected = s.castState === 'connected';

        s.setCastState(next);
        s.setCastDeviceName(next === 'connected' ? (session?.getCastDevice()?.friendlyName ?? null) : null);
        if (next === 'connected') s.setCastError(null);

        sessionRef.current = next === 'connected' ? (session?.getMediaSession?.() ?? null) : null;

        // Session ended: pick local playback back up where the TV left off.
        if (wasConnected && next !== 'connected') {
          const point = handoff.current;
          handoff.current = null;
          s.setCastQueue(0, 0);
          const v = videoRef.current;
          if (v && point) {
            if (Number.isFinite(point.time) && point.time > 0) v.currentTime = point.time;
            if (point.playing) void v.play().catch(() => { /* autoplay may be blocked */ });
          }
        }
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
        // Remember the last known remote position for the handoff.
        handoff.current = { time: remotePlayer.currentTime, playing: !remotePlayer.isPaused };
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
      w.__onGCastApiAvailable = (available: boolean) => {
        if (available) init();
        else storeApi.getState().setCastState('unavailable');
      };
      if (!document.getElementById(SCRIPT_ID)) {
        const script = document.createElement('script');
        script.id = SCRIPT_ID;
        script.src = SDK_SRC;
        script.async = true;
        script.onerror = () => {
          const s = storeApi.getState();
          s.setCastState('error');
          s.setCastError('The Google Cast SDK could not be loaded.');
        };
        document.head.appendChild(script);
      }
    }

    return () => { cleanupListener?.(); };
  }, [enableCast, engine, storeApi, receiverAppId, videoRef]);

  useEffect(() => {
    return storeApi.subscribe((state, prev) => {
      if (state.castState !== prev.castState) onCastStateChange?.(state.castState);
    });
  }, [storeApi, onCastStateChange]);

  // Subtitle choices made while casting belong on the receiver, not on a
  // <video> nobody is looking at.
  useEffect(() => {
    return storeApi.subscribe((state, prev) => {
      if (state.selectedSubtitle === prev.selectedSubtitle) return;
      if (state.castState !== 'connected') return;
      const chromeCast = (window as unknown as CastWindow).chrome?.cast;
      const EditTracksInfoRequest = chromeCast?.media.EditTracksInfoRequest;
      const media = sessionRef.current;
      if (!EditTracksInfoRequest || !media) return;
      const active = state.selectedSubtitle === null ? [] : [state.selectedSubtitle + 1];
      try {
        media.editTracksInfo(new EditTracksInfoRequest(active), () => {}, () => {});
      } catch { /* receiver refused the change */ }
    });
  }, [storeApi]);

  const toggleCast = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const w = window as unknown as CastWindow;
    const framework = w.cast?.framework;
    const chromeCast = w.chrome?.cast;
    const s = storeApi.getState();
    if (!framework || !chromeCast) return;

    const context = framework.CastContext.getInstance();
    if (s.castState === 'connected') { context.endCurrentSession(true); return; }

    try {
      s.setCastError(null);
      await context.requestSession();
      const session = context.getCurrentSession();
      const v = videoRef.current;
      if (!session) return;

      const mediaFor = (item: { src: string; type?: string; title?: string; poster?: string; subtitles?: SubtitleTrack[] }) => {
        const info = new chromeCast.media.MediaInfo(item.src, item.type ?? 'video/mp4');
        const metadata = new chromeCast.media.GenericMediaMetadata();
        if (item.title) metadata.title = item.title;
        if (item.poster) metadata.images = [new chromeCast.Image(item.poster)];
        info.metadata = metadata;
        const tracks = buildTracks(chromeCast, item.subtitles);
        if (tracks.length > 0) info.tracks = tracks;
        return info;
      };

      const QueueLoadRequest = chromeCast.media.QueueLoadRequest;
      const QueueItem = chromeCast.media.QueueItem;

      if (queue && queue.length > 0 && QueueLoadRequest && QueueItem && session.queueLoad) {
        const items = queue.map((entry) => {
          const queueItem = new QueueItem(mediaFor(entry));
          if (entry.startTime) queueItem.startTime = entry.startTime;
          return queueItem;
        });
        const request = new QueueLoadRequest(items);
        request.startIndex = 0;
        if (chromeCast.media.RepeatMode) request.repeatMode = chromeCast.media.RepeatMode.OFF;
        await session.queueLoad(request);
        s.setCastQueue(0, queue.length);
      } else {
        const first = Array.isArray(src) ? src[0] : src;
        const contentId = v?.currentSrc || (typeof first === 'string' ? first : first?.src ?? '');
        const contentType = typeof first === 'string' ? 'video/mp4' : (first?.type ?? 'video/mp4');
        const info = mediaFor({ src: contentId, type: contentType, title, poster, subtitles });
        const request = new chromeCast.media.LoadRequest(info);
        request.currentTime = v?.currentTime ?? 0;
        if (s.selectedSubtitle !== null) request.activeTrackIds = [s.selectedSubtitle + 1];
        await session.loadMedia(request);
        s.setCastQueue(0, 0);
      }

      sessionRef.current = session.getMediaSession?.() ?? null;
      v?.pause();
    } catch (error) {
      // `cancel` is what the SDK reports when the picker is dismissed — not a failure.
      const code = (error as { code?: string } | undefined)?.code;
      if (code && code !== 'cancel') {
        s.setCastState('error');
        s.setCastError('Could not start casting to that device.');
      }
    }
  }, [storeApi, src, title, poster, subtitles, queue, videoRef]);

  const step = useCallback((direction: 'next' | 'previous') => {
    const media = sessionRef.current;
    const s = storeApi.getState();
    if (!media || s.castQueueLength === 0) return;
    const move = direction === 'next' ? media.queueNext : media.queuePrev;
    const delta = direction === 'next' ? 1 : -1;
    const target = Math.max(0, Math.min(s.castQueueLength - 1, s.castQueueIndex + delta));
    try {
      move.call(media, () => s.setCastQueue(target, s.castQueueLength), () => {});
    } catch { /* receiver refused */ }
  }, [storeApi]);

  const next = useCallback(() => step('next'), [step]);
  const previous = useCallback(() => step('previous'), [step]);

  return { toggleCast, next, previous };
}
