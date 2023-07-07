<script lang="ts">
    import { _ } from "svelte-i18n";
    import { Confetti } from "svelte-confetti";

    export let para = $_("upgrade.congratulations");
</script>

<div class="confirmed">
    <h1>{$_("congratulations")}</h1>
    <p class="tada">🎉</p>
    <p class="para">{para}</p>
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
