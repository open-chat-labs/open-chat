<script lang="ts">
    import {
        AvatarSize,
        OpenChat,
        type NamedAccount,
        type CreatedUser,
        userStore,
    } from "openchat-client";
    import { getContext } from "svelte";
    import Avatar from "../../Avatar.svelte";

    const client = getContext<OpenChat>("client");
    export let address: string | undefined;
    export let accounts: Record<string, NamedAccount>;
    export let currentUser: CreatedUser;

    $: user =
        address === currentUser.cryptoAccount
            ? $userStore.get(currentUser.userId)
            : address
              ? $userStore.get(address)
              : undefined;
</script>

{#if address !== undefined}
    {#if user}
        <div class="user">
            <div class="avatar">
                <Avatar
                    url={client.userAvatarUrl(user)}
                    userId={user.userId}
                    size={AvatarSize.Tiny} />
            </div>
            <div class="name">
                {client.getDisplayName(user)}
            </div>
        </div>
    {:else if accounts[address] !== undefined}
        <div class="account" title={accounts[address].name}>{accounts[address].name}</div>
    {:else}
        <div class="raw" title={address}>{address}</div>
    {/if}
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
