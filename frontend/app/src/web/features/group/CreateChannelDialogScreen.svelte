<!-- A new channel in the selected community, or an embedded one (CreateGroupDialog, channel mode):
     the client's blank channel with everything the dialog sets (candidateFromCreate, as an edit is
     made), created through UpdateGroupState as the old flows did, then opened. People picked are
     invited, as the old flows did. -->
<script lang="ts">
    import {
        allUsersStore,
        chatListScopeStore,
        cryptoLookup,
        isDiamondStore,
        nervousSystemLookup,
        publish,
        ROLE_MEMBER,
        routeForChatIdentifier,
        selectedCommunityMembersStore,
        selectedCommunitySummaryStore,
        type OpenChat,
        type UserSummary,
    } from "@client";
    import CreateGroupDialog, {
        type CreateGroupPerson,
        type NameCheck,
    } from "@openchat/ui/src/features/components/CreateGroupDialog.svelte";
    import type { CreateGroupResult } from "@openchat/ui/src/lib/types";
    import {
        MAX_NAME_LENGTH,
        MIN_NAME_LENGTH,
        UpdateGroupState,
    } from "@src/logic/groupOrCommunity/group.svelte";
    import { searchToInvite } from "@src/logic/members/memberManagement.svelte";
    import { toastStore } from "@src/stores/toast";
    import { AVATAR_SIZE, cropCentred } from "@src/utils/imageCrop";
    import { navigate } from "@src/utils/navigation";
    import { getContext, tick } from "svelte";
    import { gateAssets } from "../access/gates.adapter";
    import type { DialogProps, LocalDialog } from "../app/dialogs";
    import { invitePerson } from "./group.adapter";
    import { candidateFromCreate } from "./settings.adapter";

    let { dialog, onClose }: DialogProps<Extract<LocalDialog, { kind: "new_channel" }>> = $props();

    const client = getContext<OpenChat>("client");

    const community = $derived(
        $selectedCommunitySummaryStore?.id.communityId === dialog.communityId.communityId
            ? $selectedCommunitySummaryStore
            : undefined,
    );

    const lookups = $derived({ tokens: $cryptoLookup, nervousSystems: $nervousSystemLookup });
    const assets = $derived(gateAssets(lookups));

    const person = (user: UserSummary): CreateGroupPerson => {
        const p = invitePerson(user);
        return { userId: p.id, name: p.name, handle: p.handle, color: p.color };
    };

    // the community's members held, to add; anyone on OpenChat can be searched for to invite
    const people = $derived(
        [...$selectedCommunityMembersStore.keys()].flatMap((id) => {
            const user = $allUsersStore.get(id);
            return user === undefined ? [] : [person(user)];
        }),
    );

    async function search(query: string, scope: "members" | "invite") {
        if (scope === "members") {
            const [matches] = await client.searchCommunityMembersToAdd(query, 20);
            return matches.map(person);
        }
        const [, everyone] = await searchToInvite(client, "channel", query);
        return everyone.map(person);
    }

    // the dialog arms on any name; a name is 3 to 40, as the old editors had it
    function checkName(name: string): Promise<NameCheck> {
        const n = name.trim().length;
        return Promise.resolve(n >= MIN_NAME_LENGTH && n <= MAX_NAME_LENGTH ? "ok" : "invalid");
    }

    // the dialog keeps the form and says it failed when this rejects
    async function create(result: CreateGroupResult) {
        const blank = client.createCandidateGroup("channel", result.embedded);
        if (blank === undefined) throw new Error("not in a community");
        const avatar = result.avatarFile
            ? await cropCentred(result.avatarFile, AVATAR_SIZE)
            : undefined;
        const editor = new UpdateGroupState();
        editor.initialise(blank);
        editor.candidateGroup = candidateFromCreate(
            result,
            blank,
            lookups,
            avatar && { blobUrl: avatar.url, blobData: avatar.data, blobReference: undefined },
        );
        editor.candidateMembers = [...result.members, ...result.invites].flatMap((id) => {
            const user = $allUsersStore.get(id);
            return user === undefined ? [] : [{ role: ROLE_MEMBER, user }];
        });
        const outcome = await editor.saveGroup(client);
        switch (outcome.kind) {
            case "created_without_invites":
                toastStore.showFailureToast(outcome.message);
                openChannel(outcome.chatId);
                return;
            case "created":
                openChannel(outcome.chatId);
                return;
            case "failed":
                toastStore.showFailureToast(outcome.message);
                throw new Error("not created");
            default:
                throw new Error(outcome.kind);
        }
    }

    function openChannel(chatId: Parameters<typeof routeForChatIdentifier>[1]) {
        // the new channel is in the chat list by the next tick
        void tick().then(() => navigate(routeForChatIdentifier($chatListScopeStore.kind, chatId)));
    }
</script>

{#if community !== undefined}
    <CreateGroupDialog
        kind={dialog.embedded ? "embedded" : "channel"}
        communityName={community.name}
        {people}
        onSearchPeople={search}
        isDiamond={$isDiamondStore}
        onUpgrade={() => publish("upgrade")}
        gateTokens={assets.tokens}
        gateSystems={assets.nervousSystems}
        {checkName}
        onCreate={create}
        onCancel={onClose}
    />
{/if}
