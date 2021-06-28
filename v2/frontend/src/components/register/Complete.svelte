<script lang="ts">
    import Logo from "../Logo.svelte";
    import { _ } from "svelte-i18n";
    import Button from "../Button.svelte";
    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();

    function complete() {
        dispatch("complete");
    }
</script>

<h4 class="subtitle">{$_("register.registrationComplete")}</h4>
<Logo />
<h1 class="title">{$_("register.welcome")}</h1>
<p class="enjoy">{$_("register.enjoy")}</p>
<Button on:click={complete}>{$_("register.letsGo")}</Button>

<style type="text/scss">
    @import "../../styles/mixins";

    .subtitle {
        @include font(bold, normal, fs-140);
        margin-bottom: $sp5;
    }

    .title {
        @include font(bold, normal, fs-220);
        margin: $sp3 $sp4;
        text-align: center;
    }

    .enjoy {
        @include font(light, normal, fs-100);
        margin-top: $sp5;
        margin-bottom: $sp7;
    }
</style>
