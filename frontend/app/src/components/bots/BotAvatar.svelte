<script lang="ts">
    import { AvatarSize } from "openchat-client";
    import Avatar from "../Avatar.svelte";

    interface Props {
        bot: { avatarUrl?: string };
        size?: AvatarSize;
    }

    let { bot, size = AvatarSize.Default }: Props = $props();
</script>

<Avatar url={bot.avatarUrl ?? "/assets/bot_avatar.svg"} {size} />
