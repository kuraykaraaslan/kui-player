import { createContext } from 'react';
import type { VideoPlayerEngine } from '../modules/videoplayer/videoplayer.engine.js';

export const VideoPlayerEngineContext = createContext<VideoPlayerEngine | null>(null);
