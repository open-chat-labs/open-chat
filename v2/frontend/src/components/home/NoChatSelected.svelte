<script lang="ts">
    import { _ } from "svelte-i18n";
</script>

<div class="wrapper">
    <h1 class="title">{$_("noChatSelected")}</h1>
    <p class="subtitle">{$_("selectAChat")}</p>
</div>

<style type="text/scss">
    .wrapper {
        background-color: var(--currentChat-header-bg);
        color: var(--currentChat-header-txt);

        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        height: 100%;
    }

    .subtitle {
        margin-bottom: $sp5;
    }

    .title {
        @include font(bold, normal, fs-180);
        margin-bottom: $sp3;
    }
</style>
