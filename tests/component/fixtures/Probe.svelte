<script lang="ts">
  import { getPresenceGroup } from '../../../wrappers/svelte/kuiPlayer';
  let { onGroup } = $props();
  onGroup(getPresenceGroup());
</script>
