<!-- A group's or channel's settings (GroupSettingsDialog) on UpdateGroupState, as the old editors
     were: the parts the viewer's role can't change are read-only, and someone who can't edit the
     chat gets its About page (chatManageAccess). A change that has to be confirmed (renaming a
     verified group, changing who can see it) asks first; declining keeps the edits to change. -->
<script lang="ts">
    import {
        anonUserStore,
        candidateGroupFromChat,
        chatIdentifiersEqual,
        cryptoLookup,
        favouritesStore,
        isDiamondStore,
        nervousSystemLookup,
        publish,
        roleAsText,
        selectedChatRulesStore,
        selectedChatSummaryStore,
        selectedCommunitySummaryStore,
        type GroupChangeConfirmation,
        type MultiUserChat,
        type OpenChat,
        type ResourceKey,
    } from "@client";
    import GroupSettingsDialog, {
        type NameCheck,
    } from "@openchat/ui/src/features/components/GroupSettingsDialog.svelte";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import { modal } from "@openchat/ui/src/lib/behaviours/modal";
    import type { GroupSettings } from "@openchat/ui/src/lib/types";
    import { i18nKey, interpolate } from "@i18n/i18n";
    import { muteChat } from "@src/logic/chats/muteChat";
    import { chatManageAccess } from "@src/logic/groupOrCommunity/detailsPermissions";
    import {
        MAX_NAME_LENGTH,
        MIN_NAME_LENGTH,
        UpdateGroupState,
    } from "@src/logic/groupOrCommunity/group.svelte";
    import { toastStore } from "@src/stores/toast";
    import { AVATAR_SIZE, cropCentred } from "@src/utils/imageCrop";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { gateAssets } from "../access/gates.adapter";
    import type { DialogProps, LocalDialog } from "../app/dialogs";
    import { candidateFromSettings, groupSettings } from "./settings.adapter";

    let { dialog, onClose }: DialogProps<Extract<LocalDialog, { kind: "group_settings" }>> =
        $props();

    const client = getContext<OpenChat>("client");

    // the chat it was opened for; another chat being opened closes the dialog (a navigation does)
    const chat = $derived<MultiUserChat | undefined>(
        ($selectedChatSummaryStore?.kind === "group_chat" ||
            $selectedChatSummaryStore?.kind === "channel") &&
            chatIdentifiersEqual($selectedChatSummaryStore.id, dialog.chatId)
            ? $selectedChatSummaryStore
            : undefined,
    );

    const lookups = $derived({ tokens: $cryptoLookup, nervousSystems: $nervousSystemLookup });
    const assets = $derived(gateAssets(lookups));

    // the group as it was when opened: a save is measured against it, and a successful one moves it
    const editor = new UpdateGroupState();
    untrack(() => {
        if (chat !== undefined)
            editor.initialise(candidateGroupFromChat(chat, $selectedChatRulesStore));
    });
    const value = $state<GroupSettings | undefined>(
        untrack(() => (chat === undefined ? undefined : groupSettings(editor.original, lookups))),
    );

    const access = $derived(
        chat === undefined
            ? undefined
            : chatManageAccess(client, chat, $selectedCommunitySummaryStore, $anonUserStore),
    );
    // who can see the history before they joined is set when the group is made (groupChanges has
    // no field for it)
    const readOnlySections = $derived(
        access?.kind === "edit" ? [...access.readOnly, "history" as const] : [],
    );

    // ── confirming a change ──

    let confirming = $state<
        { confirmation: GroupChangeConfirmation; answer: (yes: boolean) => void } | undefined
    >();

    function confirm(confirmation: GroupChangeConfirmation): Promise<boolean> {
        return new Promise((resolve) => {
            confirming = {
                confirmation,
                answer: (yes) => {
                    confirming = undefined;
                    resolve(yes);
                },
            };
        });
    }

    const confirmText = $derived.by((): ResourceKey | undefined => {
        if (confirming === undefined || chat === undefined) return undefined;
        return confirming.confirmation === "verified_name"
            ? i18nKey("verified.nameChangeWarning", undefined, chat.level, true)
            : i18nKey(
                  `confirmMakeGroup${editor.candidate.public ? "Public" : "Private"}`,
                  undefined,
                  chat.level,
                  true,
              );
    });

    // ── saving ──

    // UpdateGroupState's limits, which the dialog shows as an invalid name
    function checkName(name: string): Promise<NameCheck> {
        return Promise.resolve(
            name.length >= MIN_NAME_LENGTH && name.length <= MAX_NAME_LENGTH ? "ok" : "invalid",
        );
    }

    // The dialog keeps the edits and says it couldn't save when this rejects
    async function save(all: GroupSettings) {
        const picked = all.info.avatarFile;
        const cropped = picked ? await cropCentred(picked, AVATAR_SIZE) : undefined;
        editor.candidateGroup = candidateFromSettings(
            all,
            editor.original,
            lookups,
            cropped && { blobUrl: cropped.url, blobData: cropped.data, blobReference: undefined },
        );

        let outcome = await editor.saveGroup(client);
        while (outcome.kind === "needs_confirmation") {
            outcome = await editor.saveGroup(client, await confirm(outcome.confirmation));
        }
        switch (outcome.kind) {
            case "success":
            case "unchanged":
                return;
            case "failed":
                toastStore.showFailureToast(outcome.message);
                throw new Error("not saved");
            default:
                // declined, or a name UpdateGroupState wouldn't send
                throw new Error(outcome.kind);
        }
    }

    // ── the About page ──

    const aboutMeta = $derived(
        chat === undefined
            ? ""
            : `${$_(chat.public ? "access.public" : "access.private")} · ${$_("memberCount", { values: { count: chat.memberCount } })}`,
    );

    async function mute(mute: "forever" | null) {
        if (chat === undefined) return;
        const failed = await muteChat(client, chat.id, mute !== null, undefined, $_);
        if (failed !== undefined) throw new Error("not muted");
    }

    async function favourite(on: boolean) {
        if (chat === undefined) return;
        const done = await (on
            ? client.addToFavourites(chat.id)
            : client.removeFromFavourites(chat.id));
        if (!done) throw new Error("not saved");
    }
