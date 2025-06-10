<script lang="ts">
    import { AvatarSize } from "openchat-client";
    import Avatar from "../Avatar.svelte";

    interface Props {
        bot: { avatarUrl?: string };
    }

    let { bot }: Props = $props();
</script>

<Avatar url={bot.avatarUrl ?? "/assets/bot_avatar.svg"} size={AvatarSize.Default} />
