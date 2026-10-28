<script lang="ts">
  // A page section that provides one presence group to the players below it.
  import { kuiPlayer, providePresenceGroup } from '../../../wrappers/svelte/kuiPlayer';
  import Tile from './PresenceTile.svelte';

  let { count = 3, group, everyMs, graceMs, prompt, locale, adapters, onAsk, onTimeout } = $props();

  providePresenceGroup({ group, everyMs, graceMs, prompt, locale });
</script>

{#each Array.from({ length: count }, (_, i) => i) as i (i)}
  <Tile {i} {adapters} {onAsk} {onTimeout} />
{/each}
<video data-testid="outsider" use:kuiPlayer={{ presence: false }}></video>
