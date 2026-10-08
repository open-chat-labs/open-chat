<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Body, CommonButton, Container, ListAction } from "component-lib";
    import {
        allChatsStore,
        allUsersStore,
        communitiesStore,
        OpenChat,
        type CommunitySummary,
        type FullMember,
        type MultiUserChat,
    } from "@client";
    import { getContext, onDestroy } from "svelte";
    import AccountPlus from "svelte-material-icons/AccountPlusOutline.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import Separator from "../Separator.svelte";
    import MemberList from "./MemberList.svelte";
    import { MemberManagement } from "./membersState.svelte";

    const TO_SHOW = 5;

    interface Props {
        collection: MultiUserChat | CommunitySummary;
    }

    let { collection }: Props = $props();

    const membersState = new MemberManagement(getContext<OpenChat>("client"), collection);
    // The collection is as it was when the page was opened, so the count is read from its summary
    // as it is now
    let memberCount = $derived.by(() => {
        const summary =
            collection.kind === "community"
                ? $communitiesStore.get(collection.id)
                : $allChatsStore.get(collection.id);
        return summary !== undefined && summary.kind !== "direct_chat"
            ? summary.memberCount
            : collection.memberCount;
    });

    let subset = $derived<FullMember[]>(
        membersState.getKnownUsers(
            $allUsersStore,
            [...membersState.members.values()].slice(0, TO_SHOW),
        ),
    );

    onDestroy(() => {
        membersState.destroy();
    });
</script>

<Separator />

<Container padding={["zero", "md"]} gap={"xl"} direction={"vertical"}>
    <Container>
        <Body colour={"textSecondary"} fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey("Members")}></Translatable>
        </Body>

        <CommonButton
            onClick={() => membersState.showAllMembers()}
            size={"small_text"}
            mode={"active"}>
            <Translatable resourceKey={i18nKey(`View all (${memberCount})`)}
            ></Translatable>
        </CommonButton>
    </Container>

    <ListAction onClick={() => membersState.showInviteUsers()}>
        {#snippet icon(color)}
            <AccountPlus {color} />
        {/snippet}
        Invite & share
    </ListAction>

    {#if membersState.canAdd()}
        <ListAction colour={"tertiary"} onClick={() => membersState.showAllMembers("add")}>
            {#snippet icon(color)}
                <AccountPlus {color} />
            {/snippet}
            Add users
        </ListAction>
    {/if}

    <MemberList members={subset} {membersState} />
</Container>
