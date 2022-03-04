<script lang="ts">
    import { _ } from "svelte-i18n";
    import { createEventDispatcher } from "svelte";
    import ModalPage from "./ModalPage.svelte";
    import Logo from "./Logo.svelte";
    import OpenChat from "./ModalTitle.svelte";
    const dispatch = createEventDispatcher();
    export let loading: boolean = false;
</script>

<ModalPage bgClass="home" design="next" bottomBar={loading ? "magenta" : "turquoise"}>
    <OpenChat text={$_("open_chat")} />
    <Logo {loading} />
    <div class:loading class="sign-in" on:click={() => dispatch("login")}>{$_("login.signIn")}</div>
</ModalPage>

<style type="text/scss">
    .sign-in {
        @include font(light, normal, fs-80);
        margin-top: $sp3;
        font-weight: 300;
        letter-spacing: 4px;
        color: #c6c3d0;
        text-transform: lowercase;
        padding: $sp4;
        cursor: pointer;

        &.loading {
            visibility: hidden;
        }
    }
</style>
