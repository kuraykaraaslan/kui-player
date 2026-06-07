import { createContext } from 'react';
import type { VideoPlayerEngine } from '../modules/videoplayer/videoplayer.engine';

export const VideoPlayerEngineContext = createContext<VideoPlayerEngine | null>(null);
