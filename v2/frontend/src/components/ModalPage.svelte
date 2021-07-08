<script lang="ts">
    export let minHeight: string | undefined = undefined;
    export let bgClass:
        | "underwater"
        | "woods"
        | "sunset"
        | "error"
        | "expired"
        | "upgrade"
        | "empty" = "underwater";
</script>

<div class={`modal-page ${bgClass}`}>
    <div class="modal-page-panel" style="min-height: {minHeight}">
        <slot />
    </div>
</div>

<style type="text/scss">
    .modal-page {
        display: flex;
        justify-content: center;
        align-items: center;

        &.underwater {
            @include fullScreenImg("../assets/underwater.jpg");
        }

        &.woods {
            @include fullScreenImg("../assets/woods.jpg");
        }

        &.sunset {
            @include fullScreenImg("../assets/sunset.jpg");
        }

        &.error {
            @include fullScreenImg("../assets/error.jpg");
        }

        &.expired {
            @include fullScreenImg("../assets/expired.jpg");
        }

        &.upgrade {
            @include fullScreenImg("../assets/upgrade.jpg");
        }

        &.empty {
            @include fullScreenImg("../assets/empty.jpg");
        }

        @include fullHeight();
    }
    .modal-page-panel {
        padding: $sp5 $sp6;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        text-align: center;
        align-items: center;
        border-radius: $sp5;
        width: 50%;
        max-width: 500px;
        background-color: var(--modalPage-bg);
        color: var(--modalPage-txt);
        box-shadow: var(--modalPage-sh);
        backdrop-filter: var(--modalPage-filter);
        -webkit-backdrop-filter: var(--modalPage-filter);
        border: var(--modalPage-bd);
        @include z-index(login);
        @include size-below(md) {
            width: 100%;
            margin: 0 $sp4;
        }
    }
</style>
