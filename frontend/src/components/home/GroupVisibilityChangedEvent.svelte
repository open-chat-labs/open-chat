<svelte:options immutable={true} />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { UserSummary } from "../../domain/user/user";
    import { _ } from "svelte-i18n";
    import { userStore } from "../../stores/user";

    export let user: UserSummary | undefined;
    export let nowPublic: boolean;
    export let changedBy: string;
    export let timestamp: bigint;

    $: me = changedBy === user?.userId;
    $: changedByStr = me ? $_("you") : $userStore[changedBy]?.username ?? $_("unknownUser");
    $: visibility = (nowPublic ? $_("public") : $_("private")).toLowerCase();
    $: text = $_("groupVisibilityChangedBy", {
        values: {
            changedBy: changedByStr,
            visibility: visibility,
        },
    });
</script>

<NonMessageEvent {text} {timestamp} />
