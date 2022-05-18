<script lang="ts">
    import type { BlockedFromGroupAlert } from "../../../domain/chat/chat";
    import Timestamp from "./Timestamp.svelte";
    import { _ } from "svelte-i18n";
    import Markdown from "../Markdown.svelte";
    import { AvatarSize } from "../../../domain/user/user";
    import Avatar from "../../Avatar.svelte";
    import { userStore } from "../../../stores/user";
    import { avatarUrl } from "../../../domain/user/user.utils";

    export let details: BlockedFromGroupAlert;
    export let timestamp: string;

    $: user = $userStore[details.blockedBy];
    $: username = user?.username ?? $_("unknown");
</script>

<div class="details">
    <div class="avatar">
        <Avatar url={avatarUrl(user)} size={AvatarSize.Medium} />
    </div>
    <div class="msg">
        <Markdown
            text={$_("alerts.blockedBy", {
                values: { groupname: details.groupName || $_("alerts.unknownGroup"), username },
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
