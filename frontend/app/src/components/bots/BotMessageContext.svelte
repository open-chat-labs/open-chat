<script lang="ts">
    import { AvatarSize, OpenChat, userStore, type BotMessageContext } from "openchat-client";
    import Markdown from "../home/Markdown.svelte";
    import Avatar from "../Avatar.svelte";
    import { getContext } from "svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        botContext: BotMessageContext;
        botName: string;
    }

    let { botContext }: Props = $props();

    let text = $derived(`@UserId(${botContext.initiator}) used **${botContext.commandText}**`);
    let user = $derived($userStore.get(botContext.initiator));
</script>

<div class="bot-context">
    {#if user}
        <Avatar url={client.userAvatarUrl(user)} userId={user.userId} size={AvatarSize.Tiny} />
    {/if}
    <Markdown {text} />
</div>

<style lang="scss">
    .bot-context {
        @include font(light, normal, fs-70);
        color: var(--txt-light);
        display: flex;
        gap: $sp2;
        align-items: center;
    }
</style>
