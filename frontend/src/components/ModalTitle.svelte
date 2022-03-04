<script lang="ts">
    import { _ } from "svelte-i18n";

    export let text: string;
</script>

<h1 class="title">{text}</h1>

<style type="text/scss">
    .title {
        @include font(light, normal, fs-120);
        font-weight: 300;
        letter-spacing: 6px;
        color: #c6c3d0;
        text-transform: uppercase;
        margin: 0 0 $sp4 0;
    }
</style>
