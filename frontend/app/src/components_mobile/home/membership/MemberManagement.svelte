<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { trimLeadingAtSymbol } from "@src/utils/user";
    import { BigButton, Body, Container, Search, transition } from "component-lib";
    import type { FullMember, MultiUserChat, OpenChat, UserSummary } from "openchat-client";
    import {
        allUsersStore,
        compareChats,
        selectedChatBlockedUsersStore,
        selectedChatInvitedUsersStore,
        selectedChatLapsedMembersStore,
        selectedChatMembersStore,
        serverDirectChatsStore,
    } from "openchat-client";
    import { getContext } from "svelte";
    import AccountAlert from "svelte-material-icons/AccountAlertOutline.svelte";
    import AccountCancel from "svelte-material-icons/AccountCancelOutline.svelte";
    import Account from "svelte-material-icons/AccountGroupOutline.svelte";
    import AccountPlus from "svelte-material-icons/AccountPlusOutline.svelte";
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import BlockedList from "./BlockedList.svelte";
    import InviteList from "./InviteList.svelte";
    import LapsedList from "./LapsedList.svelte";
    import MemberList from "./MemberList.svelte";
    import { MemberManagement } from "./membersState.svelte";

    type View = "members" | "invite" | "lapsed" | "blocked";

    interface Props {
        chat: MultiUserChat;
        view?: View;
    }

    let { chat, view = $bindable("members") }: Props = $props();
    let searchTermEntered = $state<string>();
    let searchTerm = $derived(trimLeadingAtSymbol(searchTermEntered ?? ""));
    let searchTermLower = $derived(searchTerm.toLowerCase());
    let membersState = new MemberManagement(getContext<OpenChat>("client"), chat);
    let members = $derived<FullMember[]>(
        membersState.getKnownUsers($allUsersStore, [...$selectedChatMembersStore.values()]),
    );
    let lapsed = $derived<UserSummary[]>(
        membersState.getUsersFromSet($allUsersStore, $selectedChatLapsedMembersStore),
    );
    let filteredLapsed = $derived<UserSummary[]>(
        lapsed.filter((u) => membersState.matchesSearch(searchTermLower, u)),
    );
    let invited = $derived<UserSummary[]>(
        membersState.getUsersFromSet($allUsersStore, $selectedChatInvitedUsersStore),
    );
    let filteredInvited = $derived<UserSummary[]>(
        invited.filter((u) => membersState.matchesSearch(searchTermLower, u)),
    );
    let blocked = $derived<UserSummary[]>(
        membersState.getUsersFromSet($allUsersStore, $selectedChatBlockedUsersStore),
    );
    let filteredBlocked = $derived<UserSummary[]>(
        blocked.filter((u) => membersState.matchesSearch(searchTermLower, u)),
    );
    let filteredMembers = $derived(
        members
            .filter((u) => membersState.matchesSearch(searchTermLower, u))
            .sort(membersState.compareMembers),
    );
    let frequent = $derived<UserSummary[]>(
        [...$serverDirectChatsStore.values()]
            .sort(compareChats)
            .filter(
                (c) =>
                    !$selectedChatMembersStore.has(c.them.userId) &&
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

{#snippet membersIcon(color: string, size: string)}
    <Account {color} {size} />
{/snippet}

<SlidingPageContent title={i18nKey("Member management")} subtitle={i18nKey(chat.name)}>
    <Container height={{ kind: "fill" }} mainAxisAlignment={"spaceBetween"} direction={"vertical"}>
        <Container
            height={{ kind: "fill" }}
            gap={"lg"}
            padding={["xxl", "lg", "lg", "lg"]}
            direction={"vertical"}>
            <Search
                onClear={() => (searchTermEntered = undefined)}
                bind:value={searchTermEntered}
                placeholder={"Search for users"}></Search>

            {#if view === "members"}
                <Container
                    height={{ kind: "fill" }}
                    padding={["zero", "md"]}
                    gap={"xl"}
                    direction={"vertical"}>
                    <Body fontWeight={"bold"}>
                        <Translatable
                            resourceKey={i18nKey(`Current members (${members.length})`)} />
                    </Body>
                    <MemberList
                        searchTerm={searchTermEntered}
                        members={filteredMembers}
                        {membersState} />
                </Container>
            {:else if view === "invite"}
                <InviteList
                    onReset={() => (view = "members")}
                    count={invited.length}
                    searchTerm={searchTermEntered}
                    frequent={filteredFrequent}
                    users={filteredInvited}
                    {membersState} />
            {:else if view === "lapsed"}
                <LapsedList
                    onReset={() => (view = "members")}
                    count={lapsed.length}
                    searchTerm={searchTermEntered}
                    users={filteredLapsed}
                    {membersState} />
            {:else if view === "blocked"}
                <BlockedList
                    onReset={() => (view = "members")}
                    count={blocked.length}
                    searchTerm={searchTermEntered}
                    users={filteredBlocked}
                    {membersState} />
            {/if}
        </Container>
        <Container onSwipe={() => {}} padding={["zero", "md"]} gap={"sm"}>
            <BigButton
                icon={membersIcon}
                width={{ kind: "fixed", size: "7rem" }}
                mode={view === "members" ? "active" : "default"}
                onClick={() => setView("members")}>
                <Translatable resourceKey={i18nKey("Members")} />
            </BigButton>
            <BigButton
                width={{ kind: "fixed", size: "7rem" }}
                mode={view === "invite" ? "active" : "default"}
                onClick={() => setView("invite")}>
                {#snippet icon(color)}
                    <AccountPlus {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Invite users")} />
            </BigButton>
            <BigButton
                width={{ kind: "fixed", size: "7rem" }}
                mode={view === "lapsed" ? "active" : "default"}
                onClick={() => setView("lapsed")}>
                {#snippet icon(color)}
                    <AccountAlert {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Lapsed")} />
            </BigButton>
            <BigButton
                width={{ kind: "fixed", size: "7rem" }}
                mode={view === "blocked" ? "active" : "default"}
                onClick={() => setView("blocked")}>
                {#snippet icon(color)}
                    <AccountCancel {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Blocked")} />
            </BigButton>
        </Container>
    </Container>
</SlidingPageContent>
