<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Body, CommonButton, Container, ListAction } from "component-lib";
    import {
        allUsersStore,
        OpenChat,
        publish,
        selectedChatMembersStore,
        type FullMember,
        type MultiUserChat,
    } from "openchat-client";
    import { getContext } from "svelte";
    import AccountPlus from "svelte-material-icons/AccountPlusOutline.svelte";
    import Translatable from "../../Translatable.svelte";
    import MemberList from "./MemberList.svelte";
    import { MemberManagement } from "./membersState.svelte";

    const TO_SHOW = 5;

    interface Props {
        chat: MultiUserChat;
    }

    let { chat }: Props = $props();

    let membersState = new MemberManagement(getContext<OpenChat>("client"), chat);
    let memberCount = $derived($selectedChatMembersStore.size);
    let more = $derived(memberCount - TO_SHOW);
    let subset = $derived<FullMember[]>(
        membersState.getKnownUsers(
            $allUsersStore,
            [...$selectedChatMembersStore.values()].slice(0, TO_SHOW),
        ),
    );

    function showAllMembers() {
        publish("groupMembers", chat);
    }

    function inviteUsers() {}

    function share() {}
</script>

<Container gap={"xl"} direction={"vertical"}>
    <Container>
        <Body colour={"textSecondary"} fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey("Members")}></Translatable>
        </Body>

        {#if memberCount > TO_SHOW}
            <CommonButton onClick={showAllMembers} size={"small_text"} mode={"active"}>
                <Translatable resourceKey={i18nKey(`View all (+${more})`)}></Translatable>
            </CommonButton>
        {/if}
    </Container>

    <ListAction onClick={inviteUsers}>
        {#snippet icon(color)}
            <AccountPlus {color} />
        {/snippet}
        Add members
    </ListAction>

    <ListAction colour={"secondary"} onClick={share}>
        {#snippet icon(color)}
            <AccountPlus {color} />
        {/snippet}
        Invite via link or QR code
    </ListAction>

    <MemberList members={subset} {membersState} />
</Container>
