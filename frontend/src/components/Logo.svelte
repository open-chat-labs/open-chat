<script lang="ts">
    export let loading: boolean = false;
</script>

<div class:loading class="logo" />

<style type="text/scss">
    .logo {
        width: 80px;
        height: 80px;
        background-image: url("../assets/new-logo.svg");

        &.loading {
            @include spin(1.5s);
        }
    }
</style>
