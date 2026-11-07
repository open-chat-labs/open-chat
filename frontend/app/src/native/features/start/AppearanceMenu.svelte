<!-- Welcome's Appearance menu (native design notes §3.1, the Native Prototype's): the theme (Light,
     Dark, System) and the accent, from the stored settings the whole app and the web use (themeType,
     accentStore), so You → Appearance shows the same. A pick applies at once, behind the open menu,
     which stays open. It hangs under the pill at the trailing edge, over a transparent veil: a tap
     on the veil, Esc or Android's back (Welcome's overlay) closes it, and focus goes back to the
     trigger. ↑ ↓ move between the themes, ← → between the swatches, Tab between the two. -->
<script lang="ts">
    import { PAGE_ACCENTS, type PageAccent } from "@openchat/ui/src/pages/types";
    import { themePrefOf } from "@src/logic/profile/appearance";
    import { accentStore } from "@theme/accent";
    import { themeType } from "@theme/themes";
    import { onMount, tick } from "svelte";
    import { _ } from "svelte-i18n";

    type Props = { trigger: HTMLElement | undefined; onClose: () => void };

    let { trigger, onClose }: Props = $props();

    const THEMES = [
        { id: "light", icon: "sun" },
        { id: "dark", icon: "moon" },
        { id: "system", icon: "smartphone" },
    ] as const;
    const THEME_IDS = THEMES.map((t) => t.id);

    let menu = $state<HTMLDivElement>();

    // the selected item of each group is the one Tab reaches (a roving tab stop)
    const theme = $derived(themePrefOf($themeType));

    onMount(() => {
        void focusSelected("theme");
        return () => trigger?.focus();
    });

    async function focusSelected(group: "theme" | "accent") {
        await tick();
        menu?.querySelector<HTMLElement>(`[data-group="${group}"] [tabindex="0"]`)?.focus();
    }

    function pickTheme(id: (typeof THEMES)[number]["id"]) {
        themeType.set(id);
    }

    function pickAccent(accent: PageAccent) {
        accentStore.set(accent);
    }

    // an item's keys: Enter / Space pick it; the arrows move within its group (and pick, as radios
    // do), wrapping round; ← → follow the reading direction
    function itemKey<T>(
        e: KeyboardEvent,
        items: readonly T[],
        item: T,
        axis: "vertical" | "horizontal",
        pick: (t: T) => void,
        group: "theme" | "accent",
    ) {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            pick(item);
            return;
        }
        const rtl = getComputedStyle(e.currentTarget as Element).direction === "rtl";
        const [back, on] =
            axis === "vertical"
                ? ["ArrowUp", "ArrowDown"]
                : rtl
                  ? ["ArrowRight", "ArrowLeft"]
                  : ["ArrowLeft", "ArrowRight"];
        const step = e.key === back ? -1 : e.key === on ? 1 : 0;
        if (step === 0) return;
        e.preventDefault();
        const i = items.indexOf(item);
        pick(items[(i + step + items.length) % items.length]);
        void focusSelected(group);
    }

    function keydown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            e.preventDefault();
            onClose();
        }
    }
</script>

<div class="veil" onclick={onClose} aria-hidden="true"></div>
<!-- svelte-ignore a11y_interactive_supports_focus -->
<div
    class="menu"
    role="menu"
    tabindex="-1"
    aria-label={$_("native.start.appearance.title")}
    bind:this={menu}
    onkeydown={keydown}
