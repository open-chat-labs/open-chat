<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import {
        ColourVars,
        CommonButton,
        Container,
        CopyCard,
        FloatingButton,
        StatusCard,
        Switch,
    } from "component-lib";
    import Reload from "svelte-material-icons/Reload.svelte";
    import ShareIcon from "svelte-material-icons/ShareOutline.svelte";
    import AreYouSure from "../../AreYouSure.svelte";
    import QRCode from "../../QRCode.svelte";
    import Setting from "../../Setting.svelte";
    import Translatable from "../../Translatable.svelte";

    import { canShare } from "@src/utils/share";
    import { onMount } from "svelte";
    import type { MemberManagement } from "./membersState.svelte";

    interface Props {
        membersState: MemberManagement;
    }
    let { membersState }: Props = $props();

    onMount(() => membersState.initialiseSharing());

    let link = $derived(membersState.getSharingLink());

    function onShare() {
        membersState.shareLink(link);
    }

    let showLink = $derived(
        membersState.isPublic ||
            (membersState.sharingLinkCode !== undefined && membersState.sharingLinkEnabled),
    );
</script>

{#if membersState.confirmingResetLink}
    <AreYouSure
        message={i18nKey("invite.confirmReset", undefined, membersState.level, true)}
        action={(answer) => membersState.confirmResetLinkResponse(answer)} />
{/if}

{#snippet action()}
    <Container mainAxisAlignment={"end"}>
        <CommonButton
            loading={membersState.confirmingResetLink}
            onClick={() => membersState.confirmResetLink()}
            mode={"active"}
            size={"small_text"}>
            {#snippet icon(color, size)}
                <Reload {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("invite.resetLink")}></Translatable>
        </CommonButton>
    </Container>
{/snippet}

<Container gap={"xl"} direction={"vertical"} height={{ kind: "fill" }}>
    {#if !membersState.isPublic}
        <Container padding={["zero", "md"]} gap={"xl"} direction={"vertical"}>
            <Setting
                toggle={() => membersState.toggleInviteLink()}
                info={"When enabled, a link and a QR code will be available to share with any user you would like to invite to become a member of this group."}>
                <Switch
                    loading={membersState.togglingSharingLink}
                    onChange={() => membersState.toggleInviteLink()}
                    width={{ kind: "fill" }}
                    reverse
                    checked={membersState.sharingLinkEnabled}>
                    <Translatable resourceKey={i18nKey("Enable sharing via link")}></Translatable>
                </Switch>
            </Setting>
        </Container>
    {/if}
    {#if showLink}
        <StatusCard
            mode={"warning"}
            title={"Anyone with this link can join the thing"}
            body={"Anyone with this link can preview and join the community. This means that access gates are ignored. As a Diamond member you can also earn referral rewards."}>
        </StatusCard>
        <Container gap={"xs"} direction={"vertical"}>
            <CopyCard
                action={membersState.sharingLinkCode !== undefined ? action : undefined}
                title={"Share using this link"}
                body={link}>
            </CopyCard>
            <Container padding={"md"} background={ColourVars.background1}>
                <QRCode text={link} fullWidthOnMobile />
            </Container>
        </Container>
    {/if}
</Container>

{#if showLink && canShare()}
    <FloatingButton onClick={onShare} pos={{ bottom: "lg", right: "lg" }}>
        {#snippet icon(color)}
            <ShareIcon {color} />
        {/snippet}
    </FloatingButton>
{/if}
