<script lang="ts">
    import Button from "../Button.svelte";
    import { _ } from "svelte-i18n";
    import ModalPage from "../ModalPage.svelte";
    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();
</script>

<ModalPage bgClass="woods" minHeight="200px">
    <div class="content">
        <div>
            <h1 class="title">{$_("sessionExpired")}</h1>
            <p class="blurb">{$_("sessionExpiredBlurb")}</p>
        </div>
        <Button on:click={() => dispatch("login")}>{$_("login.signIn")}</Button>
    </div>
</ModalPage>

<style type="text/scss">
    @import "../../styles/mixins";

    .content {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        flex: auto;
    }

    .blurb {
        @include font(light, normal, fs-120);
        margin-bottom: $sp6;
    }

    .title {
        @include font(bold, normal, fs-230);
        margin: $sp4;
        text-align: center;
        text-shadow: var(--modalPage-txt-sh);
    }
</style>
