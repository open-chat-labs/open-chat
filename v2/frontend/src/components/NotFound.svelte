<script lang="ts">
    import Button from "./Button.svelte";
</script>

<div class="background">
    <div class="msg">404</div>
    <a href="/#">home</a>
</div>

<style type="text/scss">
    @import "../styles/mixins";
    .background {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        @include fullHeight();
        @include fullScreenImg("../assets/empty.jpg");
    }
    .msg {
        font-weight: bold;
        font-size: 100px;
        text-shadow: 3px 3px #000;
        color: #ffffff;
    }
</style>
