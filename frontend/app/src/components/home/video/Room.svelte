<script lang="ts">
    import daily from "@daily-co/daily-js";
    import type { DailyCall } from "@daily-co/daily-js";
    import type { OpenChat } from "openchat-client";
    import { getContext, onMount } from "svelte";

    const client = getContext<OpenChat>("client");

    $: user = client.user;

    let container: HTMLDivElement;
    let callframe: DailyCall | undefined = undefined;

    onMount(async () => {
        callframe = daily.createFrame(container, {
            showLeaveButton: true,
            iframeStyle: {
                width: "100%",
                height: "100%",
            },
            url: "https://openchat.daily.co/openchat_developers",
            userName: $user.username,
        });

        await callframe.join();
    });
</script>

<div bind:this={container} class="container"></div>

<style lang="scss">
    .container {
        display: flex;
        flex-direction: column;
        height: 100%;
    }
</style>
