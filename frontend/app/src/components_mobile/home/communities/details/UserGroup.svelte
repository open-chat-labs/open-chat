<script lang="ts">
    import { Body, BodySmall, Container, FloatingButton, Search } from "component-lib";
    import {
        allUsersStore,
        publish,
        selectedCommunityUserGroupsStore,
        type CommunitySummary,
        type OpenChat,
        type UserGroupDetails,
        type UserSummary,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import Edit from "svelte-material-icons/SquareEditOutline.svelte";
    import { i18nKey, interpolate } from "../../../../i18n/i18n";
    import { trimLeadingAtSymbol } from "../../../../utils/user";
    import Translatable from "../../../Translatable.svelte";
    import SlidingPageContent from "../../SlidingPageContent.svelte";
    import User from "../../User.svelte";
    import { CommunityState } from "./communityState.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        community: CommunitySummary;
        userGroup: UserGroupDetails;
    }

    onMount(() => {
        return selectedCommunityUserGroupsStore.subscribe((groups) => {
            const ug = groups.get(userGroup.id);
            if (ug !== undefined) {
                userGroup = ug;
            }
        });
    });

    let { community, userGroup }: Props = $props();

    let communityState = new CommunityState(client, community);
    let searchTermEntered = $state("");

    function matchesSearch(searchTerm: string, user: UserSummary): boolean {
        if (searchTerm === "") return true;
        return (
            user.username.toLowerCase().includes(searchTerm) ||
            (user.displayName !== undefined && user.displayName.toLowerCase().includes(searchTerm))
        );
    }

    let searchTerm = $derived(trimLeadingAtSymbol(searchTermEntered));
    let searchTermLower = $derived(searchTerm.toLowerCase());
    let groupUsers = $derived(
        [...userGroup.members]
            .map((m) => $allUsersStore.get(m))
            .filter((u) => u !== undefined) as UserSummary[],
    );
    let matchedUsers = $derived(groupUsers.filter((u) => matchesSearch(searchTermLower, u)));

    function editUserGroup() {
        publish("editUserGroup", userGroup);
    }
</script>

<SlidingPageContent
    subtitle={i18nKey(`User group in ${community.name}`)}
    title={i18nKey(userGroup.name)}>
    <Container height={"fill"} mainAxisAlignment={"spaceBetween"} direction={"vertical"}>
        <Container
            height={"fill"}
            gap={"xl"}
            padding={["xxl", "lg", "lg", "lg"]}
            direction={"vertical"}>
            <Search
                searching={false}
                bind:value={searchTermEntered}
                placeholder={interpolate($_, i18nKey("Search user group members..."))} />

            <Container padding={["zero", "md"]} direction={"vertical"}>
                <Body fontWeight={"bold"}>
                    <Translatable
                        resourceKey={i18nKey(`${userGroup.name} (${userGroup.members.size})`)} />
                </Body>

                <BodySmall colour={"textSecondary"}>
                    <Translatable
                        resourceKey={i18nKey(
                            "Manage members of this group or update group data.",
                        )} />
                </BodySmall>
            </Container>

            <Container padding={["zero", "md"]} gap={"xl"} direction={"vertical"}>
                {#each matchedUsers as user}
                    <User {searchTerm} {user} />
                {/each}
            </Container>
        </Container>
    </Container>
    {#if communityState.canManageUserGroups}
        <FloatingButton pos={{ bottom: "lg", right: "lg" }} onClick={editUserGroup}>
            {#snippet icon(color)}
                <Edit {color} />
            {/snippet}
        </FloatingButton>
    {/if}
</SlidingPageContent>