>
    <span class="label" aria-hidden="true">{$_("native.start.appearance.theme")}</span>
    <div
        class="themes"
        role="group"
        aria-label={$_("native.start.appearance.theme")}
        data-group="theme"
    >
        {#each THEMES as t (t.id)}
            {@const on = t.id === theme}
            <div
                class="row"
                role="menuitemradio"
                aria-checked={on}
                tabindex={on ? 0 : -1}
                onclick={() => pickTheme(t.id)}
                onkeydown={(e) => itemKey(e, THEME_IDS, t.id, "vertical", pickTheme, "theme")}
            >
                <span
                    class="icon"
                    style:mask="var(--icon-{t.icon}) center/contain no-repeat"
                    style:-webkit-mask="var(--icon-{t.icon}) center/contain no-repeat"
                ></span>
                <span class="name">{$_(`native.start.appearance.${t.id}`)}</span>
                <span class="check" class:on></span>
            </div>
        {/each}
    </div>
    <span class="rule" aria-hidden="true"></span>
    <span class="label" aria-hidden="true">{$_("native.start.appearance.accent")}</span>
    <div
        class="swatches"
        role="group"
        aria-label={$_("native.start.appearance.accent")}
        data-group="accent"
    >
        {#each PAGE_ACCENTS as accent (accent)}
            {@const on = accent === $accentStore}
            <span
                class="swatch"
                class:on
                role="menuitemradio"
                aria-checked={on}
                aria-label={$_(`native.start.appearance.accents.${accent}`)}
                tabindex={on ? 0 : -1}
                style:--swatch="var(--swatch-{accent})"
                onclick={() => pickAccent(accent)}
                onkeydown={(e) =>
                    itemKey(e, PAGE_ACCENTS, accent, "horizontal", pickAccent, "accent")}
            ></span>
        {/each}
    </div>
</div>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .veil {
        position: fixed;
        inset: 0;
        z-index: 40;
    }

    // under the pill (the top row's 14px padding, its 36px, a little air), at the trailing edge
    .menu {
        position: fixed;
        top: calc(var(--safe-top) + 50px);
        inset-inline-end: var(--space-16);
        z-index: 41;
        width: 250px;
        max-width: calc(100% - 2 * var(--space-16));
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: var(--space-12);
        padding: 14px;
        border-radius: 18px;
        background: var(--surface-2);
        box-shadow:
            var(--shadow-menu),
            inset 0 0 0 1px var(--line-1);
        outline: none;
        transform-origin: top right;
        animation: oc-menu-pop 160ms var(--ease-out);

        &:dir(rtl) {
            transform-origin: top left;
        }

        @include reduced-motion {
            animation: none;
        }
    }

    .label {
        font: var(--weight-semibold) text-size(11.5px) / 1 var(--font-mono);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ink-4);
    }

    // the rows' text in line with the label
    .themes {
        display: flex;
        flex-direction: column;
        margin: -4px -6px 0;
    }

    .row {
        display: flex;
        align-items: center;
        gap: var(--space-12);
        height: 44px;
        padding: 0 var(--space-8);
        border-radius: 10px;
        cursor: pointer;
        outline: none;
        -webkit-tap-highlight-color: transparent;

        &:active {
            background: var(--overlay-1);
        }

        &:focus-visible {
            @include focus-ring;
        }
    }

    .icon {
        flex: none;
        width: 17px;
        height: 17px;
        background: var(--ink-2);
    }

    .name {
        flex: 1;
        font: var(--weight-semibold) text-size(15px) / 1 var(--font-sans);
        color: var(--ink);
    }

    // kept in the row when it's not the one picked, so nothing moves
    .check {
        @include icon(check, 16px, var(--accent));
        opacity: 0;

        &.on {
            opacity: 1;
        }
    }

    .rule {
        height: 1px;
        background: var(--line-1);
    }

    .swatches {
        display: flex;
        justify-content: space-between;
        padding: 0 2px 2px;
    }

    .swatch {
        width: 34px;
        height: 34px;
        border-radius: var(--radius-circle);
        background: var(--swatch);
        cursor: pointer;
        outline: none;
        -webkit-tap-highlight-color: transparent;

        &.on {
            box-shadow:
                0 0 0 3px var(--surface-2),
                0 0 0 5px var(--swatch);
        }

        &:focus-visible {
            @include focus-ring;
        }
    }
</style>
