<script lang="ts">
    import type { OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";

    const client = getContext<OpenChat>("client");

    interface Props {
        ttl: bigint | undefined;
    }

    let { ttl }: Props = $props();
</script>

{#if ttl !== undefined}
    <div class="disappearing">
        <h4>
            <Translatable resourceKey={i18nKey("disappearingMessages.label")} />
        </h4>
        <p>
            <Translatable
                resourceKey={i18nKey("disappearingMessages.summary", {
                    duration: client.formatDuration(Number(ttl)),
                })} />
        </p>
    </div>
{/if}

<style lang="scss">
    .disappearing {
        margin-bottom: $sp4;
        h4 {
            margin-bottom: $sp3;
        }
        p {
            @include font(light, normal, fs-90);
        }
    }
</style>
