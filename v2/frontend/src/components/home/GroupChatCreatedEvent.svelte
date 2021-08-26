<svelte:options immutable={true} />

<script lang="ts">
    import type { UserLookup } from "../../domain/user/user";
    import type { GroupChatCreated } from "../../domain/chat/chat";
    import { _ } from "svelte-i18n";
    import { toLongDateString, toShortTimeString } from "../../utils/date";

    export let userLookup: UserLookup;
    export let me: boolean;
    export let event: GroupChatCreated;
    export let timestamp: bigint;

    $: date = new Date(Number(timestamp));
</script>

<div class="created-group">
    <p class="created-by">
        {$_("groupCreatedBy")}
    </p>
    <h5 class="username">
        {me ? $_("you") : userLookup[event.created_by].username}
    </h5>
    <p class="created-at">{`${toLongDateString(date)} @ ${toShortTimeString(date)}`}</p>
</div>

<style type="text/scss">
    .created-group {
        padding: $sp2;
        background-color: var(--timeline-bg);
        margin: $sp5 auto;
        text-align: center;
        color: var(--timeline-txt);
    }

    .username {
        @include font(bold, normal, fs-100);
    }

    .created-by,
    .created-at {
        @include font(light, normal, fs-70);
    }
</style>