</script>

{#if chat !== undefined && value !== undefined && access !== undefined}
    {#if access.kind === "edit"}
        <GroupSettingsDialog
            {value}
            initialTab={dialog.tab}
            isDiamond={$isDiamondStore}
            onUpgrade={() => publish("upgrade")}
            gateTokens={assets.tokens}
            gateSystems={assets.nervousSystems}
            {readOnlySections}
            {checkName}
            onSave={save}
            onCancel={onClose}
        />
    {:else}
        <!-- TODO(design): the About page is the read-only Overview of the Manage dialog (part 3); until
             that frame lands it opens on its own -->
        <div class="layer oc-dialog-layer" role="dialog" aria-modal="true" use:modal={onClose}>
            <div class="oc-veil" onclick={onClose} aria-hidden="true"></div>
            <div class="card">
                <GroupSettingsDialog
                    {value}
                    embedded
                    readOnly
                    section="group"
                    {aboutMeta}
                    roleLabel={$_(roleAsText(chat.membership.role))}
                    isMuted={chat.membership.notificationsMuted}
                    isFavourite={$favouritesStore.has(chat.id)}
                    onMuteChange={mute}
                    onFavouriteChange={favourite}
                    {onClose}
                />
            </div>
        </div>
    {/if}
{/if}

{#if confirming !== undefined && confirmText !== undefined}
    {@const answer = confirming.answer}
    <!-- TODO(design): GroupSettingsDialog has no confirm step for a verified rename or a change of
         who can see the chat -->
    <DialogShell title={$_("areYouSure")} z={90} onClose={() => answer(false)}>
        <p class="confirm-text">{interpolate($_, confirmText)}</p>
        <div class="actions">
            <Button variant="secondary" label={$_("noThanks")} onClick={() => answer(false)} />
            <Button label={$_("yesPlease")} onClick={() => answer(true)} />
        </div>
    </DialogShell>
{/if}

<style>
    .card {
        position: relative;
        width: 100%;
        max-width: 560px;
        height: min(720px, 100%);
        display: flex;
        flex-direction: column;
        border-radius: var(--radius-xl);
        background: var(--surface-1);
        box-shadow:
            inset 0 0 0 1px var(--line-2),
            var(--shadow-modal);
        overflow: hidden;
    }

    .confirm-text {
        margin: 0;
        font: var(--weight-regular) var(--text-base) / 1.5 var(--font-sans);
        color: var(--ink-2);
    }

    .actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-8);
        margin-block-start: var(--space-16);
    }
</style>
