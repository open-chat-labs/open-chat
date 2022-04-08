<script lang="ts">
    import Link from "./Link.svelte";
    import ModalPage from "./ModalPage.svelte";
    import { _ } from "svelte-i18n";
    import { push } from "svelte-spa-router";
</script>

<ModalPage bgClass="empty" minHeight="200px">
    <div class="content">
        <div>
            <h1 class="msg">404</h1>
            <Link underline={"always"} on:click={() => push("/")}>{$_("home")}</Link>
        </div>
    </div>
</ModalPage>

<style type="text/scss">
    .msg {
        font-weight: bold;
        font-size: 6.25rem;
        text-shadow: 3px 3px #000;
        color: #ffffff;
    }
</style>
