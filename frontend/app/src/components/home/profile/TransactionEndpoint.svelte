<script lang="ts">
    import { AvatarSize, OpenChat, type NamedAccount, toRecord } from "openchat-client";
    import { getContext } from "svelte";
    import Avatar from "../../Avatar.svelte";

    const client = getContext<OpenChat>("client");
    export let address: string | undefined;
    export let accounts: NamedAccount[];

    $: userStore = client.userStore;
    $: user = address ? $userStore[address] : undefined;
    $: accountLookup = toRecord(accounts, (a) => a.account);
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
    {:else if accountLookup[address] !== undefined}
        <div class="account" title={accountLookup[address].name}>{accountLookup[address].name}</div>
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
