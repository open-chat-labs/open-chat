<!-- The signed-out start (native design notes §3.1): Welcome, and the screens pushed from it (Pick a
     username, Welcome back, Link to your account), on their own small stack (startStack.svelte.ts),
     with the tabs' push motion: going deeper the new screen slides in from the inline end and the
     one under it moves out to the other side (.34s), Back reverses it, quicker (.24s: motion.ts's
     PUSH_MS and POP_MS), and Welcome first shows without motion. Android's system back goes
     through it too (shell/back.ts). -->
<script lang="ts">
    import type { Overlays } from "../../shell/overlays.svelte";
    import { popOut, pushIn } from "../../shell/motion";
    import LinkAccount from "./LinkAccount.svelte";
    import SignUp from "./SignUp.svelte";
    import type { StartStack } from "./startStack.svelte";
    import Welcome from "./Welcome.svelte";
    import WelcomeBack from "./WelcomeBack.svelte";

    type Props = {
        start: StartStack;
        /** Where the start's sheets register, so Android's back closes them first. */
        overlays: Overlays;
    };

    let { start, overlays }: Props = $props();

    const back = () => start.back();
</script>

<div class="start" class:popping={start.change === "pop"}>
    {#each start.steps as step, i (step)}
        {@const below = i < start.steps.length - 1}
        <section
            class="screen"
            class:below
            inert={below}
            in:pushIn={{ play: () => start.change !== "pop" && start.change !== "none" }}
            out:popOut={{ play: () => start.change === "pop" }}>
            {#if step === "welcome"}
                <Welcome {start} {overlays} />
            {:else if step === "welcome_back"}
                <WelcomeBack {start} {back} />
            {:else if step === "sign_up"}
                <SignUp {back} {overlays} />
            {:else}
                <LinkAccount {back} />
            {/if}
        </section>
    {/each}
</div>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .start {
        position: fixed;
        inset: 0;
        overflow: hidden;
        background: var(--surface-0);
        color: var(--ink);
        font-family: var(--font-sans);
    }

    .screen {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: var(--surface-0);
        box-shadow: var(--shadow-push);
        transition: transform 0.34s var(--ease-out);

        &:first-child {
            box-shadow: none;
        }

        // the one under coming back as Back slides the top one off, with it (motion.ts's POP_MS)
        .popping & {
            transition-duration: 0.24s;
        }

        &.below {
            transform: translateX(-28%);
            box-shadow: none;

            :global([dir="rtl"]) & {
                transform: translateX(28%);
            }
        }
    }

    @include reduced-motion {
        .screen {
            transition: none;
        }
    }
</style>
