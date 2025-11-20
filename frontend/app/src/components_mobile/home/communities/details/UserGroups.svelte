<script lang="ts">
    import { Body, BodySmall, Container, FloatingButton, Search } from "component-lib";
    import type { CommunitySummary, OpenChat, UserGroupDetails } from "openchat-client";
    import { publish, selectedCommunityUserGroupsStore } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import Plus from "svelte-material-icons/Plus.svelte";
    import { SvelteSet } from "svelte/reactivity";
    import { i18nKey, interpolate } from "../../../../i18n/i18n";
    import Translatable from "../../../Translatable.svelte";
    import SlidingPageContent from "../../SlidingPageContent.svelte";
    import UserGroupRow from "./UserGroupRow.svelte";
    import { CommunityState } from "./communityState.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        community: CommunitySummary;
    }

    let { community }: Props = $props();
    let communityState = new CommunityState(client, community);

    let searchTerm = $state("");

    function matchesSearch(searchTerm: string, userGroup: UserGroupDetails): boolean {
        if (searchTerm === "") return true;
        return userGroup.name.toLowerCase().includes(searchTerm);
    }

    function createUserGroup() {
        publish("editUserGroup", {
            kind: "user_group",
            id: -1,
            name: "",
            members: new SvelteSet<string>(),
        });
    }

    let searchTermLower = $derived(searchTerm.toLowerCase());
    let userGroups = $derived([...$selectedCommunityUserGroupsStore.values()]);
    let canManageUserGroups = $derived(client.canManageUserGroups(community.id));
    let matchingGroups = $derived(userGroups.filter((ug) => matchesSearch(searchTermLower, ug)));
</script>

<SlidingPageContent title={i18nKey("User groups")} subtitle={i18nKey(community.name)}>
    <Container height={{ kind: "fill" }} mainAxisAlignment={"spaceBetween"} direction={"vertical"}>
        <Container
            height={{ kind: "fill" }}
            gap={"xl"}
            padding={["xxl", "lg", "lg", "lg"]}
            direction={"vertical"}>
            <Search
                searching={false}
                bind:value={searchTerm}
                onClear={() => (searchTerm = "")}
                placeholder={interpolate($_, i18nKey("communities.searchUserGroups"))} />

            <Container padding={["zero", "md"]} direction={"vertical"}>
                <Body fontWeight={"bold"}>
                    {#if userGroups.length === 0}
                        <Translatable resourceKey={i18nKey("communities.noUserGroups")} />
                    {:else}
                        <Translatable resourceKey={i18nKey(`User groups (${userGroups.length})`)} />
                    {/if}
                </Body>

                <BodySmall colour={"textSecondary"}>
                    <Translatable
                        resourceKey={i18nKey(
                            "User groups allow you to tag / @mention all users assigned to a particular group in a chat message.",
                        )} />
                </BodySmall>
            </Container>

            <Container padding={["zero", "md"]} gap={"xl"} direction={"vertical"}>
                {#each matchingGroups as userGroup}
                    <UserGroupRow {userGroup} {canManageUserGroups} {communityState} />
                {/each}
            </Container>
        </Container>
    </Container>
    <FloatingButton pos={{ bottom: "lg", right: "lg" }} onClick={createUserGroup}>
        {#snippet icon(color)}
            <Plus {color} />
        {/snippet}
    </FloatingButton>
</SlidingPageContent>
