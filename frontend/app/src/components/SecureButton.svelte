<script lang="ts">
    import { onMount } from "svelte";
    import type { ButtonProps } from "./Button.svelte";
    import Button from "./Button.svelte";
    import { suspectedAutomationBot } from "../stores/automation";
    import { isTouchDevice } from "../utils/devices";

    let { children, onClick, ...rest }: ButtonProps & { onClick: (ev: MouseEvent) => void } =
        $props();

    // real users move, pause and then click. Bots either don't move at all or move and then click immediately
    const PAUSE_TRESHOLD = 10;

    let lastMoved = Date.now();

    onMount(() => {
        document.addEventListener("mousemove", mousemove);
        return () => {
            document.removeEventListener("mousemove", mousemove);
        };
    });

    function mousemove() {
        lastMoved = Date.now();
    }

    function probablyBot(ev: MouseEvent): boolean {
        const pause = Date.now() - lastMoved;
        const fakePause = pause < PAUSE_TRESHOLD && !isTouchDevice;
        console.debug("Suspected bot click detected: ", pause, isTouchDevice, ev.isTrusted, $suspectedAutomationBot)
        return (
            fakePause ||
            !ev.isTrusted ||
            $suspectedAutomationBot
        );
    }

    function internalOnclick(ev: MouseEvent) {
        if (probablyBot(ev)) {
            console.log("Looks like this button was clicked by a bot");
        } else {
            onClick(ev);
        }
    }
</script>

<Button on:click={internalOnclick} {...rest}>
    {@render children?.()}
</Button>
