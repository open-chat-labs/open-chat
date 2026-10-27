<script lang="ts">
    import {
        allUsersStore,
        AvatarSize,
        namedAccountsStore,
        OpenChat,
        type CreatedUser,
    } from "@client";
    import { counterpartyOf } from "@src/logic/wallet/accountTransactions";
    import { getContext } from "svelte";
    import Avatar from "../../Avatar.svelte";

    const client = getContext<OpenChat>("client");
    interface Props {
        address: string | undefined;
        currentUser: CreatedUser;
    }

    let { address, currentUser }: Props = $props();

    // a user (the current user's own account included), a saved account or the account itself
    let party = $derived(counterpartyOf(address, currentUser, $allUsersStore, $namedAccountsStore));
</script>

{#if party.kind === "user"}
    <div class="user">
        <div class="avatar">
            <Avatar
                url={client.userAvatarUrl(party.user)}
                userId={party.user.userId}
                size={AvatarSize.Tiny} />
        </div>
        <div class="name">
            {client.getDisplayName(party.user.userId)}
        </div>
    </div>
{:else if party.kind === "saved"}
    <div class="account" title={party.name}>{party.name}</div>
{:else if party.kind === "account"}
    <div class="raw" title={party.account}>{party.account}</div>
{/if}

<style lang="scss">
    .user {
        display: flex;
        align-items: center;
        gap: $sp2;
    }
    .raw,
    .account {
        @include ellipsis();
    }
</style>
