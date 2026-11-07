<!-- The You tab (native design notes §3.11, §3.10's CHIT card): the cover with Share and Edit, the
     88px avatar, the name with the Diamond pill and the @username, the CHIT card (balance, streak,
     today's claim) while CHIT is on, About (bio, the user ID to copy, member since), the Account
     and Settings lists, and Sign out. Edit profile and the settings pages are pushed over it;
     Diamond and CHIT's settings have URLs (the web's ?diamond and ?profile=chit). -->
<script lang="ts">
    import {
        allUsersStore,
        buildUserAvatarUrl,
        buildUserBackgroundUrl,
        chitStateStore,
        currentStreak,
        currentUserIdStore,
        currentUserProfileStore,
        diamondStatusStore,
        latestSuccessfulUpdatesLoop,
        notificationStatus,
        referralLink,
        storageStore,
        toMonthYearString,
        type OpenChat,
    } from "@client";
    import { copyText } from "@openchat/ui/src/lib/clipboard";
    import Confetti from "@openchat/ui/src/lib/components/Confetti.svelte";
    import Pill from "@openchat/ui/src/lib/components/Pill.svelte";
    import { haptic } from "@openchat/ui/src/native/haptics";
    import NativeAlert from "@openchat/ui/src/native/NativeAlert.svelte";
    import SettingsAction from "@openchat/ui/src/native/SettingsAction.svelte";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
    import SettingsLink from "@openchat/ui/src/native/SettingsLink.svelte";
    import { dailyClaim } from "@src/logic/chit/dailyClaim";
    import { themePrefOf } from "@src/logic/profile/appearance";
    import { notificationSwitch } from "@src/logic/profile/notifications";
    import { disableChit } from "@src/stores/settings";
    import { now500 } from "@src/stores/time";
    import { blobUrlPattern } from "@src/utils/openchatClient";
    import { navigate } from "@src/utils/navigation";
    import { shareLink } from "@src/utils/share";
    import { accentStore } from "@theme/accent";
    import { themeType } from "@theme/themes";
    import { getContext, onDestroy, onMount, untrack } from "svelte";
    import { _, locale } from "svelte-i18n";
    import {
        CHIT_SETTINGS_URL,
        DIAMOND_URL,
        type NativeScreen,
    } from "../../router/locations";
    import { useOverlay } from "../../shell/overlays.svelte";
    import type { ScreenProps } from "../app/screens";
    import { isDiamond, youLists, type YouRowId } from "./you.adapter";

    let { context }: ScreenProps<Extract<NativeScreen, { kind: "you" }>> = $props();

    const client = getContext<OpenChat>("client");
    const overlays = untrack(() => context.overlays);

    // as it may have changed on another device since sign-in
    onMount(() => client.refreshCurrentUserProfile());

    const userId = $derived($currentUserIdStore);
    const user = $derived($allUsersStore.get(userId));
    const profile = $derived($currentUserProfileStore);
    const name = $derived(profile.displayName ?? user?.displayName ?? profile.username);
    const avatarUrl = $derived(buildUserAvatarUrl(blobUrlPattern, userId, profile.avatarId));
    const coverUrl = $derived(
        buildUserBackgroundUrl(blobUrlPattern, userId, profile.backgroundId),
    );
    const memberSince = $derived(
        profile.created > 0n
            ? toMonthYearString(new Date(Number(profile.created)), $locale ?? "en")
            : "",
    );

    const t = (key: string, values?: Record<string, string | number>) => $_(key, { values });

    const lists = $derived(
        youLists(
            {
                diamond: $diamondStatusStore,
                chitOn: !$disableChit,
                theme: themePrefOf($themeType),
                accent: $accentStore,
                notifications: notificationSwitch($notificationStatus),
                storageBytes: $storageStore.bytesUsed,
            },
            t,
        ),
    );

    function open(id: YouRowId) {
        switch (id) {
            case "edit_profile":
                context.push({ kind: "edit_profile" });
                return;
            case "diamond":
                navigate(DIAMOND_URL);
                return;
            case "chit":
                navigate(CHIT_SETTINGS_URL);
                return;
            default:
                context.push({ kind: "settings", page: id });
        }
    }

    function share() {
        shareLink(referralLink(client.canonicalOrigin(), userId));
    }

    // ---- CHIT: the balance and streak (the user's own, kept up to date as they claim), and today's
    // claim (logic/chit/dailyClaim, as the web's CHIT dialog), known once the first sync is in

    const streak = $derived(currentStreak($chitStateStore, $now500));
    const claim = $derived(
        $disableChit
            ? undefined
            : dailyClaim({
                  chit: $chitStateStore,
                  lastSync: $latestSuccessfulUpdatesLoop,
                  disabled: $disableChit,
                  now: $now500,
              }),
    );
    let claiming = $state(false);
    let burst = $state(0);

    // a claim already made (on another device) just moves the countdown on: the client does it
    async function claimToday() {
        if (claim === undefined || !claim.claimable || claiming) return;
        claiming = true;
        try {
            const resp = await client.claimDailyChit();
            if (resp.kind === "success") {
                burst++;
                haptic("light");
            }
        } catch (err) {
            console.warn("Unable to claim the daily CHIT", err);
            context.toast($_("dailyChit.failedToClaim"));
        } finally {
            claiming = false;
        }
    }

    // ---- the user ID: tokens sent to it are lost, so copying it warns first (#10338)

    let copyWarning = $state(false);
    useOverlay(
        overlays,
        () => copyWarning,
        () => (copyWarning = false),
    );
    let copied = $state(false);
    let copiedTimer: ReturnType<typeof setTimeout> | undefined;
    onDestroy(() => clearTimeout(copiedTimer));

    async function copyUserId() {
        copyWarning = false;
        if (!(await copyText(userId))) return;
        copied = true;
        clearTimeout(copiedTimer);
        copiedTimer = setTimeout(() => (copied = false), 1600);
        context.toast($_("userIdCopiedToClipboard"));
    }
</script>

<div class="you" data-confetti-within>
    <div class="scroll">
        <div
            class="cover"
            class:image={coverUrl !== undefined}
            style:background-image={coverUrl !== undefined ? `url("${coverUrl}")` : undefined}>
            <button
                type="button"
                class="cover-button share"
                aria-label={$_("native.you.shareProfile")}
                onclick={share}>
                <span class="cover-icon share-icon"></span>
            </button>
            <button
                type="button"
                class="cover-button edit"
                aria-label={$_("native.you.editProfile.title")}
                onclick={() => open("edit_profile")}>
                <span class="cover-icon edit-icon"></span>
            </button>
        </div>

        <div class="content">
            <div class="identity">
                <img class="avatar" src={avatarUrl} alt="" />
                <div class="names">
                    <span class="name">
                        <span class="name-text">{name}</span>
                        {#if isDiamond($diamondStatusStore)}
                            <Pill size="md" label="Diamond" tone="accent" />
                        {/if}
                    </span>
                    <span class="username">@{profile.username}</span>
                </div>
            </div>

            {#if !$disableChit}
                <section class="chit-card" aria-label="CHIT">
                    <button type="button" class="chit-head" onclick={() => context.push({ kind: "chit" })}>
                        <span class="chit-tile"><span class="chit-tile-icon"></span></span>
                        <span class="chit-balance">
                            <span class="chit-amount">{$chitStateStore.chitBalance.toLocaleString($locale ?? "en")}</span>
                            <span class="chit-unit">CHIT</span>
                        </span>
                        <span class="streak">
                            <span class="streak-icon"></span>
                            {$_("native.you.chit.streak", { values: { count: streak } })}
                        </span>
                    </button>
                    {#if claim !== undefined}
                        <button
                            type="button"
                            class="chit-row"
                            class:claimable={claim.claimable}
                            aria-disabled={!claim.claimable || claiming}
                            onclick={claimToday}>
                            <span class="claim-icon"></span>
                            <span class="claim-text">
                                {$_("native.you.chit.dailyClaim")}
                                <span class="claim-sub">
                                    · {claim.claimable
                                        ? $_("native.you.chit.pays", { values: { amount: claim.daily } })
                                        : $_("native.you.chit.next", { values: { time: claim.countdown } })}
                                </span>
                            </span>
                            <span class="claim-label">
                                {claim.claimable ? $_("native.you.chit.claim") : $_("native.you.chit.claimed")}
                                <span class="confetti" aria-hidden="true">
                                    <Confetti fire={burst} within="[data-confetti-within]" />
                                </span>
                            </span>
                        </button>
                    {/if}
                </section>
            {/if}

            <SettingsGroup label={$_("native.you.about")}>
                {#if profile.bio !== ""}
                    <p class="settings-row bio">{profile.bio}</p>
                {/if}
                <div class="settings-row id-row">
                    <span class="id-text">
                        <span class="id-label">{$_("native.you.userId")}</span>
                        <span class="id-value">{userId}</span>
                    </span>
                    <button
                        type="button"
                        class="copy"
                        class:copied
                        aria-label={$_("native.you.copyUserId")}
                        onclick={() => (copyWarning = true)}>
                        <span class="copy-icon"></span>
                    </button>
                </div>
                {#if memberSince !== ""}
                    <div class="settings-row since">
                        <span class="since-label">{$_("native.you.memberSince")}</span>
                        <span class="since-value">{memberSince}</span>
                    </div>
                {/if}
            </SettingsGroup>

            <SettingsGroup label={$_("native.you.account.title")}>
                {#each lists.account as row (row.id)}
                    <SettingsLink
                        icon={row.icon}
                        label={row.label}
                        value={row.value}
                        onClick={() => open(row.id)} />
                {/each}
            </SettingsGroup>

            <SettingsGroup label={$_("native.you.settings")}>
                {#each lists.settings as row (row.id)}
                    <SettingsLink
                        icon={row.icon}
                        label={row.label}
                        value={row.value}
                        onClick={() => open(row.id)} />
                {/each}
            </SettingsGroup>

            <SettingsGroup>
                <SettingsAction
                    icon="exit"
                    label={$_("logout")}
                    danger
                    onClick={() => client.logout()} />
            </SettingsGroup>
        </div>
    </div>
</div>

<NativeAlert
    open={copyWarning}
    title={$_("userIdCopyWarning.title")}
    message={$_("userIdCopyWarning.message")}
    confirmLabel={$_("userIdCopyWarning.confirm")}
    cancelLabel={$_("cancel")}
    onConfirm={copyUserId}
    onClose={() => (copyWarning = false)} />

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .you {
        position: relative;
        height: 100%;
        min-height: 0;
    }

    .scroll {
        height: 100%;
        overflow-y: auto;
        scrollbar-width: none;
    }

    // under the status bar, 132px below it (the prototype's 186px on iOS)
    .cover {
        position: relative;
        height: calc(var(--safe-top) + 132px);
        background: linear-gradient(
            140deg,
            var(--accent) 0%,
            color-mix(in oklch, var(--accent) 40%, var(--hero-base)) 100%
        );

        &.image {
            background-position: center;
            background-size: cover;
            background-repeat: no-repeat;
        }
    }

    .cover-button {
        position: absolute;
        top: calc(var(--safe-top) + 6px);
        width: var(--touch-target);
        height: var(--touch-target);
        @include flex-center;
        padding: 0;
        border: 0;
        border-radius: var(--radius-circle);
        background: var(--surface-0);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:focus-visible {
            @include focus-ring;
        }

        &.share {
            inset-inline-end: calc(var(--touch-target) + 16px);
        }

        &.edit {
            inset-inline-end: 8px;
        }
    }

    .share-icon {
        @include icon(share, 19px, var(--ink));
    }

    .edit-icon {
        @include icon(edit, 19px, var(--ink));
    }

    .content {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 20px;
        margin-top: -44px;
        padding: 0 var(--space-16) 48px;
    }

    .identity {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .avatar {
        width: 88px;
        height: 88px;
        border-radius: var(--radius-circle);
        object-fit: cover;
        background: var(--surface-0);
        box-shadow: 0 0 0 4px var(--surface-0);
    }

    .names {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
    }

    .name {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
    }

    .name-text {
        min-width: 0;
        font: 800 text-size(24px) / 1.15 var(--font-sans);
        letter-spacing: -0.01em;
        overflow-wrap: anywhere;
    }

    .username {
        font: var(--weight-medium) text-size(13.5px) / 1 var(--font-mono);
        color: var(--ink-4);
        overflow-wrap: anywhere;
    }

    // ---- the CHIT card: an accent hero (native design notes §1 Surfaces)

    .chit-card {
        display: flex;
        flex-direction: column;
        border-radius: 20px;
        overflow: hidden;
        background: linear-gradient(
            150deg,
            color-mix(in oklch, var(--accent) 26%, var(--hero-base)) 0%,
            var(--hero-base) 75%
        );
        box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent) 30%, transparent);
    }

    .chit-head,
    .chit-row {
        display: flex;
        align-items: center;
        border: 0;
        color: var(--ink);
        text-align: start;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:focus-visible {
            @include focus-ring;
        }
    }

    .chit-head {
        gap: 14px;
        padding: 18px;
        background: none;
    }

    .chit-tile {
        flex: none;
        width: 44px;
        height: 44px;
        @include flex-center;
        border-radius: 14px;
        background: var(--accent);
        box-shadow: 0 6px 18px color-mix(in oklch, var(--accent) 45%, transparent);
    }

    .chit-tile-icon {
        @include icon(zap, 22px, var(--on-accent));
    }

    .chit-balance {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: baseline;
        gap: 6px;
    }

    .chit-amount {
        font: 800 text-size(24px) / 1 var(--font-mono);
        letter-spacing: -0.02em;
    }

    .chit-unit {
        font: var(--weight-semibold) text-size(12px) / 1 var(--font-mono);
        letter-spacing: 0.09em;
        color: var(--ink-3);
    }

    .streak {
        flex: none;
        display: flex;
        align-items: center;
        gap: 5px;
        height: 28px;
        padding: 0 10px;
        border-radius: 14px;
        background: var(--tint-pill);
        font: var(--weight-semibold) text-size(12.5px) / 1 var(--font-sans);
        color: var(--ink-2);
    }

    .streak-icon {
        @include icon(flame, 14px, var(--status-chit));
    }

    .chit-row {
        gap: 8px;
        min-height: var(--touch-target);
        padding: 16px 18px;
        background: var(--tint-row);

        &[aria-disabled="true"] {
            cursor: default;
        }
    }

    .claim-icon {
        @include icon(zap, 18px, var(--ink-4));

        .claimable & {
            background: var(--status-chit);
        }
    }

    .claim-text {
        flex: 1;
        min-width: 0;
        font: var(--weight-semibold) text-size(13.5px) / 1.2 var(--font-sans);
    }

    .claim-sub {
        font-weight: var(--weight-medium);
        color: var(--ink-3);
    }

    .claim-label {
        position: relative;
        font: var(--weight-bold) text-size(13px) / 1 var(--font-sans);
        color: var(--ink-4);

        .claimable & {
            color: var(--accent-bright);
        }
    }

    // the burst comes from the label's middle
    .confetti {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 0;
        height: 0;
        pointer-events: none;
    }

    // ---- About: rows in the kit's card (its dividers come with .settings-row)

    .bio {
        margin: 0;
        padding: 14px 16px;
        font: var(--weight-regular) text-size(14.5px) / 1.5 var(--font-sans);
        color: var(--ink-2);
        text-wrap: pretty;
        overflow-wrap: anywhere;
        white-space: pre-line;
    }

    .id-row {
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 56px;
        padding: 8px 8px 8px 16px;
        box-sizing: border-box;
    }

    .id-text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .id-label {
        font: var(--weight-medium) var(--text-xs) / 1 var(--font-mono);
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: var(--ink-4);
    }

    .id-value {
        font: var(--weight-medium) text-size(13.5px) / 1.2 var(--font-mono);
        @include truncate;
    }

    .copy {
        flex: none;
        width: var(--touch-target);
        height: var(--touch-target);
        @include flex-center;
        padding: 0;
        border: 0;
        border-radius: 12px;
        background: none;
        color: var(--ink-3);
        cursor: pointer;

        &.copied {
            color: var(--status-online);
        }

        &:focus-visible {
            @include focus-ring;
        }
    }

    .copy-icon {
        @include icon(copy, 18px);

        .copied & {
            mask: var(--icon-check) center/contain no-repeat;
        }
    }

    .since {
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 52px;
        padding: 0 16px;
    }

    .since-label {
        flex: 1;
        font: var(--weight-medium) text-size(14px) / 1.2 var(--font-sans);
        color: var(--ink-3);
    }

    .since-value {
        font: var(--weight-semibold) text-size(14px) / 1.2 var(--font-sans);
    }
</style>
