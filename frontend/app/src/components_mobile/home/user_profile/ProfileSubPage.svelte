<script lang="ts">
    import { ColourVars, Container } from "component-lib";
    import type { ResourceKey } from "openchat-client";
    import type { Snippet } from "svelte";
    import ProfileSectionHeader from "./ProfileSectionHeader.svelte";

    interface Props {
        children: Snippet;
        title: ResourceKey;
    }

    let { children, title }: Props = $props();
</script>

<Container
    mainAxisAlignment={"spaceBetween"}
    background={ColourVars.background0}
    height={{ kind: "fill" }}
    direction={"vertical"}>
    <ProfileSectionHeader titleKey={title} />
    {@render children()}
</Container>
