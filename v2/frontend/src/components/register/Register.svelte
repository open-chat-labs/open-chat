<script lang="ts">
    import Logo from "../Logo.svelte";
    import { _ } from "svelte-i18n";
    import ModalPage from "../ModalPage.svelte";
    import EnterPhoneNumber from "./EnterPhoneNumber.svelte";
    import Complete from "./Complete.svelte";
    import EnterUsername from "./EnterUsername.svelte";
    import EnterCode from "./EnterCode.svelte";
    import type { RegisterState } from "./Register.types";
    export let state: RegisterState;
    export let username: string = "";
    export let error: string | undefined = undefined;
</script>

<ModalPage minHeight="380px">
    {#if state === "awaitingCompletion"}
        <Complete on:complete />
    {:else}
        <h4 class="subtitle">{$_("register.tellUsWho")}</h4>
        <Logo />
        <h1 class="title">{$_("register.registerAs")}</h1>

        {#if state === "awaitingPhoneNumber"}
            <EnterPhoneNumber {error} on:submitPhoneNumber />
        {:else if state === "awaitingCode"}
            <EnterCode {error} on:submitCode on:resendCode />
        {:else if state === "verifying"}
            <div class="spinner" />
        {:else if state === "awaitingUsername"}
            <EnterUsername {username} {error} on:submitUsername />
        {/if}
    {/if}
</ModalPage>

<style type="text/scss">
    @import "../../styles/mixins";

    .spinner {
        height: 150px;
        width: 100%;
        @include loading-spinner(3em, 1.5em, false, var(--button-bg));
    }

    .subtitle {
        @include font(bold, normal, fs-140);
        margin-bottom: $sp5;
        text-shadow: var(--modalPage-txt-sh);
    }

    .title {
        @include font(bold, normal, fs-220);
        margin: $sp3 $sp4;
        text-align: center;
        text-shadow: var(--modalPage-txt-sh);
    }

    .enjoy {
        margin-top: $sp5;
        margin-bottom: $sp7;
    }
</style>
