<script lang="ts">
    import { toLongDateString, toShortTimeString } from "../../../utils/date";
    import type { Alert } from "../../../domain/chat/chat";

    export let alert: Alert;

    $: date = new Date(Number(alert.elapsed));
</script>

<div class="alert">
    <slot details={alert.details} />
    <p class="timestamp">{`${toLongDateString(date)} @ ${toShortTimeString(date)}`}</p>
</div>

<style type="text/scss">
    .alert {
        padding: $sp3;
        background-color: #efefef;
        @include box-shadow(1);
        margin-bottom: $sp3;

        &:last-child {
            margin-bottom: 0;
        }
    }

    .timestamp {
        margin-top: $sp3;
        @include font(light, normal, fs-70);
    }
</style>
