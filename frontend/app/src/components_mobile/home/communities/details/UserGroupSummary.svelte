<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import {
        Body,
        BodySmall,
        CommonButton,
        Container,
        IconButton,
        ListAction,
        MenuItem,
        MenuTrigger,
        MultiAvatar,
    } from "component-lib";
    import {
        allUsersStore,
        OpenChat,
        publish,
        selectedCommunityUserGroupsStore,
        type CommunitySummary,
        type UserGroupDetails,
    } from "openchat-client";
    import { getContext } from "svelte";
    import AccountGroup from "svelte-material-icons/AccountGroupOutline.svelte";
    import Delete from "svelte-material-icons/DeleteForeverOutline.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import Edit from "svelte-material-icons/TextBoxEditOutline.svelte";
    import AreYouSure from "../../../AreYouSure.svelte";
    import Translatable from "../../../Translatable.svelte";
    import type { CommunityState } from "./communityState.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        community: CommunitySummary;
        communityState: CommunityState;
    }

    let { community, communityState }: Props = $props();

    const TO_SHOW = 5;

    let userGroups = $derived([...$selectedCommunityUserGroupsStore.values()]);
    let canManageUserGroups = $derived(client.canManageUserGroups(community.id));
    let more = $derived(userGroups.length - TO_SHOW);
    let show = $derived(canManageUserGroups || userGroups.length > 0);

    function memberUrls(ug: UserGroupDetails) {
        return [...ug.members].map((id) => client.userAvatarUrl($allUsersStore.get(id)));
    }

    function showAll() {
        publish("showUserGroups");
    }

    function showUserGroup(id: number) {
        publish("showUserGroup", id);
    }
</script>

{#if communityState.confirmingUserGroupDelete}
    <AreYouSure
        message={i18nKey("communities.confirmDeleteUserGroup")}
        action={(answer) => communityState.deleteUserGroup(answer)} />
{/if}

{#snippet userGroupSnippet(userGroup: UserGroupDetails)}
    <Container onClick={() => showUserGroup(userGroup.id)} crossAxisAlignment={"center"} gap={"md"}>
        <MultiAvatar urls={memberUrls(userGroup)}></MultiAvatar>
        <Container direction={"vertical"}>
            <Body fontWeight={"bold"}>{userGroup.name}</Body>
            <BodySmall colour={"textSecondary"}>{`${userGroup.members.size} members`}</BodySmall>
        </Container>
        <MenuTrigger position={"bottom"} align={"end"}>
            {#snippet menuItems()}
                {#if canManageUserGroups}
                    <MenuItem onclick={() => showUserGroup(userGroup.id)}>
                        {#snippet icon(color)}
                            <Edit {color} />
                        {/snippet}
                        Edit
                    </MenuItem>
                    <MenuItem
                        danger
                        onclick={() => communityState.confirmDeleteUserGroup(userGroup)}>
                        {#snippet icon(color)}
                            <Delete {color} />
                        {/snippet}
                        Remove
                    </MenuItem>
                {:else}
                    <MenuItem onclick={() => showUserGroup(userGroup.id)}>
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
{/snippet}

{#if show}
    <Container gap={"xl"} direction={"vertical"}>
        <Container>
            <Body colour={"textSecondary"} fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("User groups")}></Translatable>
            </Body>

            {#if userGroups.length > TO_SHOW}
                <CommonButton onClick={showAll} size={"small_text"} mode={"active"}>
                    <Translatable resourceKey={i18nKey(`View all (+${more})`)}></Translatable>
                </CommonButton>
            {/if}
        </Container>

        {#if canManageUserGroups}
            <ListAction onClick={showAll}>
                {#snippet icon(color)}
                    <AccountGroup {color} />
                {/snippet}
                Add user group
            </ListAction>
        {/if}

        <Container gap={"xl"} direction={"vertical"}>
            {#if userGroups.length === 0}
                <Body>
                    <Translatable
                        resourceKey={i18nKey(
                            "This community currently has no user groups. Create one to support easy tagging of multiple users",
                        )}></Translatable>
                </Body>
            {:else}
                {#each userGroups as userGroup}
                    {@render userGroupSnippet(userGroup)}
                {/each}
            {/if}
        </Container>
    </Container>
{/if}
