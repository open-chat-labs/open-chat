<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Body, Container } from "component-lib";
    import { currentUserIdStore, type UserSummary } from "openchat-client";
    import AccountAlert from "svelte-material-icons/AccountAlertOutline.svelte";
    import Account from "svelte-material-icons/AccountGroupOutline.svelte";
    import Translatable from "../../Translatable.svelte";
    import VirtualList from "../../VirtualList.svelte";
    import NothingToSee from "../NothingToSee.svelte";
    import LapsedUser from "./LapsedUser.svelte";
    import type { MemberManagement } from "./membersState.svelte";

    interface Props {
        users: UserSummary[];
        membersState: MemberManagement;
        searchTerm?: string;
        count: number;
        onReset: () => void;
    }
    let { users, membersState, searchTerm, count, onReset }: Props = $props();
    let virtualise = $derived(users.length > 50);
</script>

{#snippet userView(user: UserSummary)}
    {@const me = user.userId === $currentUserIdStore}
    <Container padding={["md", "zero"]}>
        <LapsedUser
            {searchTerm}
            {me}
            {user}
            onBlockUser={membersState.canBlockUsers()
                ? (userId) => membersState.onBlockUser(userId)
                : undefined}
            onRemoveMember={membersState.canRemoveMembers()
                ? (userId) => membersState.onRemoveMember(userId)
                : undefined} />
    </Container>
{/snippet}

{#snippet membersIcon(color: string, size: string)}
    <Account {color} {size} />
{/snippet}

<Container height={{ kind: "fill" }} padding={["zero", "md"]} gap={"xl"} direction={"vertical"}>
    {#if count === 0}
        <NothingToSee
            reset={{ onClick: onReset, icon: membersIcon, text: "View all members" }}
            padding={["huge", "xxl"]}
            title={"No lapsed members"}
            subtitle={"When a member of your group no longer satisfies the access gates set in the group settings, they become a lapsed member!"}>
            {#snippet icon(color, size)}
                <AccountAlert {color} {size} />
            {/snippet}
        </NothingToSee>
    {:else}
        <Body fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey(`Lapsed members (${count})`)} />
        </Body>
        {#if virtualise}
            <VirtualList keyFn={(user) => user.userId} items={users}>
                {#snippet children(user)}
                    {#if user !== undefined}
                        {@render userView(user)}
                    {/if}
                {/snippet}
            </VirtualList>
        {:else}
            <Container direction={"vertical"}>
                {#each users as user}
                    {#if user !== undefined}
                        {@render userView(user)}
                    {/if}
                {/each}
            </Container>
        {/if}
    {/if}
</Container>
