<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { trimLeadingAtSymbol } from "@src/utils/user";
    import { BigButton, Body, Container, Search, transition } from "component-lib";
    import type {
        CommunitySummary,
        FullMember,
        MultiUserChat,
        OpenChat,
        UserSummary,
    } from "openchat-client";
    import { allUsersStore } from "openchat-client";
    import { getContext } from "svelte";
    import AccountAlert from "svelte-material-icons/AccountAlertOutline.svelte";
    import AccountCancel from "svelte-material-icons/AccountCancelOutline.svelte";
    import Account from "svelte-material-icons/AccountGroupOutline.svelte";
    import AccountPlus from "svelte-material-icons/AccountPlusOutline.svelte";
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import AddList from "./AddList.svelte";
    import BlockedList from "./BlockedList.svelte";
    import LapsedList from "./LapsedList.svelte";
    import MemberList from "./MemberList.svelte";
    import { MemberManagement } from "./membersState.svelte";

    type View = "members" | "lapsed" | "blocked" | "add";

    interface Props {
        collection: MultiUserChat | CommunitySummary;
        view?: View;
    }

    let { collection, view = $bindable("members") }: Props = $props();
    let searchTermEntered = $state<string>();
    let searchTerm = $derived(trimLeadingAtSymbol(searchTermEntered ?? ""));
    let searchTermLower = $derived(searchTerm.toLowerCase());
    let membersState = new MemberManagement(getContext<OpenChat>("client"), collection);
    let members = $derived<FullMember[]>(
        membersState.getKnownUsers($allUsersStore, [...membersState.members.values()]),
    );
    let canAdd = $derived(membersState.canAdd());
    let filteredMembers = $derived(
        members
            .filter((u) => membersState.matchesSearch(searchTermLower, u))
            .sort(membersState.compareMembers),
    );
    let lapsed = $derived<UserSummary[]>(
        membersState.getUsersFromSet($allUsersStore, membersState.lapsed),
    );
    let filteredLapsed = $derived<UserSummary[]>(
        lapsed.filter((u) => membersState.matchesSearch(searchTermLower, u)),
    );
    let blocked = $derived<UserSummary[]>(
        membersState.getUsersFromSet($allUsersStore, membersState.blocked),
    );
    let filteredBlocked = $derived<UserSummary[]>(
        blocked.filter((u) => membersState.matchesSearch(searchTermLower, u)),
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

<SlidingPageContent title={i18nKey("Member management")} subtitle={i18nKey(collection.name)}>
    <Container height={"fill"} mainAxisAlignment={"spaceBetween"} direction={"vertical"}>
        <Container
            height={"fill"}
            gap={"lg"}
            padding={["xxl", "lg", "lg", "lg"]}
            direction={"vertical"}>
            {#if view !== "add"}
                <Search
                    onClear={() => (searchTermEntered = undefined)}
                    bind:value={searchTermEntered}
                    placeholder={"Search for users"}></Search>
            {/if}

            {#if view === "members"}
                <Container
                    height={"fill"}
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
            {:else if view === "lapsed"}
                <LapsedList
                    onReset={() => (view = "members")}
                    count={lapsed.length}
                    searchTerm={searchTermEntered}
                    users={filteredLapsed}
                    {membersState} />
            {:else if view === "add"}
                <AddList {membersState} />
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
                width={{ size: "7rem" }}
                mode={view === "members" ? "active" : "default"}
                onClick={() => setView("members")}>
                <Translatable resourceKey={i18nKey("Members")} />
            </BigButton>
            {#if canAdd}
                <BigButton
                    width={{ size: "7rem" }}
                    mode={view === "add" ? "active" : "default"}
                    onClick={() => setView("add")}>
                    {#snippet icon(color)}
                        <AccountPlus {color} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("Add users")} />
                </BigButton>
            {/if}
            <BigButton
                width={{ size: "7rem" }}
                mode={view === "lapsed" ? "active" : "default"}
                onClick={() => setView("lapsed")}>
                {#snippet icon(color)}
                    <AccountAlert {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Lapsed")} />
            </BigButton>
            <BigButton
                width={{ size: "7rem" }}
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
