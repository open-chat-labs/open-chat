<!-- The call in picture in picture (N14, the Android app): full bleed, no controls, the first of
     the others' video, else their picture, else the user's own camera. The tile is the system's;
     tapping it opens the app back on the call. -->
<script lang="ts">
    import { stream as playStream } from "@openchat/ui/src/lib/behaviours/stream";
    import type { CallPersonView, CallSelfView } from "@src/logic/video/callPeople";
    import { mirrorsSelf } from "./call.adapter";

    let {
        people,
        self,
        title,
    }: { people: CallPersonView[]; self: CallSelfView | undefined; title: string } = $props();

    const lead = $derived(people[0]);
    const stream = $derived(lead?.stream ?? (lead === undefined ? (self?.stream ?? null) : null));
    const mirror = $derived(lead === undefined && mirrorsSelf(self?.stream ?? null));
    const face = $derived(lead ?? self);
</script>

<div class="pip" data-mode="dark" aria-label={title}>
    {#if stream}
        <video class="feed" class:mirror use:playStream={stream} autoplay playsinline muted></video>
    {:else if face !== undefined}
        <span class="avatar" style:background={face.grad}>
            {#if face.avatarUrl}
                <img class="face" src={face.avatarUrl} alt="" />
            {:else}
                {face.initial}
            {/if}
        </span>
    {/if}
</div>

<style lang="scss">
    // over everything: in picture in picture the window is the tile
    .pip {
        position: fixed;
        inset: 0;
        z-index: calc(var(--z-modal) + 10);
        display: grid;
        place-items: center;
        background: #050507;
    }

    .feed {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .mirror {
        transform: scaleX(-1);
    }

    .avatar {
        width: 40%;
        aspect-ratio: 1;
        border-radius: 50%;
        overflow: hidden;
        display: grid;
        place-items: center;
        font: 700 28px/1 var(--font-sans);
        color: #0e0e12;
    }

    .face {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
</style>
