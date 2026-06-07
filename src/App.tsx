import { VideoPlayer } from '../react';

const DEMO_SRC = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
const DEMO_POSTER = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg';

export default function App() {
  return (
    <div className="min-h-screen bg-surface-base p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold text-text-primary">
          @kuraykaraaslan/kui-videoplayer — dev
        </h1>

        <div>
          <h2 className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wider">Basic</h2>
          <VideoPlayer
            src={DEMO_SRC}
            poster={DEMO_POSTER}
            title="Big Buck Bunny"
            qualities={[
              { label: '1080p', value: '1080' },
              { label: '720p', value: '720' },
              { label: '480p', value: '480' },
            ]}
            defaultQuality="720"
            onQualityChange={(v) => console.log('quality:', v)}
          />
        </div>

        <div>
          <h2 className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wider">No Cast / AutoHide off</h2>
          <VideoPlayer
            src={DEMO_SRC}
            title="No auto-hide controls"
            enableCast={false}
            autoHideControls={false}
          />
        </div>
      </div>
    </div>
  );
}
