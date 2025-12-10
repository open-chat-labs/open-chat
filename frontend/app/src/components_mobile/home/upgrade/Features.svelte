<script lang="ts">
    import { Body, Button, ColourVars, Container } from "component-lib";
    import Check from "svelte-material-icons/Check.svelte";
    import Minus from "svelte-material-icons/Minus.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import Feature from "./Feature.svelte";

    interface Props {
        isDiamond: boolean;
        canExtend: boolean;
        onUpgrade?: () => void;
        onCancel?: () => void;
    }

    let { isDiamond, canExtend, onUpgrade }: Props = $props();
</script>

<Container padding={["zero", "sm"]}>
    <Container padding={"md"} mainAxisAlignment={"center"} width={{ share: 1 }}>
        <Body>
            <Translatable resourceKey={i18nKey("upgrade.feature")} />
        </Body>
    </Container>
    <Container padding={"md"} mainAxisAlignment={"center"} width={{ share: 1 }}>
        <Body width={"hug"}>
            <Translatable resourceKey={i18nKey("upgrade.free")} />
        </Body>
    </Container>
    <Container
        padding={"md"}
        background={ColourVars.secondary}
        mainAxisAlignment={"center"}
        width={{ share: 1 }}>
        <Body width={"hug"}>
            <Translatable resourceKey={i18nKey("upgrade.diamond")} />
        </Body>
    </Container>
</Container>

