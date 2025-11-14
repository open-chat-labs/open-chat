<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { trimLeadingAtSymbol } from "@src/utils/user";
    import { BigButton, Body, Container, Search } from "component-lib";
    import type { FullMember, MultiUserChat, OpenChat } from "openchat-client";
    import { allUsersStore, selectedChatMembersStore } from "openchat-client";
    import { getContext } from "svelte";
    import AccountAlert from "svelte-material-icons/AccountAlertOutline.svelte";
    import AccountCancel from "svelte-material-icons/AccountCancelOutline.svelte";
    import Account from "svelte-material-icons/AccountGroupOutline.svelte";
    import AccountPlus from "svelte-material-icons/AccountPlusOutline.svelte";
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
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
    let filteredMembers = $derived(
        members
            .filter((u) => membersState.matchesSearch(searchTermLower, u))
            .sort(membersState.compareMembers),
    );
</script>

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
                invite
            {:else if view === "lapsed"}
                lapsed
            {:else if view === "blocked"}
                blocked
            {/if}
        </Container>
        <Container onSwipe={() => {}} padding={["zero", "md"]} gap={"sm"}>
            <BigButton
                width={{ kind: "fixed", size: "7rem" }}
                mode={view === "members" ? "active" : "default"}
                onClick={() => (view = "members")}>
                {#snippet icon(color)}
                    <Account {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Members")} />
            </BigButton>
            <BigButton
                width={{ kind: "fixed", size: "7rem" }}
                mode={view === "invite" ? "active" : "default"}
                onClick={() => (view = "invite")}>
                {#snippet icon(color)}
                    <AccountPlus {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Invite users")} />
            </BigButton>
            <BigButton
                width={{ kind: "fixed", size: "7rem" }}
                mode={view === "lapsed" ? "active" : "default"}
                onClick={() => (view = "lapsed")}>
                {#snippet icon(color)}
                    <AccountAlert {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Lapsed")} />
            </BigButton>
            <BigButton
                width={{ kind: "fixed", size: "7rem" }}
                mode={view === "blocked" ? "active" : "default"}
                onClick={() => (view = "blocked")}>
                {#snippet icon(color)}
                    <AccountCancel {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Blocked")} />
            </BigButton>
        </Container>
    </Container>
</SlidingPageContent>
