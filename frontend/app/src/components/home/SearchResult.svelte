<script lang="ts">
    import { AvatarSize } from "openchat-client";
    import Avatar from "../Avatar.svelte";
    import type { Snippet } from "svelte";

    interface Props {
        showSpinner?: boolean | undefined;
        avatarUrl: string;
        index: number;
        bot?: boolean;
        children?: Snippet;
        onclick: () => void;
    }

    let { showSpinner = false, avatarUrl, index, children, bot = false, onclick }: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="search-result" class:first={index === 0} {onclick}>
    <span class="avatar">
        <Avatar {bot} url={avatarUrl} size={AvatarSize.Default} />
    </span>
    <div class="details">
        {@render children?.()}
    </div>

    {#if showSpinner}
        <div class="spinner"></div>
    {/if}
</div>

<style lang="scss">
    .search-result {
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: var(--chatSummary-bg);
        padding: $sp4 $sp4;
        margin-bottom: 0;
        transition: background-color ease-in-out 100ms;
        cursor: pointer;
        border-bottom: var(--chatSummary-bd);

        &.first {
            border-top: var(--chatSummary-bd);
        }

        @media (hover: hover) {
            &:hover {
                background-color: var(--chatSummary-hv);
            }
        }

        @include mobile() {
            padding: $sp3;
        }
    }
    .avatar {
        flex: 0 0 50px;
    }
    .details {
        flex: 1;
        padding: 0 5px;
        overflow: hidden;
    }
    .spinner {
        @include loading-spinner(1em, 0.5em, var(--spinner));
        padding: 0 $sp4;
    }
</style>
