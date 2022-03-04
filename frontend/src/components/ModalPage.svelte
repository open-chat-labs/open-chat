<script lang="ts">
    import Select from "./Select.svelte";
    import { setLocale, supportedLanguages } from "../i18n/i18n";
    import { locale } from "svelte-i18n";
    import { ScreenWidth, screenWidth } from "../stores/screenDimensions";

    export let design: "current" | "next" = "current";
    export let bottomBar: "turquoise" | "magenta" | "gold" | "lime" | "none" = "none";

    export let minHeight: string | undefined = undefined;
    export let bgClass:
        | "none"
        | "underwater"
        | "woods"
        | "sunset"
        | "error"
        | "expired"
        | "upgrade"
        | "home"
        | "empty" = "underwater";

    let selectedLocale = ($locale as string).substring(0, 2);
    $: {
        setLocale(selectedLocale);
    }
</script>

<div class={`modal-page ${bgClass}`} class:mobile={$screenWidth === ScreenWidth.ExtraSmall}>
    <div
        class="modal-page-panel"
        style="min-height: {minHeight}"
        class:turquoise={bottomBar === "turquoise"}
        class:magenta={bottomBar === "magenta"}
        class:gold={bottomBar === "gold"}
        class:lime={bottomBar === "lime"}
        class:next={design === "next"}>
        <slot />
    </div>
    <div class="powered-by" />
    <div class="lang">
        <Select bind:value={selectedLocale}>
            {#each supportedLanguages as lang}
                <option value={lang.code}>{lang.name}</option>
            {/each}
        </Select>
    </div>
</div>

<style type="text/scss">
    :global(.lang select.select) {
        @include font(light, normal, fs-90);
        background-color: transparent;
        padding: 0;
        min-width: 80px;
        height: auto;
        border: none;
        border-bottom: 1px solid var(--accent);
        color: #fff;

        option {
            @include font(light, normal, fs-90);
        }
    }

    .lang {
        position: absolute;
        left: $sp3;
        top: $sp3;
    }
    .powered-by {
        background-image: url("../assets/ic-badge-powered-by_label-stripe-white-text.svg");
        position: absolute;
        bottom: 0;
        height: 40px;
        left: 0;
        right: 0;
        background-repeat: no-repeat;
        background-position: center;
    }
    .modal-page {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;

        &.home {
            @include fullScreenImg("../assets/home_large.png");

            &.mobile {
                @include fullScreenImg("../assets/home_small.png");
            }
        }

        &.underwater {
            @include fullScreenImg("../assets/underwater.jpg");
        }

        &.woods {
            @include fullScreenImg("../assets/woods.jpg");
        }

        &.sunset {
            @include fullScreenImg("../assets/sunset.jpg");
        }

        &.error {
            @include fullScreenImg("../assets/error.jpg");
        }

        &.expired {
            @include fullScreenImg("../assets/expired.jpg");
        }

        &.upgrade {
            @include fullScreenImg("../assets/upgrade.jpg");
        }

        &.empty {
            @include fullScreenImg("../assets/empty.jpg");
        }

        @include fullHeight();
    }
    .modal-page-panel {
        padding: $sp5 $sp6;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        text-align: center;
        align-items: center;
        border-radius: $sp5;
        width: 50%;
        max-width: 500px;
        background-color: var(--modalPage-bg);
        color: var(--modalPage-txt);
        box-shadow: var(--modalPage-sh);
        backdrop-filter: var(--modalPage-filter);
        -webkit-backdrop-filter: var(--modalPage-filter);
        border: var(--modalPage-bd);
        @include z-index(login);
        @include size-below(md) {
            width: 100%;
            margin: 0 $sp4;
            padding: $sp4 $sp4;
        }

        &.next {
            background-color: #111;
            border-radius: 0;
            box-shadow: none;
            border: none;
            width: auto;
            padding: $sp4 $sp6;

            &.turquoise {
                border-bottom: 6px solid #05bcc3;
            }
            &.magenta {
                border-bottom: 6px solid #970c80;
            }
            &.gold {
                border-bottom: 6px solid #d79323;
            }
            &.lime {
                border-bottom: 6px solid #59cd07;
            }
        }
    }
</style>
