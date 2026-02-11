<script lang="ts">
    import type { ResourceKey } from "openchat-client";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";

    import { BodySmall, Caption, ColourVars, Container } from "component-lib";
    import type { Snippet } from "svelte";
    import MoreInfo from "../../InfoIcon.svelte";

    interface Props {
        comingSoon?: boolean;
        freeInfo?: ResourceKey | undefined;
        diamondInfo?: ResourceKey | undefined;
        title?: Snippet;
        free?: Snippet<[string]>;
        diamond?: Snippet<[string]>;
        Icon?: any;
        last?: boolean;
    }

    let {
        comingSoon = false,
        freeInfo = undefined,
        diamondInfo = undefined,
        title,
        free,
        diamond,
        Icon,
        last = false,
    }: Props = $props();
</script>

<Container height={{ size: "2.5rem" }} supplementalClass={"diamond_feature"}>
    <Container
        crossAxisAlignment={"center"}
        gap={"sm"}
        padding={["sm", "zero", "sm", "zero"]}
        mainAxisAlignment={"center"}
        width={{ share: 1 }}>
        {#if Icon}
            <Icon color={ColourVars.textSecondary} />
        {/if}
        <BodySmall ellipsisTruncate>
            {@render title?.()}
            {#if comingSoon}
                <span class="soon"
                    >(<Translatable resourceKey={i18nKey("upgrade.comingSoon")} />)</span>
            {/if}
        </BodySmall>
    </Container>
    <Container
        padding={["sm", "zero", "sm", "zero"]}
        crossAxisAlignment={"center"}
        mainAxisAlignment={"center"}
        height={"fill"}
        width={{ share: 1 }}>
        <Caption width={"hug"} align={"center"} colour={"textSecondary"}>
            {@render free?.(ColourVars.textSecondary)}
        </Caption>
        {#if freeInfo !== undefined}
            <MoreInfo color={ColourVars.textSecondary}
                ><Translatable resourceKey={freeInfo} /></MoreInfo>
        {/if}
    </Container>
    <Container
        borderRadius={last ? ["zero", "zero", "md", "md"] : undefined}
        padding={["sm", "zero", "sm", "zero"]}
        mainAxisAlignment={"center"}
        crossAxisAlignment={"center"}
        height={"fill"}
        background={ColourVars.background2}
        width={{ share: 1 }}>
        <Caption colour={"primary"} width={"hug"} align={"center"}>
            {@render diamond?.(ColourVars.primary)}
        </Caption>
        {#if diamondInfo !== undefined}
            <MoreInfo color={ColourVars.primary}
                ><Translatable resourceKey={diamondInfo} /></MoreInfo>
        {/if}
    </Container>
</Container>
