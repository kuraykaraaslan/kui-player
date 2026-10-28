<script lang="ts">
  import { setPresenceGroup } from '../../../wrappers/svelte/kuiPlayer';
  import Probe from './Probe.svelte';
  let { group, onGroup } = $props();
  setPresenceGroup(group);
</script>

<Probe {onGroup} />
