<script lang="ts">
    import Logo from "../Logo.svelte";
    import { _ } from "svelte-i18n";
    import ModalPage from "../ModalPage.svelte";
    import EnterPhoneNumber from "./EnterPhoneNumber.svelte";
    import EnterUsername from "./EnterUsername.svelte";
    import EnterCode from "./EnterCode.svelte";
    export let awaitingPhoneNumber: boolean;
    export let awaitingCode: boolean;
    export let verifying: boolean;
    export let codeValid: boolean;
</script>

<ModalPage>
    <h4 class="subtitle">{$_("register.tellUsWho")}</h4>
    <Logo />
    <h1 class="title">{$_("register.registerAs")}</h1>

    {#if awaitingPhoneNumber}
        <EnterPhoneNumber on:submitPhoneNumber />
    {:else if awaitingCode}
        <EnterCode on:submitCode />
    {:else if verifying}
        <div class="spinner" />
    {:else if codeValid}
        <EnterUsername on:submitUsername />
    {/if}
</ModalPage>

<style type="text/scss">
    @import "../../styles/mixins";

    .spinner {
        height: 100px;
        width: 100%;
        @include loading-spinner(3em, 1.5em, false, hotpink);
    }

    .subtitle {
        @include font(bold, normal, fs-140);
        margin-bottom: $sp5;
    }

    .title {
        @include font(bold, normal, fs-220);
        margin: $sp3 $sp4;
    }
</style>
