// `prepare` runs on `npm install` from a git URL (no npm release yet): the published files
// (`dist/`) are not in the repository, so a git install builds them once. A checkout that has
// already built (`dist/index.js` exists) skips this, so local installs stay fast.
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

if (existsSync(new URL('../dist/index.js', import.meta.url))) process.exit(0);
// Each step through npm, which is always there; `pnpm build` itself calls pnpm.
for (const step of ['build:js', 'build:types', 'build:css', 'build:embed']) {
  execSync(`npm run ${step}`, { stdio: 'inherit' });
}
