<script lang="ts">
    import { toLongDateString, toShortTimeString } from "../../../utils/date";
    import type { Alert } from "../../../domain/chat/chat";

    export let alert: Alert;
    export let unread: boolean;

    $: date = new Date(Number(alert.elapsed));
    $: timestamp = `${toLongDateString(date)} @ ${toShortTimeString(date)}`;
</script>

<div class="alert" class:unread>
    <slot details={alert.details} {timestamp} />
</div>

<style type="text/scss">
    .alert {
        padding: 10px 12px;
        background-color: var(--participants-bg);
        color: var(--participants-txt);
        @include box-shadow(1);
        margin-bottom: $sp3;
        transition: background-color ease-in-out 100ms, border-color ease-in-out 100ms;
        @include font(light, normal, fs-90);
        border-left: solid 6px transparent;

        &:last-child {
            margin-bottom: 0;
        }

        &:hover {
            background-color: var(--participants-hv);
        }

        &.unread {
            border-left: solid 6px var(--accent);
        }
    }
</style>
