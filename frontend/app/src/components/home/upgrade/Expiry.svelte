<script lang="ts">
    import type { DiamondMembershipDuration, OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import { now } from "../../../stores/time";
    import { _, locale } from "svelte-i18n";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { diamondStatus } from "openchat-client";

    const client = getContext<OpenChat>("client");

    export let extendBy: DiamondMembershipDuration | undefined = undefined;

    $: extendByMs = durationToMs(extendBy);

    let expiresIn: string | undefined = undefined;
    let expiresAt: string | undefined = undefined;
    let extendTo: string | undefined = undefined;

    $: {
        if ($diamondStatus.kind === "active") {
            expiresIn = client.diamondExpiresIn($now, $locale);

            if (extendBy !== "lifetime") {
                const expiresAtMs = Number($diamondStatus.expiresAt);
                expiresAt = client.toDateString(new Date(expiresAtMs));
                if (extendByMs !== undefined) {
                    extendTo = client.toDateString(new Date(expiresAtMs + extendByMs));
                }
            } else {
                extendTo = $_("upgrade.lifetime");
            }
        }
    }

    function durationToMs(duration: DiamondMembershipDuration | undefined): number | undefined {
        if (duration !== undefined && duration !== "lifetime") {
            return client.diamondDurationToMs(duration);
        }
        return undefined;
    }
</script>

{#if $diamondStatus.kind !== "inactive"}
    <p class="expiry">
        <span class="msg">
            <Translatable resourceKey={i18nKey("upgrade.expiryMessage", { relative: expiresIn })} />
        </span>
        <span class="date">
            ({expiresAt}).
        </span>

        {#if extendTo !== undefined}
            <span class="msg">
                {$_("upgrade.extendTo")}
            </span>
            <span class="date">
                {extendTo}.
            </span>
        {/if}
    </p>
{/if}

<style lang="scss">
    .expiry {
        @include font(book, normal, fs-90);
        margin-bottom: $sp4;

        .date {
            color: var(--primary);
        }
    }
</style>
