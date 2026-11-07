<!-- Diamond (native design notes §3.11; the web's ?diamond), pushed over the You tab: the
     membership in an accent hero (Lifetime, until when, or none yet), what Diamond gives, the
     user's invite link to share, and the pinned Upgrade to Diamond (Extend Diamond while one runs).
     Paying isn't here yet: it's paid from the wallet with the PIN (N10b's sheet), through the
     shared payment the web's Diamond dialog uses (logic/diamond), so the button says so in a small
     alert meanwhile (GAPS.md). An app store build has no Diamond payments, and no button. -->
<script lang="ts">
    import {
        currentUserIdStore,
        diamondStatusStore,
        referralLink,
        toDayString,
        type OpenChat,
    } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import NativeAlert from "@openchat/ui/src/native/NativeAlert.svelte";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
    import { disableDiamondPaymentFeature } from "@src/utils/features";
    import { shareLink } from "@src/utils/share";
    import { getContext, untrack } from "svelte";
    import { _, locale } from "svelte-i18n";
    import type { NativeScreen } from "../../router/locations";
    import { useOverlay } from "../../shell/overlays.svelte";
    import type { ScreenProps } from "../app/screens";
    import { DIAMOND_PERKS, diamondAction } from "./you.adapter";

    let { context }: ScreenProps<Extract<NativeScreen, { kind: "diamond" }>> = $props();

    const client = getContext<OpenChat>("client");

    const status = $derived($diamondStatusStore);
    const title = $derived(
        status.kind === "lifetime"
            ? "native.you.diamond.lifetimeTitle"
            : status.kind === "active"
              ? "native.you.diamond.activeTitle"
              : "native.you.diamond.inactiveTitle",
    );
    const sub = $derived(
        status.kind === "lifetime"
            ? $_("native.you.diamond.neverExpires")
            : status.kind === "active"
              ? $_("native.you.diamond.until", {
                    values: { date: toDayString(new Date(Number(status.expiresAt)), $locale ?? "en") },
                })
              : $_("native.you.diamond.inactiveSub"),
    );

    // upgrading or extending: paid with the wallet's PIN sheet, which isn't built yet (N10b)
    const action = $derived(diamondAction(status, disableDiamondPaymentFeature));
    const actionLabel = $derived(action === "extend" ? "upgrade.extend" : "upgrade.featuresTitle");
    let buying = $state(false);
    useOverlay(
        untrack(() => context.overlays),
        () => buying,
        () => (buying = false),
    );

    const link = $derived(referralLink(client.canonicalOrigin(), $currentUserIdStore));
    const shownLink = $derived(link.replace(/^https?:\/\//, ""));
</script>

<div class="diamond">
    <NativePageHeader title="Diamond" onBack={context.back} />

    <div class="body" class:above-footer={action !== undefined}>
        <section class="hero">
            <span class="tile"><span class="tile-icon"></span></span>
            <span class="title">{$_(title)}</span>
            <span class="sub">{sub}</span>
        </section>

        <SettingsGroup label={$_("native.you.diamond.perks")}>
            {#each DIAMOND_PERKS as perk (perk.label)}
                <div class="settings-row perk">
                    <span class="perk-icon" style:mask="var(--icon-{perk.icon}) center/contain no-repeat"></span>
                    <span class="perk-text">
                        <span class="perk-label">{$_(perk.label)}</span>
                        <span class="perk-sub">{$_(perk.sub)}</span>
                    </span>
                </div>
            {/each}
        </SettingsGroup>

        <SettingsGroup label={$_("native.you.diamond.inviteLink")} note={$_("native.you.diamond.inviteNote")}>
            <div class="settings-row link-row">
                <span class="link">{shownLink}</span>
                <button
                    type="button"
                    class="share"
                    aria-label={$_("native.you.diamond.shareLink")}
                    onclick={() => shareLink(link)}>
                    <span class="share-icon"></span>
                </button>
            </div>
        </SettingsGroup>
    </div>

    {#if action !== undefined}
        <div class="footer">
            <Button label={$_(actionLabel)} size="lg" fullWidth onClick={() => (buying = true)} />
        </div>
    {/if}
</div>

<NativeAlert
    open={buying}
    title={$_(actionLabel)}
    message={$_("native.you.diamond.buySoon")}
    cancelLabel={$_("close")}
    onClose={() => (buying = false)} />

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .diamond {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: none;
        display: flex;
        flex-direction: column;
        gap: 22px;
        padding: 8px var(--space-16) var(--scroll-end);

        // the pinned button has the safe area
        &.above-footer {
            padding-bottom: var(--space-16);
        }
    }

    .footer {
        flex: none;
        padding: 12px var(--space-16) var(--bar-end);
    }

    // an accent hero (native design notes §1 Surfaces)
    .hero {
        flex: none;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        padding: 28px 20px 24px;
        border-radius: 20px;
        text-align: center;
        background: linear-gradient(
            150deg,
            color-mix(in oklch, var(--accent) 26%, var(--hero-base)) 0%,
            var(--hero-base) 75%
        );
        box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent) 30%, transparent);
    }

    .tile {
        width: 64px;
        height: 64px;
        @include flex-center;
        border-radius: 20px;
        background: var(--accent);
        box-shadow: 0 8px 22px color-mix(in oklch, var(--accent) 45%, transparent);
    }

    .tile-icon {
        @include icon(diamond, 32px, var(--on-accent));
    }

    .title {
        font: 800 text-size(22px) / 1.15 var(--font-sans);
    }

    .sub {
        font: var(--weight-medium) text-size(13.5px) / 1.4 var(--font-sans);
        color: var(--ink-3);
    }

    .perk {
        display: flex;
        align-items: center;
        gap: 14px;
        min-height: 60px;
        padding: 10px 16px;
        box-sizing: border-box;
    }

    .perk-icon {
        flex: none;
        width: 19px;
        height: 19px;
        background: var(--accent);
    }

    .perk-text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .perk-label {
        font: var(--weight-semibold) text-size(15px) / 1.2 var(--font-sans);
    }

    .perk-sub {
        font: var(--weight-medium) text-size(12.5px) / 1.35 var(--font-sans);
        color: var(--ink-3);
    }

    .link-row {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 60px;
        padding-block: 8px;
        padding-inline: 16px 4px;
        box-sizing: border-box;
    }

    .link {
        flex: 1;
        min-width: 0;
        font: var(--weight-medium) text-size(13.5px) / 1.3 var(--font-mono);
        @include truncate;
    }

    .share {
        flex: none;
        width: var(--touch-target);
        height: var(--touch-target);
        @include flex-center;
        padding: 0;
        border: 0;
        border-radius: var(--radius-circle);
        background: none;
        cursor: pointer;

        &:focus-visible {
            @include focus-ring;
        }
    }

    .share-icon {
        @include icon(share, 18px, var(--ink-3));
    }
</style>
