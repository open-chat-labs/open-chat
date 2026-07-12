<script lang="ts">
    import { Avatar, type AvatarSize } from "component-lib";
    import type { Snippet } from "svelte";

    interface Props {
        bot: { avatarUrl?: string };
        size?: AvatarSize;
        children?: Snippet;
    }

    let { bot, size, children }: Props = $props();
</script>

<Avatar {children} url={bot.avatarUrl ?? "/assets/bot_avatar.svg"} {size} />
