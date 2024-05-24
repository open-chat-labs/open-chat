<script lang="ts">
    import { _ } from "svelte-i18n";
    import { interpolate } from "../i18n/i18n";
    import { translatable } from "../actions/translatable";
    import type { ResourceKey } from "openchat-client";

    export let resourceKey: ResourceKey;
</script>

<span use:translatable={{ key: resourceKey }}>
    {interpolate($_, resourceKey)}
</span>
