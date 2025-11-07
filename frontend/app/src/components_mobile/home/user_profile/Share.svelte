<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { toastStore } from "@src/stores/toast";
    import { shareLink } from "@src/utils/share";
    import { BodySmall, Caption, ColourVars, CommonButton, Container, H2 } from "component-lib";
    import { allUsersStore, currentUserIdStore, OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import ContentCopy from "svelte-material-icons/ContentCopy.svelte";
    import ShareIcon from "svelte-material-icons/ShareVariant.svelte";
    import QRCode from "../../QRCode.svelte";
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";

    const client = getContext<OpenChat>("client");

    let user = $derived($allUsersStore.get($currentUserIdStore) ?? client.nullUser("unknown"));
    let link = $derived(`${window.location.origin}/?ref=${$currentUserIdStore}`);

    function onCopy() {
        navigator.clipboard.writeText(user.userId).then(() => {
            toastStore.showSuccessToast(i18nKey("linkCopiedToClipboard"));
        });
    }
</script>

<SlidingPageContent title={i18nKey("Share")}>
    <Container
        padding={"xxl"}
        gap={"lg"}
        height={{ kind: "fill" }}
        crossAxisAlignment={"center"}
        direction={"vertical"}>
        <Container gap={"xl"} direction={"vertical"}>
            <Container gap={"lg"} direction={"vertical"}>
                <H2 width={{ kind: "fixed", size: "70%" }} fontWeight={"bold"} colour={"primary"}>
                    <Translatable resourceKey={i18nKey("Share with family & friends")}
                    ></Translatable>
                </H2>

                <BodySmall>
                    <Translatable
                        resourceKey={i18nKey(
                            "Share your OpenChat link to earn CHIT rewards. You get CHIT when referred users verify unique personhood or become Diamond members. Referring a Diamond member earns 5,000 CHIT, proving unique personhood earns 10,000 CHIT, and a lifetime Diamond membership yields 15,000 CHIT.  ",
                        )}>
                    </Translatable>
                </BodySmall>

                <BodySmall>
                    <Translatable
                        resourceKey={i18nKey(
                            "Your friends can scan the QR code below, or you may copy the link and send it yourself, or share via available mediums.",
                        )}>
                    </Translatable>
                </BodySmall>
            </Container>

            <Container
                padding={["lg", "lg", "xl", "lg"]}
                direction={"vertical"}
                mainAxisAlignment={"center"}
                crossAxisAlignment={"center"}
                background={ColourVars.background1}>
                <Container
                    padding={["lg", "lg", "zero", "lg"]}
                    mainAxisAlignment={"center"}
                    crossAxisAlignment={"center"}>
                    <QRCode text={link} fullWidthOnMobile />
                </Container>
                <Caption align={"center"} colour={"primary"}>
                    {link}
                </Caption>
            </Container>

            <Container mainAxisAlignment={"end"} gap={"sm"} crossAxisAlignment={"end"}>
                <CommonButton onClick={onCopy} size={"small_text"}>
                    {#snippet icon(color)}
                        <ContentCopy {color}></ContentCopy>
                    {/snippet}
                    <Translatable resourceKey={i18nKey("Copy link")}></Translatable>
                </CommonButton>
                <CommonButton onClick={() => shareLink(link)} size={"medium"} mode={"active"}>
                    {#snippet icon(color, size)}
                        <ShareIcon {color} {size}></ShareIcon>
                    {/snippet}
                    <Translatable resourceKey={i18nKey("share")}></Translatable>
                </CommonButton>
            </Container>
        </Container>
    </Container>
</SlidingPageContent>
