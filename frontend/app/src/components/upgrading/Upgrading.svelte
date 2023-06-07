<script lang="ts">
    import { _ } from "svelte-i18n";
    import ModalPage from "../ModalPage.svelte";
</script>

<ModalPage bgClass="upgrade" minHeight="150px">
    <div>
        <h1 class="title">{$_("performingUpgrade")}</h1>
        <p class="blurb">{$_("pleaseWait")}</p>
    </div>
    <div class="spinner" />
</ModalPage>

<style lang="scss">
    .blurb {
        @include font(light, normal, fs-120);
        margin-bottom: $sp6;
    }

    .title {
        @include font(bold, normal, fs-220);
        margin: $sp4;
        text-align: center;
        text-shadow: var(--modalPage-txt-sh);
    }

    .spinner {
        height: 80px;
        width: 100%;
        @include loading-spinner(3em, 1.5em, var(--button-bg));
    }
</style>
