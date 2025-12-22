<script lang="ts">
    import { ColourVars, Container } from "component-lib";
    import type { ResourceKey } from "openchat-client";
    import type { Snippet } from "svelte";
    import SlidingPageHeader from "./SlidingPageHeader.svelte";

    interface Props {
        children: Snippet;
        title: ResourceKey;
        subtitle?: ResourceKey;
        onBack?: () => void;
        avatar?: Snippet;
        menu?: Snippet;
    }

    let { avatar, children, title, subtitle, onBack, menu }: Props = $props();
</script>

<Container background={ColourVars.background0} height={"fill"} direction={"vertical"}>
    <SlidingPageHeader {menu} {avatar} subtitleKey={subtitle} {onBack} titleKey={title} />
    {@render children()}
</Container>
