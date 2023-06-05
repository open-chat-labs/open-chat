<script lang="ts">
    import Link from "./Link.svelte";
    import ModalPage from "./ModalPage.svelte";
    import { _ } from "svelte-i18n";
    import page from "page";
</script>

<ModalPage bgClass="none" minHeight="200px">
    <div class="not-found" />
    <div class="content">
        <div>
            <h1 class="msg">404</h1>
            <Link underline={"always"} on:click={() => page("/")}>{$_("home")}</Link>
        </div>
    </div>
</ModalPage>

<style lang="scss">
    .msg {
        @include font(bold, normal, fs-260);
        text-shadow: 3px 3px #000;
        color: #ffffff;
    }

    .not-found {
        background-image: url("../assets/not_found.svg");
        width: 400px;
        height: 420px;

        @include mobile() {
            width: 200px;
            height: 210px;
        }
    }
</style>
