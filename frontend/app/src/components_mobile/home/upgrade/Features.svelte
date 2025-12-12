<script lang="ts">
    import { Body, ColourVars, Container } from "component-lib";
    import Gifs from "svelte-material-icons/AccountBoxOutline.svelte";
    import CreateCommunities from "svelte-material-icons/AccountGroupOutline.svelte";
    import Groups from "svelte-material-icons/AccountMultiple.svelte";
    import Notifications from "svelte-material-icons/BellOutline.svelte";
    import Bitcoin from "svelte-material-icons/Bitcoin.svelte";
    import Polls from "svelte-material-icons/ChartBoxOutline.svelte";
    import DirectChats from "svelte-material-icons/ChatOutline.svelte";
    import Check from "svelte-material-icons/CheckBold.svelte";
    import Reminders from "svelte-material-icons/ClockPlusOutline.svelte";
    import Storage from "svelte-material-icons/ContentSaveOutline.svelte";
    import Diamond from "svelte-material-icons/DiamondOutline.svelte";
    import MediaMessage from "svelte-material-icons/ImageMultipleOutline.svelte";
    import TextMessage from "svelte-material-icons/MessageTextOutline.svelte";
    import Airdrops from "svelte-material-icons/PartyPopper.svelte";
    import Gated from "svelte-material-icons/ShieldLockOutline.svelte";
    import Swap from "svelte-material-icons/SwapVerticalVariant.svelte";
    import Reactions from "svelte-material-icons/ThumbUpOutline.svelte";
    import Translate from "svelte-material-icons/Translate.svelte";
    import Video from "svelte-material-icons/VideoOutline.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import Feature from "./Feature.svelte";

    let iconSize = "1rem";
</script>

<Container padding={["xl", "md", "zero", "md"]}>
    <Container height={"fill"} padding={"md"} mainAxisAlignment={"center"} width={{ share: 1 }}>
        <span></span>
    </Container>
    <Container height={"fill"} padding={"md"} mainAxisAlignment={"center"} width={{ share: 1 }}>
        <Body fontWeight={"bold"} width={"hug"}>
            <Translatable resourceKey={i18nKey("upgrade.free")} />
        </Body>
    </Container>
    <Container
        height={"fill"}
        padding={"md"}
        background={ColourVars.background2}
        borderRadius={["md", "md", "zero", "zero"]}
        mainAxisAlignment={"center"}
        width={{ share: 1 }}>
        <Diamond size={"1.5rem"} color={ColourVars.primary} />
    </Container>
</Container>

<Container direction={"vertical"} padding={["zero", "md"]}>
    <Feature Icon={TextMessage}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.textMessages")} />
        {/snippet}
        {#snippet free(color)}
            <Check size={iconSize} {color} />
        {/snippet}
        {#snippet diamond(color)}
            <Check size={iconSize} {color} />
        {/snippet}
    </Feature>

    <Feature Icon={Gifs}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.giphys")} />
        {/snippet}
        {#snippet free(color)}
            <Check size={iconSize} {color} />
        {/snippet}
        {#snippet diamond(color)}
            <Check size={iconSize} {color} />
        {/snippet}
    </Feature>

    <Feature Icon={Reactions}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.reactions")} />
        {/snippet}
        {#snippet free(color)}
            <Check size={iconSize} {color} />
        {/snippet}
        {#snippet diamond(color)}
            <Check size={iconSize} {color} />
        {/snippet}
    </Feature>

    <Feature Icon={Polls}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.polls")} />
        {/snippet}
        {#snippet free(color)}
            <Check size={iconSize} {color} />
        {/snippet}
        {#snippet diamond(color)}
            <Check size={iconSize} {color} />
        {/snippet}
    </Feature>

    <Feature Icon={Reminders}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.reminders")} />
        {/snippet}
        {#snippet free(color)}
            <Check size={iconSize} {color} />
        {/snippet}
        {#snippet diamond(color)}
            <Check size={iconSize} {color} />
        {/snippet}
    </Feature>

    <Feature Icon={Bitcoin}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.crypto")} />
        {/snippet}
        {#snippet free(color)}
            <Check size={iconSize} {color} />
        {/snippet}
        {#snippet diamond(color)}
            <Check size={iconSize} {color} />
        {/snippet}
    </Feature>

    <Feature Icon={Video}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.videoCalls")} />
        {/snippet}
        {#snippet diamond(color)}
            <Check size={iconSize} {color} />
        {/snippet}
    </Feature>

    <Feature Icon={Notifications}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.notifications")} />
        {/snippet}
        {#snippet free()}
            <Translatable resourceKey={i18nKey("Mobile & Desktop")} />
        {/snippet}
        {#snippet diamond()}
            <Translatable resourceKey={i18nKey("Mobile & Desktop")} />
        {/snippet}
    </Feature>

    <Feature
        Icon={MediaMessage}
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
        Icon={Storage}
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

    <Feature Icon={CreateCommunities}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.createCommunities")} />
        {/snippet}
        {#snippet diamond(color)}
            <Check size={iconSize} {color} />
        {/snippet}
    </Feature>

    <Feature Icon={DirectChats}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.directChats")} />
        {/snippet}
        {#snippet free(color)}
            <Check size={iconSize} {color} />
        {/snippet}
        {#snippet diamond(color)}
            <Check size={iconSize} {color} />
        {/snippet}
    </Feature>

    <Feature Icon={Groups}>
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

    <Feature Icon={Groups}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.publicGroups")} />
        {/snippet}
        {#snippet diamond()}
            <Translatable resourceKey={i18nKey("upgrade.diamondPublicGroups")} />
        {/snippet}
    </Feature>

    <Feature Icon={Gated}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.gatedGroups")} />
        {/snippet}
        {#snippet diamond(color)}
            <Check size={iconSize} {color} />
        {/snippet}
    </Feature>

    <Feature Icon={Translate}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.translations")} />
        {/snippet}
        {#snippet diamond(color)}
            <Check size={iconSize} {color} />
        {/snippet}
    </Feature>

    <Feature Icon={Swap}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.p2pSwap")} />
        {/snippet}
        {#snippet diamond(color)}
            <Check size={iconSize} {color} />
        {/snippet}
    </Feature>

    <Feature Icon={Diamond}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.diamondBadge")} />
        {/snippet}
        {#snippet diamond(color)}
            <Check size={iconSize} {color} />
        {/snippet}
    </Feature>

    <Feature Icon={Airdrops} last diamondInfo={i18nKey("upgrade.airdropsInfo")}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.airdrops")} />
        {/snippet}
        {#snippet diamond()}
            <Translatable resourceKey={i18nKey("upgrade.eligible")} />
        {/snippet}
    </Feature>
</Container>
