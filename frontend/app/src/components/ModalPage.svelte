<script lang="ts">
    import Select from "./Select.svelte";
    import { setLocale, supportedLanguages } from "../i18n/i18n";
    import { locale } from "svelte-i18n";
    import { onMount } from "svelte";
    export let minHeight: string | undefined = undefined;
    export let bgClass:
        | "none"
        | "underwater"
        | "woods"
        | "sunset"
        | "error"
        | "upgrade"
        | "empty"
        | "network" = "network";

    onMount(() => {
        document.body.classList.add("fill");
        return () => {
            document.body.classList.remove("fill");
        };
    });

    let selectedLocale = ($locale as string).substring(0, 2);
    $: {
        setLocale(selectedLocale);
    }
</script>

<div class={`modal-page ${bgClass}`}>
    <div class="modal-page-panel" style="min-height: {minHeight}">
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

<style lang="scss">
    :global(.modal-page a) {
        color: var(--modalPage-txt);
    }

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

        &.upgrade {
            @include fullScreenImg("../assets/upgrade.jpg");
        }

        &.empty {
            @include fullScreenImg("../assets/empty.jpg");
        }

        &.network {
            @include fullScreenImg("../assets/network12-md.jpg");

            @include mobile() {
                @include fullScreenImg("../assets/network12-sm.jpg");
            }
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
        border: 1px inset var(--bd);
        @include z-index(login);
        @include size-below(md) {
            width: 100%;
            margin: 0 $sp4;
            padding: $sp4 $sp4;
        }
    }
</style>
