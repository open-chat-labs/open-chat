<script lang="ts">
    import type { GroupDeletedAlert } from "../../../domain/chat/chat";
    import Timestamp from "./Timestamp.svelte";
    import { _ } from "svelte-i18n";
    import Markdown from "../Markdown.svelte";
    import { AvatarSize } from "../../../domain/user/user";
    import Avatar from "../../Avatar.svelte";
    import { userStore } from "../../../stores/user";
    import { avatarUrl } from "../../../domain/user/user.utils";

    export let groupName: string;
    export let timestamp: string;
    export let userId: string;
    export let msgKey: string;

    $: user = $userStore[userId];
    $: username = user?.username ?? $_("unknown");
</script>

<div class="details">
    <div class="avatar">
        <Avatar url={avatarUrl(user)} size={AvatarSize.Medium} />
    </div>
    <div class="msg">
        <Markdown
            text={$_(msgKey, {
                values: { groupname: groupName || $_("alerts.unknownGroup"), username },
            })} />
        <Timestamp {timestamp} />
    </div>
</div>

<style type="text/scss">
    .details {
        display: flex;
        align-items: center;
        gap: $sp4;
    }
</style>
