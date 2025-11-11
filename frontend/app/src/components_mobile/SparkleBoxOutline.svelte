<script lang="ts">
    import { Container } from "component-lib";
    import type { Snippet } from "svelte";

    interface Props {
        children: Snippet;
    }

    let { children }: Props = $props();
</script>

<div class="gradient_border">
    <Container
        gap={"lg"}
        supplementalClass={"starfield"}
        borderRadius={"lg"}
        padding={"lg"}
        direction={"vertical"}
        background={"#000"}>
        {@render children()}
    </Container>
</div>

<style lang="scss">
    :global(.container.starfield) {
        background-image: radial-gradient(
                1px 1px at 10% 20%,
                rgba(255, 255, 255, 0.9) 50%,
                transparent 50%
            ),
            radial-gradient(1px 1px at 30% 70%, rgba(255, 255, 255, 0.8) 50%, transparent 50%),
            radial-gradient(1px 1px at 80% 40%, rgba(255, 255, 255, 0.85) 50%, transparent 50%),
            radial-gradient(1px 1px at 55% 15%, rgba(255, 255, 255, 0.8) 50%, transparent 50%),
            radial-gradient(1.5px 1.5px at 25% 50%, rgba(255, 255, 255, 0.6) 50%, transparent 50%),
            radial-gradient(1.5px 1.5px at 65% 30%, rgba(255, 255, 255, 0.65) 50%, transparent 50%),
            radial-gradient(1.5px 1.5px at 90% 75%, rgba(255, 255, 255, 0.55) 50%, transparent 50%),
            radial-gradient(2px 2px at 40% 80%, rgba(255, 255, 255, 0.7) 50%, transparent 50%),
            radial-gradient(2px 2px at 75% 55%, rgba(255, 255, 255, 0.75) 50%, transparent 50%),
            radial-gradient(3px 3px at 15% 85%, rgba(255, 255, 255, 0.4) 40%, transparent 60%),
            radial-gradient(3px 3px at 60% 65%, rgba(255, 255, 255, 0.35) 40%, transparent 60%) !important;
        background-repeat: repeat !important;
        background-size: 8rem 8rem !important;
        animation: drift 60s linear infinite;
    }

    @keyframes drift {
        from {
            background-position: 0 0;
        }
        to {
            background-position: -200px -200px;
        }
    }

    .gradient_border {
        width: 100%;
        padding: var(--bw-thick);
        background: linear-gradient(90deg, var(--primary), var(--secondary));
        border-radius: var(--rad-lg);
    }
</style>
