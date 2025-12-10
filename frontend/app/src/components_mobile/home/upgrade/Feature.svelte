<script lang="ts">
    import type { ResourceKey } from "openchat-client";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";

    import { BodySmall, ColourVars, Container } from "component-lib";
    import type { Snippet } from "svelte";
    import MoreInfo from "../../InfoIcon.svelte";

    interface Props {
        comingSoon?: boolean;
        freeInfo?: ResourceKey | undefined;
        diamondInfo?: ResourceKey | undefined;
        title?: Snippet;
        free?: Snippet;
        diamond?: Snippet;
    }

    let {
        comingSoon = false,
        freeInfo = undefined,
        diamondInfo = undefined,
        title,
        free,
        diamond,
    }: Props = $props();
</script>

<Container supplementalClass={"diamond_feature"}>
    <Container
        padding={["sm", "zero", "sm", "zero"]}
        mainAxisAlignment={"center"}
        width={{ share: 1 }}>
        <BodySmall ellipsisTruncate colour={"textSecondary"}>
            {@render title?.()}
            {#if comingSoon}
                <span class="soon"
                    >(<Translatable resourceKey={i18nKey("upgrade.comingSoon")} />)</span>
            {/if}
        </BodySmall>
    </Container>
    <Container
        padding={["sm", "zero", "sm", "zero"]}
        mainAxisAlignment={"center"}
        width={{ share: 1 }}>
        <BodySmall width={"hug"} align={"center"} colour={"textSecondary"}>
            {@render free?.()}
        </BodySmall>
        {#if freeInfo !== undefined}
            <MoreInfo><Translatable resourceKey={freeInfo} /></MoreInfo>
        {/if}
    </Container>
    <Container
        padding={["sm", "zero", "sm", "zero"]}
        mainAxisAlignment={"center"}
        background={ColourVars.background2}
        width={{ share: 1 }}>
        <BodySmall width={"hug"} align={"center"}>
            {@render diamond?.()}
        </BodySmall>
        {#if diamondInfo !== undefined}
            <MoreInfo><Translatable resourceKey={diamondInfo} /></MoreInfo>
        {/if}
    </Container>
</Container>

<style lang="scss">
    :global(.diamond_feature) {
        border-bottom: 1px solid var(--text-tertiary) !important;
    }
</style>
