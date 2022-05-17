<script lang="ts">
    import type { BlockedFromGroupAlert } from "../../../domain/chat/chat";
    import { _ } from "svelte-i18n";
    import { userStore } from "../../../stores/user";

    export let details: BlockedFromGroupAlert;

    $: username = $userStore[details.blockedBy]?.username ?? $_("unknown");
</script>

<div class="details">
    <div class="msg">
        {$_("alerts.blockedBy", { values: { groupname: "Group One", username } })}
    </div>
</div>

<style type="text/scss">
</style>
