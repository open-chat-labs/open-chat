<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import {
        Body,
        BodySmall,
        CommonButton,
        Container,
        IconButton,
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
    import Delete from "svelte-material-icons/DeleteForeverOutline.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import Edit from "svelte-material-icons/TextBoxEditOutline.svelte";
    import Translatable from "../../../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        community: CommunitySummary;
    }

    let { community }: Props = $props();

    const TO_SHOW = 5;

    let userGroups = $derived([...$selectedCommunityUserGroupsStore.values()]);
    let canManageUserGroups = $derived(client.canManageUserGroups(community.id));
    let more = $derived(userGroups.length - TO_SHOW);

    function memberUrls(ug: UserGroupDetails) {
        return [...ug.members].map((id) => client.userAvatarUrl($allUsersStore.get(id)));
    }

    function showAll() {
        publish("showUserGroups");
    }

    function editUserGroup(userGroup: UserGroupDetails) {
        console.log("Edit user group: ", userGroup);
    }

    function deleteUserGroup(userGroup: UserGroupDetails) {
        console.log("Delete user group: ", userGroup);
    }
</script>

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

    <Container gap={"xl"} direction={"vertical"}>
        {#each userGroups as userGroup}
            <Container crossAxisAlignment={"center"} gap={"md"}>
                <MultiAvatar urls={memberUrls(userGroup)}></MultiAvatar>
                <Container direction={"vertical"}>
                    <Body fontWeight={"bold"}>{userGroup.name}</Body>
                    <BodySmall colour={"textSecondary"}
                        >{`${userGroup.members.size} members`}</BodySmall>
                </Container>
                {#if canManageUserGroups}
                    <MenuTrigger position={"bottom"} align={"end"}>
                        <IconButton padding={["sm", "xs", "sm", "zero"]} size={"md"}>
                            {#snippet icon(color)}
                                <DotsVertical {color} />
                            {/snippet}
                        </IconButton>
                        {#snippet menuItems()}
                            <MenuItem onclick={() => editUserGroup(userGroup)}>
                                {#snippet icon(color)}
                                    <Edit {color} />
                                {/snippet}
                                Edit
                            </MenuItem>
                            <MenuItem danger onclick={() => deleteUserGroup(userGroup)}>
                                {#snippet icon(color)}
                                    <Delete {color} />
                                {/snippet}
                                Remove
                            </MenuItem>
                        {/snippet}
                    </MenuTrigger>
                {/if}
            </Container>
        {/each}
    </Container>
</Container>
