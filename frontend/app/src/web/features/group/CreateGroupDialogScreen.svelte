<!-- A new group or community (CreateGroupDialog): the client's blank group, or a blank community,
     with everything the dialog sets (candidateFromCreate / candidateCommunityFromCreate, as an edit
     is made), created through UpdateGroupState / UpdateCommunityState as the old flows did, with
     the people picked invited, then opened. -->
<script lang="ts">
    import {
        chatListScopeStore,
        cryptoLookup,
        isDiamondStore,
        nervousSystemLookup,
        publish,
        ROLE_MEMBER,
        routeForChatIdentifier,
        type CandidateMember,
        type OpenChat,
        type UserSummary,
    } from "@client";
    import CreateGroupDialog, {
        type CreateGroupPerson,
        type NameCheck,
    } from "@openchat/ui/src/features/components/CreateGroupDialog.svelte";
    import type { CreateGroupResult } from "@openchat/ui/src/lib/types";
    import {
        MAX_NAME_LENGTH as MAX_COMMUNITY_NAME,
        MIN_NAME_LENGTH as MIN_COMMUNITY_NAME,
        newCommunity,
        UpdateCommunityState,
    } from "@src/logic/groupOrCommunity/community.svelte";
    import {
        MAX_NAME_LENGTH,
        MIN_NAME_LENGTH,
        UpdateGroupState,
    } from "@src/logic/groupOrCommunity/group.svelte";
    import { toastStore } from "@src/stores/toast";
    import { AVATAR_SIZE, BANNER_SIZE, cropCentred, type CroppedImage } from "@src/utils/imageCrop";
    import { navigate } from "@src/utils/navigation";
    import { getContext, tick } from "svelte";
    import { locale } from "svelte-i18n";
    import { gateAssets } from "../access/gates.adapter";
    import type { DialogProps, LocalDialog } from "../app/dialogs";
    import { invitePerson } from "./group.adapter";
    import {
        candidateCommunityFromCreate,
        candidateFromCreate,
        communityPermissionsValue,
    } from "./settings.adapter";

    let { dialog, onClose }: DialogProps<Extract<LocalDialog, { kind: "create_group" }>> = $props();

    const client = getContext<OpenChat>("client");

    const lookups = $derived({ tokens: $cryptoLookup, nervousSystems: $nervousSystemLookup });
    const assets = $derived(gateAssets(lookups));

    const person = (user: UserSummary): CreateGroupPerson => {
        const p = invitePerson(user);
        return { userId: p.id, name: p.name, handle: p.handle, color: p.color };
    };

    // the dialog arms on any name; the old editors' lengths apply
    function checkName(name: string): Promise<NameCheck> {
        const [min, max] =
            dialog.level === "community"
                ? [MIN_COMMUNITY_NAME, MAX_COMMUNITY_NAME]
                : [MIN_NAME_LENGTH, MAX_NAME_LENGTH];
        const n = name.trim().length;
        return Promise.resolve(n >= min && n <= max ? "ok" : "invalid");
    }

    const content = (image: CroppedImage | undefined) =>
        image && { blobUrl: image.url, blobData: image.data, blobReference: undefined };

    // the people picked, as the editors' invitees
    function invitees(userIds: string[], users: UserSummary[]) {
        return users
            .filter((u) => userIds.includes(u.userId))
            .map((user): CandidateMember => ({ role: ROLE_MEMBER, user }));
    }

    // anyone on OpenChat, to invite; those found are kept to invite them by id
    let found: UserSummary[] = [];
    async function searchAndKeep(query: string) {
        const users = await client.searchUsers(query, 20);
        found = [...found.filter((u) => !users.some((f) => f.userId === u.userId)), ...users];
        return users.map(person);
    }

    // the dialog keeps the form and says it failed when these reject
    async function create(result: CreateGroupResult) {
        const [avatar, banner] = await Promise.all([
            result.avatarFile ? cropCentred(result.avatarFile, AVATAR_SIZE) : undefined,
            result.coverFile ? cropCentred(result.coverFile, BANNER_SIZE) : undefined,
        ]);
        if (dialog.level === "community") {
            const editor = new UpdateCommunityState();
            editor.initialiseNew();
            const blank = { community: editor.original, rules: editor.originalRules };
            const { community, rules } = candidateCommunityFromCreate(result, blank, lookups, {
                avatar: content(avatar),
                banner: content(banner),
            });
            editor.candidateCommunity = community;
            editor.rules = { ...rules, newVersion: false };
            editor.channelNames = result.channels;
            editor.candidateMembers = invitees(result.members, found);
            const outcome = await editor.saveCommunity(client);
            switch (outcome.kind) {
                case "created_without_invites":
                    toastStore.showFailureToast(outcome.message);
                    void tick().then(() => navigate(`/community/${outcome.id.communityId}`));
                    return;
                case "created":
                    void tick().then(() => navigate(`/community/${outcome.id.communityId}`));
                    return;
                case "failed":
                    toastStore.showFailureToast(outcome.message);
                    throw new Error("not created");
                default:
                    throw new Error(outcome.kind);
            }
        }

        const blank = client.createCandidateGroup("group", false);
        if (blank === undefined) throw new Error("no group");
        const editor = new UpdateGroupState();
        editor.initialise(blank);
        editor.candidateGroup = candidateFromCreate(result, blank, lookups, content(avatar));
        editor.candidateMembers = invitees(result.members, found);
        const outcome = await editor.saveGroup(client);
        switch (outcome.kind) {
            case "created_without_invites":
            case "created": {
                if (outcome.kind === "created_without_invites") {
                    toastStore.showFailureToast(outcome.message);
                }
                const chatId = outcome.chatId;
                // the new group is in the chat list by the next tick
                void tick().then(() =>
                    navigate(routeForChatIdentifier($chatListScopeStore.kind, chatId)),
                );
                return;
            }
            case "failed":
                toastStore.showFailureToast(outcome.message);
                throw new Error("not created");
            default:
                throw new Error(outcome.kind);
        }
    }
</script>

<CreateGroupDialog
    kind={dialog.level}
    onSearchPeople={searchAndKeep}
    isDiamond={$isDiamondStore}
    onUpgrade={() => publish("upgrade")}
    gateTokens={assets.tokens}
    gateSystems={assets.nervousSystems}
    defaultLanguage={($locale ?? "en").split("-")[0]}
    communityDefaults={communityPermissionsValue(newCommunity().permissions).general}
    {checkName}
    onCreate={create}
    onCancel={onClose}
/>
