<script lang="ts">
    import type { OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";

    const client = getContext<OpenChat>("client");

    export let ttl: bigint | undefined;
</script>

{#if ttl !== undefined}
    <div class="disappearing">
        <h4>
            {$_("disappearingMessages.label")}
        </h4>
        <p>
            {$_("disappearingMessages.summary", {
                values: {
                    duration: client.formatDuration(Number(ttl)),
                },
            })}
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
