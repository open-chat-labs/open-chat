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
    import Translatable from "../../Translatable.svelte";
    import ProfileSubPage from "./ProfileSubPage.svelte";
    import Setting from "./Setting.svelte";

    const client = getContext<OpenChat>("client");

    function toggleModerationFlag(flag: ModerationFlag) {
        client.setModerationFlags($moderationFlagsEnabledStore ^ flag);
    }
</script>

<ProfileSubPage title={i18nKey("Chats & video calls")}>
    <Container padding={"xxl"} gap={"lg"} height={{ kind: "fill" }} direction={"vertical"}>
        <Container gap={"xl"} direction={"vertical"}>
            <H2 colour={"primary"}>
                <Translatable resourceKey={i18nKey("Chats")}></Translatable>
            </H2>
            <Setting
                info={"If you're having connection issues or just want to save bandwidth, enabling this option will try to optimise the app's data traffic."}
                title={"lowBandwidth"}>
                <Switch bind:checked={$lowBandwidth} />
            </Setting>
            <Setting
                info={"When you share links in your message, with this option turned on, a preview will ne automatically rendered. Turn it off if you don't want to see previews."}
                title={"renderPreviews"}>
                <Switch bind:checked={$renderPreviews} />
            </Setting>
            <Setting
                info={"With this option turned on, messages from users you have blocked will not be visible in group and community chats. Keep in mind that this might cause you to lose some conversation context."}
                title={"Hide messages from blocked users"}>
                <Switch bind:checked={$hideMessagesFromDirectBlocked} />
            </Setting>
        </Container>
        <Container gap={"xl"} direction={"vertical"}>
            <H2 colour={"primary"}>
                <Translatable resourceKey={i18nKey("Video calls")}></Translatable>
            </H2>
            <Setting
                info={"With this option on, camera will be active when a vide call starts. By default, this option is turned on."}
                title={"profile.videoCameraOn"}>
                <Switch bind:checked={$videoCameraOn} />
            </Setting>
            <Setting
                info={"When this option on, your microphone will be active when a video call starts, otherwise it will be muted. By default, this option is turned on."}
                title={"profile.videoMicOn"}>
                <Switch bind:checked={$videoMicOn} />
            </Setting>
            <Setting
                info={"This setting controls whether the video call view will focus on the active speaker or automatically or just show a grid of all of the speakers."}
                title={"profile.videoSpeakerView"}>
                <Switch bind:checked={$videoSpeakerView} />
            </Setting>
        </Container>
        <Container gap={"xl"} direction={"vertical"}>
            <H2 colour={"primary"}>
                <Translatable resourceKey={i18nKey("Restricted content")}></Translatable>
            </H2>
            <Setting
                info={"Choose if you would like to see communities and groups marked as offensive."}
                title={"communities.offensive"}>
                <Switch
                    onChange={() => toggleModerationFlag(ModerationFlags.Offensive)}
                    checked={$offensiveEnabledStore} />
            </Setting>
            <Setting
                info={"Choose if you would like to see communitie and groups marked as containing adult content."}
                title={"communities.adult"}>
                <Switch
                    onChange={() => toggleModerationFlag(ModerationFlags.Adult)}
                    checked={$adultEnabledStore} />
            </Setting>
            <Setting
                info={"Choose if you would like to see communities and groups that are currently under review."}
                title={"communities.underReview"}>
                <Switch
                    onChange={() => toggleModerationFlag(ModerationFlags.UnderReview)}
                    checked={$underReviewEnabledStore} />
            </Setting>
        </Container>
    </Container>
</ProfileSubPage>
