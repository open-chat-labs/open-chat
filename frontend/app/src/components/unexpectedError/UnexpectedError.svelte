<script lang="ts">
    import Button from "../Button.svelte";
    import { _ } from "svelte-i18n";
    import ModalPage from "../ModalPage.svelte";

    export let error = { message: "Unknown error" };
</script>

<ModalPage bgClass="error" minHeight="280px">
    <div class="content">
        <div>
            <h1 class="title">{$_("unexpectedError")}</h1>
            <p class="error-blurb">{$_("errorBlurb")}</p>
        </div>
        <p class="error-message">{error.message}</p>
        <Button on:click={() => location.reload()}>Reload</Button>
    </div>
</ModalPage>

<style lang="scss">
    .content {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        flex: auto;
    }

    .error-message {
        @include font(light, normal, fs-100);
        margin-bottom: $sp5;
    }

    .error-blurb {
        @include font(book, normal, fs-120);
        margin-bottom: $sp5;
    }

    .title {
        @include font(bold, normal, fs-220);
        margin: $sp3 $sp4;
        text-align: center;
        text-shadow: var(--modalPage-txt-sh);
    }
</style>