<Container direction={"vertical"} padding={["zero", "sm"]}>
    <Feature>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.textMessages")} />
        {/snippet}
        {#snippet free()}
            <Check size={"1em"} color={"var(--success)"} />
        {/snippet}
        {#snippet diamond()}
            <Check size={"1em"} color={"var(--success)"} />
        {/snippet}
    </Feature>

    <Feature>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.giphys")} />
        {/snippet}
        {#snippet free()}
            <Check size={"1em"} color={"var(--success)"} />
        {/snippet}
        {#snippet diamond()}
            <Check size={"1em"} color={"var(--success)"} />
        {/snippet}
    </Feature>

    <Feature>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.reactions")} />
        {/snippet}
        {#snippet free()}
            <Check size={"1em"} color={"var(--success)"} />
        {/snippet}
        {#snippet diamond()}
            <Check size={"1em"} color={"var(--success)"} />
        {/snippet}
    </Feature>

    <Feature>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.polls")} />
        {/snippet}
        {#snippet free()}
            <Check size={"1em"} color={"var(--success)"} />
        {/snippet}
        {#snippet diamond()}
            <Check size={"1em"} color={"var(--success)"} />
        {/snippet}
    </Feature>

    <Feature>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.reminders")} />
        {/snippet}
        {#snippet free()}
            <Check size={"1em"} color={"var(--success)"} />
        {/snippet}
        {#snippet diamond()}
            <Check size={"1em"} color={"var(--success)"} />
        {/snippet}
    </Feature>

    <Feature>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.crypto")} />
        {/snippet}
        {#snippet free()}
            <Check size={"1em"} color={"var(--success)"} />
        {/snippet}
        {#snippet diamond()}
            <Check size={"1em"} color={"var(--success)"} />
        {/snippet}
    </Feature>

    <Feature>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.videoCalls")} />
        {/snippet}
        {#snippet free()}
            <Minus size={"1em"} color={"var(--menu-warn)"} />
        {/snippet}
        {#snippet diamond()}
            <Check size={"1em"} color={"var(--success)"} />
        {/snippet}
    </Feature>

    <Feature>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.notifications")} />
        {/snippet}
        {#snippet free()}
            <Translatable resourceKey={i18nKey("upgrade.freeNotifications")} />
        {/snippet}
        {#snippet diamond()}
            <Translatable resourceKey={i18nKey("upgrade.diamondNotifications")} />
        {/snippet}
    </Feature>

    <Feature
        diamondInfo={i18nKey("upgrade.mediaLimits", { image: "5mb", video: "50mb" })}
        freeInfo={i18nKey("upgrade.mediaLimits", { image: "1mb", video: "5mb" })}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.mediaMessages")} />
        {/snippet}
        {#snippet free()}
            <Translatable resourceKey={i18nKey("upgrade.freeMediaMessages")} />
        {/snippet}
        {#snippet diamond()}
            <Translatable resourceKey={i18nKey("upgrade.diamondMediaMessages")} />
        {/snippet}
    </Feature>

    <Feature
        diamondInfo={i18nKey("upgrade.diamondStorageLimit")}
        freeInfo={i18nKey("upgrade.freeStorageLimit")}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.storage")} />
        {/snippet}
        {#snippet free()}
            <Translatable resourceKey={i18nKey("upgrade.freeStorage")} />
        {/snippet}
        {#snippet diamond()}
            <Translatable resourceKey={i18nKey("upgrade.diamondStorage")} />
        {/snippet}
    </Feature>

    <Feature>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.createCommunities")} />
        {/snippet}
        {#snippet free()}
            <Minus size={"1em"} color={"var(--menu-warn)"} />
        {/snippet}
        {#snippet diamond()}
            <Check size={"1em"} color={"var(--success)"} />
        {/snippet}
    </Feature>

    <Feature>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.directChats")} />
        {/snippet}
        {#snippet free()}
            <Check size={"1em"} color={"var(--success)"} />
        {/snippet}
        {#snippet diamond()}
            <Check size={"1em"} color={"var(--success)"} />
        {/snippet}
    </Feature>

    <Feature>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.privateGroups")} />
        {/snippet}
        {#snippet free()}
            <Translatable resourceKey={i18nKey("upgrade.freePrivateGroups")} />
        {/snippet}
        {#snippet diamond()}
            <Translatable resourceKey={i18nKey("upgrade.diamondPrivateGroups")} />
        {/snippet}
    </Feature>

    <Feature>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.publicGroups")} />
        {/snippet}
        {#snippet free()}
            <Minus size={"1em"} color={"var(--menu-warn)"} />
        {/snippet}
        {#snippet diamond()}
            <Translatable resourceKey={i18nKey("upgrade.diamondPublicGroups")} />
        {/snippet}
    </Feature>

    <Feature>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.gatedGroups")} />
        {/snippet}
        {#snippet free()}
            <Minus size={"1em"} color={"var(--menu-warn)"} />
        {/snippet}
        {#snippet diamond()}
            <Check size={"1em"} color={"var(--success)"} />
        {/snippet}
    </Feature>

    <Feature>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.translations")} />
        {/snippet}
        {#snippet free()}
            <Minus size={"1em"} color={"var(--menu-warn)"} />
        {/snippet}
        {#snippet diamond()}
            <Check size={"1em"} color={"var(--success)"} />
        {/snippet}
    </Feature>

    <Feature>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.p2pSwap")} />
        {/snippet}
        {#snippet free()}
            <Minus size={"1em"} color={"var(--menu-warn)"} />
        {/snippet}
        {#snippet diamond()}
            <Check size={"1em"} color={"var(--success)"} />
        {/snippet}
    </Feature>

    <Feature>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.diamondBadge")} />
        {/snippet}
        {#snippet free()}
            <Minus size={"1em"} color={"var(--menu-warn)"} />
        {/snippet}
        {#snippet diamond()}
            <Check size={"1em"} color={"var(--success)"} />
        {/snippet}
    </Feature>

    <Feature diamondInfo={i18nKey("upgrade.airdropsInfo")}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.airdrops")} />
        {/snippet}
        {#snippet free()}
            <Minus size={"1em"} color={"var(--menu-warn)"} />
        {/snippet}
        {#snippet diamond()}
            <Translatable resourceKey={i18nKey("upgrade.eligible")} />
        {/snippet}
    </Feature>
</Container>

<Container padding={"lg"}>
    {#if !isDiamond}
        <Button onClick={() => onUpgrade?.()}
            ><Translatable resourceKey={i18nKey("upgrade.button")} /></Button>
    {:else if canExtend}
        <Button onClick={() => onUpgrade?.()}
            ><Translatable resourceKey={i18nKey("upgrade.extendShort")} /></Button>
    {/if}
</Container>
