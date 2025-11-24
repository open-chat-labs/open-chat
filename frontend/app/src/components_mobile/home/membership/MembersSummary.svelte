<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Body, CommonButton, Container, ListAction } from "component-lib";
    import {
        allUsersStore,
        OpenChat,
        type CommunitySummary,
        type FullMember,
        type MultiUserChat,
    } from "openchat-client";
    import { getContext, onDestroy } from "svelte";
    import AccountPlus from "svelte-material-icons/AccountPlusOutline.svelte";
    import Translatable from "../../Translatable.svelte";
    import MemberList from "./MemberList.svelte";
    import { MemberManagement } from "./membersState.svelte";

    const TO_SHOW = 5;

    interface Props {
        collection: MultiUserChat | CommunitySummary;
    }

    let { collection }: Props = $props();

    let membersState = new MemberManagement(getContext<OpenChat>("client"), collection);
    let more = $derived(membersState.members.size - TO_SHOW);
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

<Container gap={"xl"} direction={"vertical"}>
    <Container>
        <Body colour={"textSecondary"} fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey("Members")}></Translatable>
        </Body>

        {#if membersState.members.size > TO_SHOW}
            <CommonButton
                onClick={() => membersState.showAllMembers()}
                size={"small_text"}
                mode={"active"}>
                <Translatable resourceKey={i18nKey(`View all (+${more})`)}></Translatable>
            </CommonButton>
        {/if}
    </Container>

    <ListAction onClick={() => membersState.inviteUsers()}>
        {#snippet icon(color)}
            <AccountPlus {color} />
        {/snippet}
        Invite & share
    </ListAction>

    <MemberList members={subset} {membersState} />
</Container>
