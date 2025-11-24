<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { trimLeadingAtSymbol } from "@src/utils/user";
    import { BigButton, Container, Search, transition } from "component-lib";
    import type { CommunitySummary, MultiUserChat, OpenChat, UserSummary } from "openchat-client";
    import {
        allUsersStore,
        compareChats,
        selectedChatBlockedUsersStore,
        selectedChatInvitedUsersStore,
        selectedChatLapsedMembersStore,
        serverDirectChatsStore,
    } from "openchat-client";
    import { getContext } from "svelte";
    import AccountPlus from "svelte-material-icons/AccountPlusOutline.svelte";
    import ShareIcon from "svelte-material-icons/ShareVariantOutline.svelte";
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import InviteList from "./InviteList.svelte";
    import { MemberManagement } from "./membersState.svelte";
    import Share from "./Share.svelte";

    type View = "invite" | "share";

    interface Props {
        collection: MultiUserChat | CommunitySummary;
        view?: View;
    }

    let { collection, view = $bindable("invite") }: Props = $props();
    let searchTermEntered = $state<string>();
    let searchTerm = $derived(trimLeadingAtSymbol(searchTermEntered ?? ""));
    let searchTermLower = $derived(searchTerm.toLowerCase());
    let membersState = new MemberManagement(getContext<OpenChat>("client"), collection);
    let invited = $derived<UserSummary[]>(
        membersState.getUsersFromSet($allUsersStore, membersState.invited),
    );
    let filteredInvited = $derived<UserSummary[]>(
        invited.filter((u) => membersState.matchesSearch(searchTermLower, u)),
    );
    let frequent = $derived<UserSummary[]>(
        [...$serverDirectChatsStore.values()]
            .sort(compareChats)
            .filter(
                (c) =>
                    !membersState.members.has(c.them.userId) &&
                    !$selectedChatBlockedUsersStore.has(c.them.userId) &&
                    !$selectedChatLapsedMembersStore.has(c.them.userId) &&
                    !$selectedChatInvitedUsersStore.has(c.them.userId),
            )
            .map((c) => $allUsersStore.get(c.them.userId))
            .filter((u): u is UserSummary => u !== undefined && u.kind !== "bot")
            .slice(0, 20),
    );

    let filteredFrequent = $derived<UserSummary[]>(
        frequent.filter((u) => membersState.matchesSearch(searchTermLower, u)),
    );

    function setView(v: View) {
        transition(["fade"], () => {
            view = v;
        });
    }
</script>

<SlidingPageContent title={i18nKey("Invite to thing")} subtitle={i18nKey(collection.name)}>
    <Container height={{ kind: "fill" }} mainAxisAlignment={"spaceBetween"} direction={"vertical"}>
        <Container
            height={{ kind: "fill" }}
            gap={"lg"}
            padding={["xxl", "lg", "lg", "lg"]}
            direction={"vertical"}>
            {#if view === "invite"}
                <Search
                    onClear={() => (searchTermEntered = undefined)}
                    bind:value={searchTermEntered}
                    placeholder={"Search for users"}></Search>

                <InviteList
                    onReset={() => (view = "invite")}
                    count={invited.length}
                    searchTerm={searchTermEntered}
                    frequent={filteredFrequent}
                    users={filteredInvited}
                    {membersState} />
            {:else if view === "share"}
                <Share {membersState} onReset={() => (view = "invite")} />
            {/if}
        </Container>
        <Container onSwipe={() => {}} padding={["zero", "md"]} gap={"sm"}>
            <BigButton
                width={{ kind: "share", value: 1 }}
                mode={view === "invite" ? "active" : "default"}
                onClick={() => setView("invite")}>
                {#snippet icon(color)}
                    <AccountPlus {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Invite users")} />
            </BigButton>
            <BigButton
                width={{ kind: "share", value: 1 }}
                mode={view === "share" ? "active" : "default"}
                onClick={() => setView("share")}>
                {#snippet icon(color)}
                    <ShareIcon {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Share this thing")} />
            </BigButton>
        </Container>
    </Container>
</SlidingPageContent>
