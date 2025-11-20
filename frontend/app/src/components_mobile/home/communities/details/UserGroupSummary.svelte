<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Body, CommonButton, Container, ListAction } from "component-lib";
    import { publish, selectedCommunityUserGroupsStore } from "openchat-client";
    import AccountGroup from "svelte-material-icons/AccountGroupOutline.svelte";
    import { SvelteSet } from "svelte/reactivity";
    import Translatable from "../../../Translatable.svelte";
    import type { CommunityState } from "./communityState.svelte";
    import UserGroupRow from "./UserGroupRow.svelte";

    interface Props {
        communityState: CommunityState;
    }

    let { communityState }: Props = $props();

    const TO_SHOW = 5;

    let userGroups = $derived([...$selectedCommunityUserGroupsStore.values()]);
    let more = $derived(userGroups.length - TO_SHOW);
    let show = $derived(communityState.canManageUserGroups || userGroups.length > 0);
    function showAll() {
        publish("showUserGroups");
    }

    function addUserGroup() {
        publish("editUserGroup", {
            kind: "user_group",
            id: -1,
            name: "",
            members: new SvelteSet<string>(),
        });
    }
</script>

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

        {#if communityState.canManageUserGroups}
            <ListAction onClick={addUserGroup}>
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
                    <UserGroupRow
                        {userGroup}
                        canManageUserGroups={communityState.canManageUserGroups}
                        {communityState} />
                {/each}
            {/if}
        </Container>
    </Container>
{/if}
