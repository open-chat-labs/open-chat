<script lang="ts">
    import { Avatar, type AvatarSize } from "component-lib";

    interface Props {
        bot: { avatarUrl?: string };
        size?: AvatarSize;
    }

    let { bot, size }: Props = $props();
</script>

<Avatar url={bot.avatarUrl ?? "/assets/bot_avatar.svg"} {size} />
