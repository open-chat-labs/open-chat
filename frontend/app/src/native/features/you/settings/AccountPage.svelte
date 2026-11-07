<!-- You → Account (native design notes §3.11): the sign-in methods linked to the account, Report an
     issue (OpenChat's bug report channel, as the old toasts' "report a bug") and Delete account,
     which asks first (a small alert) and then for a sign-in again (DeleteAccountSheet). The
     recovery phrase isn't here: the backend has none (GAPS.md). Linking and unlinking sign-in
     methods is on the website's profile for now (GAPS.md). -->
<script lang="ts">
    import {
        routeForChatIdentifier,
        signInLastUsed,
        type LinkedAuthenticationPrincipal,
        type OpenChat,
    } from "@client";
    import NativeAlert from "@openchat/ui/src/native/NativeAlert.svelte";
    import SettingsAction from "@openchat/ui/src/native/SettingsAction.svelte";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
    import { interpolate } from "@src/i18n/i18n";
    import { navigate } from "@src/utils/navigation";
    import { BUG_REPORT_CHANNEL } from "@src/utils/support";
    import { getContext, onMount, untrack } from "svelte";
    import { _, locale } from "svelte-i18n";
    import { useOverlay } from "../../../shell/overlays.svelte";
    import type { ScreenContext } from "../../app/screens";
    import { signInMethodRows } from "../you.adapter";
    import DeleteAccountSheet from "./DeleteAccountSheet.svelte";

    let { context }: { context: ScreenContext } = $props();
    const overlays = untrack(() => context.overlays);

    const client = getContext<OpenChat>("client");

    // the identities linked to the account, loaded as the page opens
    let linked = $state<LinkedAuthenticationPrincipal[]>();
    onMount(async () => {
        try {
            linked = await client.getAuthenticationPrincipals();
        } catch (err) {
            console.warn("Unable to load the sign-in methods", err);
            linked = [];
        }
    });

    const methods = $derived(
        signInMethodRows(
            linked ?? [],
            (key) => $_(key),
            (lastUsed) => interpolate($_, signInLastUsed(lastUsed, $locale ?? "en")),
        ),
    );

    // ---- deleting: a confirmation, then signing in again (a sheet mounted again each time)

    type Deleting = "none" | "confirm" | "sign_in";
    let deleting = $state<Deleting>("none");
    let sheetKey = $state(0);
    useOverlay(
        overlays,
        () => deleting !== "none",
        () => (deleting = "none"),
    );

    function confirmed() {
        sheetKey++;
        deleting = "sign_in";
    }
</script>

<SettingsGroup label={$_("native.you.account.signedInWith")} note={$_("native.you.account.methodsNote")}>
    {#if linked === undefined}
        <div class="settings-row method"><span class="label">…</span></div>
    {:else}
        {#each methods as method (method.id)}
            <div class="settings-row method">
                <span class="label">{method.label}</span>
                {#if method.value !== ""}<span class="value">{method.value}</span>{/if}
            </div>
        {/each}
    {/if}
</SettingsGroup>

<SettingsGroup>
    <SettingsAction
        icon="warning"
        label={$_("native.you.account.reportIssue")}
        onClick={() => navigate(routeForChatIdentifier("community", BUG_REPORT_CHANNEL))} />
    <SettingsAction
        icon="trash"
        label={$_("danger.deleteAccount")}
        danger
        onClick={() => (deleting = "confirm")} />
</SettingsGroup>

<NativeAlert
    open={deleting === "confirm"}
    title={$_("native.you.account.deleteTitle")}
    message={$_("native.you.account.deleteMessage")}
    confirmLabel={$_("native.you.account.deleteContinue")}
    cancelLabel={$_("cancel")}
    danger
    onConfirm={confirmed}
    onClose={() => (deleting = "none")} />

{#key sheetKey}
    {#if sheetKey > 0}
        <DeleteAccountSheet open={deleting === "sign_in"} onClose={() => (deleting = "none")} />
    {/if}
{/key}

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .method {
        display: flex;
        align-items: center;
        gap: 14px;
        min-height: 60px;
        padding: 10px 16px;
        box-sizing: border-box;
    }

    .label {
        flex: 1;
        min-width: 0;
        font: var(--weight-medium) text-size(15px) / 1.2 var(--font-sans);
        overflow-wrap: anywhere;
    }

    .value {
        flex: none;
        max-width: 50%;
        font: var(--weight-medium) text-size(13px) / 1.2 var(--font-sans);
        color: var(--ink-3);
        text-align: end;
    }
</style>
