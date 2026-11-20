<!-- Create group's Access gates, Rules or Permissions (native plan 11), pushed from its Settings
     card: Manage's pages (GatesPage, RulesPage, PermissionsPage) on the draft Create group holds
     (newGroupDraft), so what's set here is created with the group. Nothing to save: Done (and
     Back) goes back to the Details with it (TODO(design): the plan doesn't say). -->
<script lang="ts">
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import { onDestroy } from "svelte";
    import { _ } from "svelte-i18n";
    import { aboveKeyboard } from "../../aboveKeyboard.svelte";
    import type { NativeScreen } from "../../router/locations";
    import type { ScreenProps } from "../app/screens";
    import GatesPage from "./GatesPage.svelte";
    import { newGroupDraft } from "./newGroupDraft.svelte";
    import PermissionsPage from "./PermissionsPage.svelte";
    import RulesPage from "./RulesPage.svelte";
    import { pageTitle } from "./settings.adapter";

    let { screen, context }: ScreenProps<Extract<NativeScreen, { kind: "new_group_settings" }>> =
        $props();

    const t = (key: string, values?: Record<string, string | number>) => $_(key, { values });

    // Create group's, open under this screen, which knows it's covered while this is open (so
    // Android's back closes this page, not a step of Create group's under it)
    const draft = newGroupDraft();
    const editor = draft?.editor;
    if (draft !== undefined) onDestroy(draft.openPage());
</script>

<div class="new-group-settings">
    <NativePageHeader title={pageTitle(screen.page, false, t)} onBack={context.back} />

    {#if editor !== undefined}
        <div class="body" {@attach aboveKeyboard()}>
            {#if screen.page === "gates"}
                <GatesPage {editor} {context} />
            {:else if screen.page === "rules"}
                <RulesPage {editor} />
            {:else}
                <PermissionsPage {editor} readOnly={false} />
            {/if}
        </div>

        <div class="footer">
            <Button
                label={$_("native.groupSettings.create.done")}
                size="lg"
                fullWidth
                onClick={() => context.back?.()} />
        </div>
    {/if}
</div>

<style lang="scss">
    .new-group-settings {
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
        padding-bottom: var(--space-24);
    }

    .footer {
        flex: none;
        padding: 12px var(--space-16) var(--bar-end);
    }
</style>
