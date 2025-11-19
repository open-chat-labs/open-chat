<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Body, Container } from "component-lib";
    import { currentUserIdStore, type UserSummary } from "openchat-client";
    import Account from "svelte-material-icons/AccountGroupOutline.svelte";
    import AccountPlus from "svelte-material-icons/AccountPlusOutline.svelte";
    import Translatable from "../../Translatable.svelte";
    import VirtualList from "../../VirtualList.svelte";
    import NothingToSee from "../NothingToSee.svelte";
    import InvitedUser from "./InvitedUser.svelte";
    import InviteUser from "./InviteUser.svelte";
    import type { MemberManagement } from "./membersState.svelte";

    interface Props {
        users: UserSummary[];
        frequent: UserSummary[];
        membersState: MemberManagement;
        searchTerm?: string;
        count: number;
        onReset: () => void;
    }
    let { users, membersState, searchTerm, count, onReset, frequent }: Props = $props();
    let virtualise = $derived(users.length > 50);

    /**
     * We have "adding", "inviting" and "sharing"
     * Add members and invite users and controlled by two separate permissions
     * You can only "add" an existing community member
     * You can "invite" anyone
     *
     * groups:
     *      public group: invite, share url
     *      private group: invite, enable url
     *
     * communities:
     *      public community: invite, share url
     *      private community: invite, enable url
     *
     * channels:
     *      public community:
     *          private channel: invite, enable link
     *          public channel: invite, share url
     *
     *      private community:
     *          private channel: add community member, invite, enable link
     *          public channel: add community member, invite, share url
     *
     */
</script>

{#snippet userView(user: UserSummary, invited: boolean)}
    {@const me = user.userId === $currentUserIdStore}
    <Container padding={["md", "zero"]}>
        {#if invited}
            <InvitedUser
                {searchTerm}
                {me}
                {user}
                onCancelInvite={invited && membersState.canUninvite()
                    ? (userId) => membersState.cancelInvites([userId])
                    : undefined} />
        {:else}
            <InviteUser
                {searchTerm}
                {me}
                {user}
                onInvite={membersState.canInvite()
                    ? (userId) => membersState.inviteUser(userId)
                    : undefined} />
        {/if}
    </Container>
{/snippet}

{#snippet membersIcon(color: string, size: string)}
    <Account {color} {size} />
{/snippet}

<Container height={{ kind: "fill" }} padding={["zero", "md"]} gap={"xl"} direction={"vertical"}>
    {#if count === 0 && frequent.length === 0}
        <NothingToSee
            reset={{ onClick: onReset, icon: membersIcon, text: "View all members" }}
            padding={["huge", "xxl"]}
            title={"No invited users"}
            subtitle={"There are no users waiting to accept your invitation. When you invite users, they will appear hear until they accept."}>
            {#snippet icon(color, size)}
                <AccountPlus {color} {size} />
            {/snippet}
        </NothingToSee>
    {:else}
        {#if frequent.length > 0}
            <Body fontWeight={"bold"}>
                <Translatable
                    resourceKey={i18nKey(`Frequently contacted users (${frequent.length})`)} />
            </Body>
            <Container direction={"vertical"}>
                {#each frequent as user}
                    {#if user !== undefined}
                        {@render userView(user, false)}
                    {/if}
                {/each}
            </Container>
        {/if}

        {#if count > 0}
            <Body fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey(`Previously invited users (${count})`)} />
            </Body>
            <Body colour={"textSecondary"}>
                <Translatable
                    resourceKey={i18nKey(
                        "Users which have been invited to this group, but have not accepted the invite yet.",
                    )} />
            </Body>
            {#if virtualise}
                <VirtualList keyFn={(user) => user.userId} items={users}>
                    {#snippet children(user)}
                        {#if user !== undefined}
                            {@render userView(user, true)}
                        {/if}
                    {/snippet}
                </VirtualList>
            {:else}
                <Container direction={"vertical"}>
                    {#each users as user}
                        {#if user !== undefined}
                            {@render userView(user, true)}
                        {/if}
                    {/each}
                </Container>
            {/if}
        {/if}
    {/if}
</Container>
