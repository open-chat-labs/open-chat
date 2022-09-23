<script lang="ts">
    import ModalPage from "./ModalPage.svelte";
    import Markdown from "./home/Markdown.svelte";
    import Button from "./Button.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();
</script>

<ModalPage>
    <h4 class="title">{$_("switchDomain.title")}</h4>

    <div class="blurb">
        <Markdown
            text={$_("switchDomain.blurb", {
                values: { currentDomain: window.location.origin },
            })} />
    </div>

    <Button tiny on:click={() => dispatch("dismissDomainWarning")}
        >{$_("switchDomain.continue")}</Button>
</ModalPage>

<style type="text/scss">
    .title {
        @include font(bold, normal, fs-120);
        margin-bottom: $sp5;
    }
</style>
