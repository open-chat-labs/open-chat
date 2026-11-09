<!-- The emoji sheet behind the long-press menu's reactions + (MessageActions): the composer's emoji
     panel's emoji (EmojiGrid: Recent, every emoji by category, the category bar) under a search
     field in the panel's style (EmojiSearchField). It's a bottom sheet's, not the keyboard slot's,
     so the search is a plain one: the field takes the keyboard, the sheet sits on it (the host's
     BottomSheet `keyboard`), and the results show under the field, in the grid. No GIFs (a reaction is an emoji) and no backspace. A reaction the user has on the
     message is marked, and picking it takes it off; one added goes to the front of Recent, the
     composer's too. -->
<script lang="ts">
    import type { PickerEmoji } from "@src/utils/emojiCategories";
    import { onDestroy, onMount, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import EmojiGrid from "./EmojiGrid.svelte";
    import { EmojiSections } from "./emojiSections.svelte";
    import EmojiSearchField from "./EmojiSearchField.svelte";

    type Props = {
        /** Whose Recent it is. */
        userId: string;
        /** The reactions the user has on the message. */
        selected: readonly string[];
        onPick: (emoji: string) => void;
    };

    let { userId, selected, onPick }: Props = $props();

    const storage = (() => {
        try {
            return window.localStorage;
        } catch {
            return undefined;
        }
    })();
    // made as the sheet opens, so it has the Recent the composer left
    const emoji = new EmojiSections(untrack(() => userId), storage);
    onMount(() => void emoji.load());
    onDestroy(() => emoji.dispose());

    let query = $state("");

    function typed(next: string) {
        query = next;
        emoji.search(next);
    }

    function clear() {
        query = "";
        emoji.clearSearch();
    }

    function pick(picked: PickerEmoji) {
        // taking a reaction off isn't a use of it
        if (!selected.includes(picked.char)) emoji.picked(picked.char);
        onPick(picked.char);
    }
</script>

<div class="top">
    <EmojiSearchField
        value={query}
        placeholder={$_("ui.emojiPicker.search")}
        aria-label={$_("ui.emojiPicker.search")}
        onInput={typed}
        onClear={clear}
    />
</div>
<EmojiGrid {emoji} bind:query {selected} overSafeArea={false} onPick={pick} />

<style lang="scss">
    // the sheet's handle above it (22px); 07's top row under that
    .top {
        flex: none;
        display: flex;
        padding: var(--space-6) var(--space-12) var(--space-8);
    }
</style>
