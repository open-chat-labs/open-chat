<script lang="ts">
    import type { ResourceKey } from "@client";
    import { _ } from "svelte-i18n";
    import { translatable } from "../actions/translatable";
    import { interpolate } from "../i18n/i18n";

    interface Props {
        resourceKey: ResourceKey;
        inline?: boolean;
    }

    let { resourceKey, inline = false }: Props = $props();
</script>

<span use:translatable={{ key: resourceKey }} style={inline ? "display:inline;" : ""}>
    {interpolate($_, resourceKey)}
</span>
