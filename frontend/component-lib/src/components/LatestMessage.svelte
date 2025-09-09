<script module lang="ts">
    import Image from "svelte-material-icons/ImageOutline.svelte";
    import Movie from "svelte-material-icons/MovieOutline.svelte";
    import Video from "svelte-material-icons/VideoOutline.svelte";
    import Waveform from "svelte-material-icons/Waveform.svelte";
    export type VideoCallMessage = {
        kind: "video_call";
        inProgress: boolean;
        text: string;
    };
    export type StandardMessage = {
        kind: "text" | "video" | "audio" | "image";
        text: string;
    };
    export type LatestMessage = VideoCallMessage | StandardMessage;
</script>

<script lang="ts">
    import { ColourVars, type TypographyColour } from "component-lib";
    import Container from "./Container.svelte";
    import BodySmall from "./typography/BodySmall.svelte";

    interface Props {
        latestMessage: LatestMessage;
    }

    let { latestMessage }: Props = $props();
    let iconColour = $derived(
        latestMessage.kind === "video_call" && latestMessage.inProgress
            ? ColourVars.primary
            : ColourVars.textSecondary,
    );
    let textColour = $derived<TypographyColour>(
        latestMessage.kind === "video_call" && latestMessage.inProgress ? "accent" : "secondary",
    );
</script>

<Container gap={"xs"} crossAxisAlignment={"center"}>
    {#if latestMessage.kind === "video_call"}
        <Video color={iconColour} />
    {:else if latestMessage.kind === "video"}
        <Movie color={ColourVars.textSecondary} />
    {:else if latestMessage.kind === "image"}
        <Image color={ColourVars.textSecondary} />
    {:else if latestMessage.kind === "audio"}
        <Waveform color={ColourVars.textSecondary} />
    {/if}
    <BodySmall colour={textColour} ellipsisTruncate fontWeight={"normal"}>
        {latestMessage.text}
    </BodySmall>
</Container>
