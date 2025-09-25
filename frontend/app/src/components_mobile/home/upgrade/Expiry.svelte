<script lang="ts">
    import {
        diamondStatusStore,
        type DiamondMembershipDuration,
        type DiamondMembershipStatus,
        type OpenChat,
    } from "openchat-client";
    import { getContext, untrack } from "svelte";
    import { _, locale } from "svelte-i18n";
    import { i18nKey } from "../../../i18n/i18n";
    import { now500 } from "../../../stores/time";
    import Translatable from "../../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        extendBy?: DiamondMembershipDuration | undefined;
    }

    let { extendBy = undefined }: Props = $props();

    let expiresIn: string | undefined = $state(undefined);
    let expiresAt: string | undefined = $state(undefined);
    let extendTo: string | undefined = $state(undefined);

    function durationToMs(duration: DiamondMembershipDuration | undefined): number | undefined {
        if (duration !== undefined && duration !== "lifetime") {
            return client.diamondDurationToMs(duration);
        }
        return undefined;
    }
    let extendByMs = $derived(durationToMs(extendBy));
    $effect(() => {
        refresh($diamondStatusStore, $now500, $locale);
    });

    function refresh(
        status: DiamondMembershipStatus,
        now: number,
        locale: string | null | undefined,
    ) {
        untrack(() => {
            if (status.kind === "active") {
                expiresIn = client.diamondExpiresIn(now, locale);

                if (extendBy !== "lifetime") {
                    const expiresAtMs = Number(status.expiresAt);
                    expiresAt = client.toDateString(new Date(expiresAtMs));
                    if (extendByMs !== undefined) {
                        extendTo = client.toDateString(new Date(expiresAtMs + extendByMs));
                    }
                } else {
                    extendTo = $_("upgrade.lifetime");
                }
            }
        });
    }
</script>

{#if $diamondStatusStore.kind !== "inactive"}
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
