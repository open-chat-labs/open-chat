<script lang="ts">
    import { ColourVars, Container, type SwipeDirection } from "component-lib";
    import type { ResourceKey } from "openchat-client";
    import type { Snippet } from "svelte";
    import SlidingPageHeader from "./SlidingPageHeader.svelte";

    interface Props {
        children: Snippet;
        title: ResourceKey;
        subtitle?: ResourceKey;
        onBack?: () => void;
        avatar?: Snippet;
    }

    let { avatar, children, title, subtitle, onBack }: Props = $props();
    let onSwipe = $derived(
        onBack
            ? (dir: SwipeDirection) => {
                  if (dir === "right") {
                      onBack();
                  }
              }
            : undefined,
    );
</script>

<Container
    {onSwipe}
    background={ColourVars.background0}
    height={{ kind: "fill" }}
    direction={"vertical"}>
    <SlidingPageHeader {avatar} subtitleKey={subtitle} {onBack} titleKey={title} />
    {@render children()}
</Container>
