<script lang="ts">
    import type { DiamondMembershipDuration, OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import { now } from "../../../stores/time";
    import { _, locale } from "svelte-i18n";

    const client = getContext<OpenChat>("client");

    export let extendBy: DiamondMembershipDuration | undefined = undefined;

    $: diamondMembership = client.diamondMembership;
    $: extendByMs = durationToMs(extendBy);

    let expiresIn: string | undefined = undefined;
    let expiresAt: string | undefined = undefined;
    let extendTo: string | undefined = undefined;

    $: {
        if ($diamondMembership !== undefined) {
            const expiresAtMs = Number($diamondMembership.expiresAt);
            expiresIn = client.diamondExpiresIn($now, $locale);
            expiresAt = client.toDateString(new Date(expiresAtMs));

            if (extendByMs !== undefined) {
                extendTo = client.toDateString(new Date(expiresAtMs + extendByMs));
            }
        }
    }

    function durationToMs(duration: DiamondMembershipDuration | undefined): number | undefined {
        if (duration !== undefined) {
            return client.diamondDuraionToMs(duration);
        }
        return undefined;
    }
</script>

{#if $diamondMembership !== undefined}
    <p class="expiry">
        <span class="msg">
            {$_("upgrade.expiryMessage", { values: { relative: expiresIn } })}
        </span>
        <span class="date">
            ({expiresAt}).
        </span>

        {#if extendTo !== undefined}
            <span class="msg">
                {$_("upgrade.extendTo", { values: { date: extendTo } })}
            </span>
            <span class="date">
                {extendTo}
            </span>
        {/if}
    </p>
{/if}

<style type="text/scss">
    .expiry {
        @include font(book, normal, fs-90);
        margin-bottom: $sp4;

        .date {
            color: var(--primary);
        }
    }
</style>
