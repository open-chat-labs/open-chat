<script lang="ts">
    import type { ResourceKey } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { translatable } from "../actions/translatable";
    import { interpolate } from "../i18n/i18n";

    interface Props {
        resourceKey: ResourceKey;
    }

    let { resourceKey }: Props = $props();
</script>

<span use:translatable={{ key: resourceKey }}>
    {interpolate($_, resourceKey)}
</span>
