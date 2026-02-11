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
    import Separator from "../Separator.svelte";
    import MemberList from "./MemberList.svelte";
    import { MemberManagement } from "./membersState.svelte";

    const TO_SHOW = 5;

    interface Props {
        collection: MultiUserChat | CommunitySummary;
    }

    let { collection }: Props = $props();

    let membersState = new MemberManagement(getContext<OpenChat>("client"), collection);
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
            <Translatable resourceKey={i18nKey(`View all (${membersState.members.size})`)}
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
