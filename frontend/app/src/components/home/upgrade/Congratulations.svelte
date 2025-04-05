<script lang="ts">
    import { Confetti } from "svelte-confetti";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";

    let { para = i18nKey("upgrade.congratulations") } = $props();
</script>

<div class="confirmed">
    <h1><Translatable resourceKey={i18nKey("congratulations")} /></h1>
    <p class="tada">🎉</p>
    <p class="para"><Translatable resourceKey={para} /></p>
    <div class="tada">
        <div class="confetti">
            <Confetti />
        </div>
    </div>
</div>

<style lang="scss">
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

    .tada {
        position: relative;

        .confetti {
            position: absolute;
            pointer-events: none;
            top: 50%;
            left: 50%;
        }
    }

    .para {
        margin-bottom: $sp3;
    }
</style>
