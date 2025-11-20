<script lang="ts">
    import {
        Body,
        BodySmall,
        Container,
        IconButton,
        MenuItem,
        MenuTrigger,
        MultiAvatar,
    } from "component-lib";
    import {
        allUsersStore,
        i18nKey,
        OpenChat,
        publish,
        type UserGroupDetails,
    } from "openchat-client";
    import { getContext } from "svelte";
    import AccountGroup from "svelte-material-icons/AccountGroupOutline.svelte";
    import Delete from "svelte-material-icons/DeleteForeverOutline.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import Edit from "svelte-material-icons/TextBoxEditOutline.svelte";
    import AreYouSure from "../../../AreYouSure.svelte";
    import type { CommunityState } from "./communityState.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        communityState: CommunityState;
        userGroup: UserGroupDetails;
        canManageUserGroups: boolean;
    }

    let { userGroup, canManageUserGroups, communityState }: Props = $props();

    function memberUrls(ug: UserGroupDetails) {
        return [...ug.members].map((id) => client.userAvatarUrl($allUsersStore.get(id)));
    }
</script>

{#if communityState.confirmingUserGroupDelete}
    <AreYouSure
        message={i18nKey("communities.confirmDeleteUserGroup")}
        action={(answer) => communityState.deleteUserGroup(answer)} />
{/if}

<Container
    onClick={() => publish("showUserGroup", userGroup)}
    crossAxisAlignment={"center"}
    gap={"md"}>
    <MultiAvatar urls={memberUrls(userGroup)}></MultiAvatar>
    <Container direction={"vertical"}>
        <Body fontWeight={"bold"}>{userGroup.name}</Body>
        <BodySmall colour={"textSecondary"}>{`${userGroup.members.size} members`}</BodySmall>
    </Container>
    <MenuTrigger position={"bottom"} align={"end"}>
        {#snippet menuItems()}
            {#if canManageUserGroups}
                <MenuItem onclick={() => publish("editUserGroup", userGroup)}>
                    {#snippet icon(color)}
                        <Edit {color} />
                    {/snippet}
                    Edit
                </MenuItem>
                <MenuItem danger onclick={() => communityState.confirmDeleteUserGroup(userGroup)}>
                    {#snippet icon(color)}
                        <Delete {color} />
                    {/snippet}
                    Remove
                </MenuItem>
            {:else}
                <MenuItem onclick={() => publish("showUserGroup", userGroup)}>
                    {#snippet icon(color)}
                        <AccountGroup {color} />
                    {/snippet}
                    View members
                </MenuItem>
            {/if}
        {/snippet}
        <IconButton padding={["sm", "xs", "sm", "zero"]} size={"md"}>
            {#snippet icon(color)}
                <DotsVertical {color} />
            {/snippet}
        </IconButton>
    </MenuTrigger>
</Container>
