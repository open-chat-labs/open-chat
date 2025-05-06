<script lang="ts">
    import {
        AvatarSize,
        OpenChat,
        userStore,
        type CreatedUser,
        type NamedAccount,
    } from "openchat-client";
    import { getContext } from "svelte";
    import Avatar from "../../Avatar.svelte";

    const client = getContext<OpenChat>("client");
    interface Props {
        address: string | undefined;
        accounts: Record<string, NamedAccount>;
        currentUser: CreatedUser;
    }

    let { address, accounts, currentUser }: Props = $props();

    let user = $derived(
        address === currentUser.cryptoAccount
            ? userStore.get(currentUser.userId)
            : address
              ? userStore.get(address)
              : undefined,
    );
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
