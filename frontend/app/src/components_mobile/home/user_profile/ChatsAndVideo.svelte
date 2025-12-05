<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import {
        lowBandwidth,
        renderPreviews,
        videoCameraOn,
        videoMicOn,
        videoSpeakerView,
    } from "@src/stores/settings";
    import { Container, H2, Switch } from "component-lib";
    import {
        adultEnabledStore,
        hideMessagesFromDirectBlocked,
        ModerationFlags,
        moderationFlagsEnabledStore,
        offensiveEnabledStore,
        OpenChat,
        underReviewEnabledStore,
        type ModerationFlag,
    } from "openchat-client";
    import { getContext } from "svelte";
    import Setting from "../../Setting.svelte";
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";

    const client = getContext<OpenChat>("client");

    function toggleModerationFlag(flag: ModerationFlag) {
        client.setModerationFlags($moderationFlagsEnabledStore ^ flag);
    }
</script>

<SlidingPageContent title={i18nKey("Chats & video calls")} subtitle={i18nKey("General options")}>
    <Container padding={"xxl"} gap={"lg"} height={"fill"} direction={"vertical"}>
        <Container gap={"xl"} direction={"vertical"}>
            <H2 colour={"primary"}>
                <Translatable resourceKey={i18nKey("Chats")}></Translatable>
            </H2>
            <Setting
                toggle={() => lowBandwidth.toggle()}
                info={"If you're having connection issues or just want to save bandwidth, enabling this option will try to optimise the app's data traffic."}>
                <Switch width={"fill"} reverse bind:checked={$lowBandwidth}>
                    <Translatable resourceKey={i18nKey("lowBandwidth")}></Translatable>
                </Switch>
            </Setting>
            <Setting
                toggle={() => renderPreviews.toggle()}
                info={"When you share links in your message, with this option turned on, a preview will ne automatically rendered. Turn it off if you don't want to see previews."}>
                <Switch width={"fill"} reverse bind:checked={$renderPreviews}>
                    <Translatable resourceKey={i18nKey("renderPreviews")}></Translatable>
                </Switch>
            </Setting>
            <Setting
                toggle={() => hideMessagesFromDirectBlocked.toggle()}
                info={"With this option turned on, messages from users you have blocked will not be visible in group and community chats. Keep in mind that this might cause you to lose some conversation context."}>
                <Switch width={"fill"} reverse bind:checked={$hideMessagesFromDirectBlocked}>
                    <Translatable resourceKey={i18nKey("Hide messages from blocked users")} />
                </Switch>
            </Setting>
        </Container>
        <Container gap={"xl"} direction={"vertical"}>
            <H2 colour={"primary"}>
                <Translatable resourceKey={i18nKey("Video calls")}></Translatable>
            </H2>
            <Setting
                toggle={() => videoCameraOn.toggle()}
                info={"With this option on, camera will be active when a vide call starts. By default, this option is turned on."}>
                <Switch width={"fill"} reverse bind:checked={$videoCameraOn}>
                    <Translatable resourceKey={i18nKey("profile.videoCameraOn")}></Translatable>
                </Switch>
            </Setting>
            <Setting
                toggle={() => videoMicOn.toggle()}
                info={"When this option on, your microphone will be active when a video call starts, otherwise it will be muted. By default, this option is turned on."}>
                <Switch width={"fill"} reverse bind:checked={$videoMicOn}>
                    <Translatable resourceKey={i18nKey("profile.videoMicOn")}></Translatable>
                </Switch>
            </Setting>
            <Setting
                toggle={() => videoSpeakerView.toggle()}
                info={"This setting controls whether the video call view will focus on the active speaker or automatically or just show a grid of all of the speakers."}>
                <Switch width={"fill"} reverse bind:checked={$videoSpeakerView}>
                    <Translatable resourceKey={i18nKey("profile.videoSpeakerView")}></Translatable>
                </Switch>
            </Setting>
        </Container>
        <Container gap={"xl"} direction={"vertical"}>
            <H2 colour={"primary"}>
                <Translatable resourceKey={i18nKey("Restricted content")}></Translatable>
            </H2>
            <Setting
                toggle={() => toggleModerationFlag(ModerationFlags.Offensive)}
                info={"Choose if you would like to see communities and groups marked as offensive."}>
                <Switch
                    width={"fill"}
                    reverse
                    onChange={() => toggleModerationFlag(ModerationFlags.Offensive)}
                    checked={$offensiveEnabledStore}>
                    <Translatable resourceKey={i18nKey("communities.offensive")}></Translatable>
                </Switch>
            </Setting>
            <Setting
                toggle={() => toggleModerationFlag(ModerationFlags.Adult)}
                info={"Choose if you would like to see communitie and groups marked as containing adult content."}>
                <Switch
                    width={"fill"}
                    reverse
                    onChange={() => toggleModerationFlag(ModerationFlags.Adult)}
                    checked={$adultEnabledStore}>
                    <Translatable resourceKey={i18nKey("communities.adult")}></Translatable>
                </Switch>
            </Setting>
            <Setting
                toggle={() => toggleModerationFlag(ModerationFlags.UnderReview)}
                info={"Choose if you would like to see communities and groups that are currently under review."}>
                <Switch
                    width={"fill"}
                    reverse
                    onChange={() => toggleModerationFlag(ModerationFlags.UnderReview)}
                    checked={$underReviewEnabledStore}>
                    <Translatable resourceKey={i18nKey("communities.underReview")}></Translatable>
                </Switch>
            </Setting>
        </Container>
    </Container>
</SlidingPageContent>
