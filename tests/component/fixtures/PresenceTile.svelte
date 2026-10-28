<script lang="ts">
  // A child that picks the group up from context, as a camera tile would.
  import { kuiPlayer, getPresenceGroup } from '../../../wrappers/svelte/kuiPlayer';

  let { i, onAsk, onTimeout } = $props();
  const presence = getPresenceGroup() ?? undefined;
</script>

<video
  data-testid="tile"
  src={`https://example.com/${i}.mp4`}
  use:kuiPlayer={{
    presence,
    on: { 'presence:ask': (e: unknown) => onAsk?.(e), 'presence:timeout': (e: unknown) => onTimeout?.(e) },
  }}
></video>
