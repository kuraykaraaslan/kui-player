import { ensureTestVideo } from './fixtures/video';

export default async function globalSetup() {
  try {
    await ensureTestVideo();
  } catch (error) {
    // The specs that need the video skip themselves when it is missing.
    console.warn(`[e2e] could not generate the test video: ${String(error)}`);
  }
}
