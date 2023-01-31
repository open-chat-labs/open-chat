<script lang="ts">
    import { _ } from "svelte-i18n";
</script>

<div class="confirmed">
    <h1>{$_("congratulations")}</h1>
    <p class="tada">🎉</p>
    <p class="para">{$_("upgrade.congratulations")}</p>
</div>

<style type="text/scss">
    .confirmed {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        text-align: center;

        h1 {
            @include font(bold, normal, fs-160);
            margin-bottom: $sp4;
        }

        .tada {
            @include font-size(fs-220);
            margin-bottom: $sp4;
        }
    }

    .para {
        margin-bottom: $sp3;
    }
</style>
