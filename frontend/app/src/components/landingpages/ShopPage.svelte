<script lang="ts">
    import { onMount } from "svelte";
    import { currentTheme } from "../../theme/themes";

    let iframe: HTMLIFrameElement;

    function setStyleVariables() {
        const params = {
            kind: "shop_theme",
            "--sprd-cta-text-color": $currentTheme.button.txt,
            "--sprd-main2": $currentTheme.button.bg,
            "--sprd-main2-shifted-3": $currentTheme.button.hv,
        };
        iframe?.contentWindow?.postMessage(params, "*");
    }

    onMount(() => {
        iframe.addEventListener("load", setStyleVariables);

        return () => {
            iframe?.removeEventListener("load", setStyleVariables);
        };
    });
</script>

<iframe
    sandbox="allow-scripts allow-popups"
    bind:this={iframe}
    class="swag"
    title="OpenChat shop"
    frameborder="0"
    src="./shop.html"></iframe>

<style lang="scss">
    .swag {
        @include lp-content-padding();
        width: 100%;
        height: 100%;
        position: fixed;
        left: 0;

        @include mobile() {
            margin-top: 0;
            padding: 0;
        }
    }
</style>
