<script lang="ts">
    import { onMount } from "svelte";

    const scriptSrc =
        "https://openchat.myspreadshop.com/shopfiles/shopclient/shopclient.nocache.js";

    function loadScript(): Promise<void> {
        return new Promise((resolve, reject) => {
            const el = document.querySelector(`script[src="${scriptSrc}"]`);
            if (el) {
                console.debug("SHOP: script already found - removing");
                el.remove();
            }

            const script = document.createElement("script");
            script.src = scriptSrc;
            script.onload = () => {
                console.debug("SHOP: script successfully loaded");
                resolve();
            };
            script.onerror = () =>
                reject(new Error(`SHOP: Error loading the shop script ${scriptSrc}`));
            document.head.append(script);
        });
    }

    onMount(() => {
        //@ts-ignore
        window["spread_shop_config"] = {
            shopName: "openchat",
            locale: "us_US",
            prefix: "https://openchat.myspreadshop.com",
            baseId: "oc-shop",
            updateMetadata: false,
        };
        loadScript();
    });
</script>

<div class="swag">
    <div id="oc-shop"></div>
</div>

<style lang="scss">
    :global(.swag) {
        // These are the theme variables - it does not seem officially supported to override them
        // so probably safer to go with a light touch.

        // --sprd-main1: #000000;
        // --sprd-main2: #1e90ff;
        // --sprd-main3: #ffffff;
        // --sprd-sub2: #000000;
        // --sprd-sub3: #ffffff;
        // --sprd-main3-dec: 255, 255, 255;
        // --sprd-cta-text-color: #000000;
        // --sprd-main1-shifted: #808080;
        // --sprd-main2-shifted: #8fc8ff;
        // --sprd-main3-shifted: #cccccc;
        // --sprd-sub2-shifted: #808080;
        // --sprd-sub3-shifted: #cccccc;
        // --sprd-sub2-shifted-2: #bfbfbf;
        // --sprd-main2-shifted-3: #4ba6ff;

        // We will just override a couple of bits - any more is a bit risky
        --sprd-cta-text-color: var(--button-txt);
        --sprd-main2: var(--button-bg);
        --sprd-main2-shifted-3: var(--button-hv);
    }
    .swag {
        @include lp-content-padding();

        @include mobile() {
            margin-top: 0;
            padding: 0;
        }
    }
</style>
