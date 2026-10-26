<!-- Manage's settings pages (Overview or About, Gates, Rules, Permissions): one GroupSettingsDialog,
     embedded, on UpdateGroupState or UpdateCommunityState, as the old editors were. It stays
     mounted while the user moves between those pages, so they share one draft. The parts the
     viewer's role can't change are read-only, and someone who can't edit it gets its About page
     (`access`). A change that has to be confirmed (renaming a
     verified group, changing who can see it) asks first; declining keeps the edits to change. -->
<script lang="ts">
    import {
        candidateGroupFromChat,
        chatSummariesListStore,
        cryptoLookup,
        defaultChatRules,
        favouritesStore,
        isDiamondStore,
        nervousSystemLookup,
        publish,
        roleAsText,
        selectedChatRulesStore,
        selectedCommunityRulesStore,
        type CommunitySummary,
        type GroupChangeConfirmation,
        type Level,
        type MultiUserChat,
        type OpenChat,
        type ResourceKey,
    } from "@client";
    import GroupSettingsDialog, {
        type NameCheck,
    } from "@openchat/ui/src/features/components/GroupSettingsDialog.svelte";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import type { GroupSettings } from "@openchat/ui/src/lib/types";
    import { i18nKey, interpolate } from "@i18n/i18n";
    import { muteChat } from "@src/logic/chats/muteChat";
    import {
        MAX_NAME_LENGTH as MAX_COMMUNITY_NAME,
        MIN_NAME_LENGTH as MIN_COMMUNITY_NAME,
        UpdateCommunityState,
        type SaveCommunityOutcome,
    } from "@src/logic/groupOrCommunity/community.svelte";
    import { type ManageAccess } from "@src/logic/groupOrCommunity/detailsPermissions";
    import {
        MAX_NAME_LENGTH,
        MIN_NAME_LENGTH,
        UpdateGroupState,
        type SaveGroupOutcome,
    } from "@src/logic/groupOrCommunity/group.svelte";
    import { toastStore } from "@src/stores/toast";
    import { AVATAR_SIZE, BANNER_SIZE, cropCentred, type CroppedImage } from "@src/utils/imageCrop";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { gateAssets, type GateLookups } from "../access/gates.adapter";
    import type { GroupSettingsTab } from "../app/dialogs";
    import {
        candidateCommunityFromSettings,
        candidateFromSettings,
        communitySettings,
        groupSettings,
    } from "./settings.adapter";

    interface Props {
        target: MultiUserChat | CommunitySummary;
        section: GroupSettingsTab;
        access: ManageAccess;
        onDirtyChange: (dirty: boolean) => void;
        onOpenRules: () => void;
        onClose: () => void;
    }

    let { target, section, access, onDirtyChange, onOpenRules, onClose }: Props = $props();

    const client = getContext<OpenChat>("client");

    const lookups = $derived({ tokens: $cryptoLookup, nervousSystems: $nervousSystemLookup });
    const assets = $derived(gateAssets(lookups));

    type SaveOutcome = SaveGroupOutcome | SaveCommunityOutcome;

    // The chat or community as it was when opened, in its own editor: a save is measured against
    // it, and a successful one moves it on
    type Editor = {
        level: Level;
        value: GroupSettings;
        nameLength: [min: number, max: number];
        isPublic: () => boolean;
        // saves the dialog's settings, with any images picked cropped
        save: (all: GroupSettings, images: Images) => Promise<SaveOutcome>;
        // the user's answer to the confirmation the last save asked for
        answer: (yes: boolean) => Promise<SaveOutcome>;
    };
    type Images = { avatar?: CroppedImage; banner?: CroppedImage };

    const content = (image: CroppedImage | undefined) =>
        image && { blobUrl: image.url, blobData: image.data, blobReference: undefined };

    function chatEditor(chat: MultiUserChat, lookups: GateLookups): Editor {
        const editor = new UpdateGroupState();
        editor.initialise(candidateGroupFromChat(chat, $selectedChatRulesStore));
        return {
            level: chat.level,
            value: groupSettings(editor.original, lookups),
            nameLength: [MIN_NAME_LENGTH, MAX_NAME_LENGTH],
            isPublic: () => editor.candidate.public,
            save: (all, images) => {
                editor.candidateGroup = candidateFromSettings(
                    all,
                    editor.original,
                    lookups,
                    content(images.avatar),
                );
                return editor.saveGroup(client);
            },
            answer: (yes) => editor.saveGroup(client, yes),
        };
    }

    function communityEditor(community: CommunitySummary, lookups: GateLookups): Editor {
        const editor = new UpdateCommunityState();
        editor.initialise(community, $selectedCommunityRulesStore ?? defaultChatRules("community"));
        const original = () => ({ community: editor.original, rules: editor.originalRules });
        return {
            level: "community",
            value: communitySettings(original(), lookups),
            nameLength: [MIN_COMMUNITY_NAME, MAX_COMMUNITY_NAME],
            isPublic: () => editor.candidate.public,
            save: (all, images) => {
                const { community, rules } = candidateCommunityFromSettings(
                    all,
                    original(),
                    lookups,
                    { avatar: content(images.avatar), banner: content(images.banner) },
                );
                editor.candidateCommunity = community;
                editor.rules = rules;
                return editor.saveCommunity(client);
            },
            answer: (yes) => editor.saveCommunity(client, yes),
        };
    }

    // the chat or community as it was when Manage opened
    const editor: Editor = untrack(() =>
        target.kind === "community"
            ? communityEditor(target, lookups)
            : chatEditor(target, lookups),
    );
    // who can see a group's history from before they joined is set when it's made (groupChanges
    // has no field for it)
    const readOnlySections = $derived(
        access.kind === "edit" ? [...access.readOnly, "history" as const] : [],
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
        if (confirming === undefined) return undefined;
        return confirming.confirmation === "verified_name"
            ? i18nKey("verified.nameChangeWarning", undefined, editor.level, true)
            : i18nKey(
                  `confirmMakeGroup${editor.isPublic() ? "Public" : "Private"}`,
                  undefined,
                  editor.level,
                  true,
              );
    });

    // ── saving ──

    // the editor's limits, which the dialog shows as an invalid name
    function checkName(name: string): Promise<NameCheck> {
        const [min, max] = editor.nameLength;
        return Promise.resolve(name.length >= min && name.length <= max ? "ok" : "invalid");
    }

    // The dialog keeps the edits and says it couldn't save when this rejects
    async function save(all: GroupSettings) {
        const [avatar, banner] = await Promise.all([
            all.info.avatarFile ? cropCentred(all.info.avatarFile, AVATAR_SIZE) : undefined,
            all.info.coverFile ? cropCentred(all.info.coverFile, BANNER_SIZE) : undefined,
        ]);

        let outcome = await editor.save(all, { avatar, banner });
        while (outcome.kind === "needs_confirmation") {
            outcome = await editor.answer(await confirm(outcome.confirmation));
        }
        switch (outcome.kind) {
            case "success":
            case "unchanged":
                return;
            case "failed":
                toastStore.showFailureToast(outcome.message);
                throw new Error("not saved");
            default:
                // declined, or details the editor wouldn't send
                throw new Error(outcome.kind);
        }
    }

    // ── the About page ──

    // rules switched off aren't in force, so the About page doesn't count them
    const aboutValue = $derived(
        editor.value.rules.enabled
            ? editor.value
            : { ...editor.value, rules: { enabled: false, text: "" } },
    );

    // a community is muted when every one of its channels is (as the old community menu had it)
    const muted = $derived(
        target.kind === "community"
            ? $chatSummariesListStore.every((c) => c.membership.notificationsMuted)
            : target.membership.notificationsMuted,
    );

    const aboutMeta = $derived(
        `${$_(target.public ? "access.public" : "access.private")} · ${$_("memberCount", { values: { count: target.memberCount } })}`,
    );

    // a community mutes all its channels, which can't be undone from here (as in the old menus)
    async function mute(mute: "forever" | null) {
        if (target.kind === "community") {
            if (mute === null || !(await client.muteAllChannels(target.id, false))) {
                throw new Error("can't unmute every channel");
            }
            return;
        }
        const failed = await muteChat(client, target.id, mute !== null, undefined, $_);
        if (failed !== undefined) throw new Error("not muted");
    }

    async function favourite(on: boolean) {
        if (target.kind === "community") return;
        const done = await (on
            ? client.addToFavourites(target.id)
            : client.removeFromFavourites(target.id));
        if (!done) throw new Error("not saved");
    }
</script>

{#if access.kind === "edit"}
    <GroupSettingsDialog
        value={editor.value}
        noun={target.kind === "community" ? "community" : "group"}
        embedded
        {section}
        isDiamond={$isDiamondStore}
        onUpgrade={() => publish("upgrade")}
        gateTokens={assets.tokens}
        gateSystems={assets.nervousSystems}
        {readOnlySections}
        {checkName}
        onSave={save}
        {onDirtyChange}
        {onClose}
    />
{:else}
    <GroupSettingsDialog
        value={aboutValue}
        noun={target.kind === "community" ? "community" : "group"}
        embedded
        readOnly
        {section}
        {aboutMeta}
        roleLabel={$_(roleAsText(target.membership.role))}
        isMuted={muted}
        isFavourite={target.kind !== "community" && $favouritesStore.has(target.id)}
        onMuteChange={mute}
        onFavouriteChange={target.kind === "community" ? undefined : favourite}
        {onOpenRules}
        {onClose}
    />
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
