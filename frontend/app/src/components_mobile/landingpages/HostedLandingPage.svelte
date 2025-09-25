<script lang="ts">
    // This is meant to be shown when OpenChat is being hosted in an iframe
    import FancyLoader from "../icons/FancyLoader.svelte";
    import Launch from "./Launch.svelte";
</script>

<div class="wrapper">
    <div class="logo-img">
        <FancyLoader loop={false} />
    </div>
    <h1 class="title">powered by OpenChat</h1>
    <div class="launch">
        <Launch text="Launch chat" login />
    </div>
</div>

<style lang="scss">
    .wrapper {
        height: 100vh;
        padding: toRem(20);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: $sp4;
    }
    .logo-img {
        height: 100px;
        width: 100px;

        @include mobile() {
            height: 60px;
            width: 60px;
        }
    }
</style>
