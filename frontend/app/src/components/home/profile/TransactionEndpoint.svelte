<script lang="ts">
    import { AvatarSize, OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import Avatar from "../../Avatar.svelte";

    const client = getContext<OpenChat>("client");
    export let address: string | undefined;

    $: userStore = client.userStore;
    $: user = address ? $userStore[address] : undefined;
</script>

{#if user}
    <div class="user">
        <div class="avatar">
            <Avatar url={client.userAvatarUrl(user)} userId={user.userId} size={AvatarSize.Tiny} />
        </div>
        <div class="name">
            {client.getDisplayName(user)}
        </div>
    </div>
{/if}

<style lang="scss">
    .user {
        display: flex;
        align-items: center;
        gap: $sp2;
    }
</style>
