<script lang="ts">
    import { AvatarSize } from "@client";
    import Avatar from "@src/desktop/shared/Avatar.svelte";

    interface Props {
        bot: { avatarUrl?: string };
        size?: AvatarSize;
    }

    let { bot, size = AvatarSize.Default }: Props = $props();
</script>

<Avatar url={bot.avatarUrl ?? "/assets/bot_avatar.svg"} {size} />
