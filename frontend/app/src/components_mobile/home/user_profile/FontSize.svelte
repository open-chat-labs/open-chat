<script lang="ts">
    import { Container } from "component-lib";
    import { fontScaleStore } from "openchat-client";
    import Range from "../../Range.svelte";
</script>

<Container overflow={"visible"} direction={"vertical"}>
    <Container overflow={"visible"} minHeight={"1rem"} mainAxisAlignment={"spaceBetween"}>
        <div
            class:selected={$fontScaleStore === 0}
            class="letter zero"
            onclick={() => fontScaleStore.set(0)}>
            50%
        </div>
        <div
            class:selected={$fontScaleStore === 1}
            class="letter one"
            onclick={() => fontScaleStore.set(1)}>
            75%
        </div>
        <div
            class:selected={$fontScaleStore === 2}
            class="letter two"
            onclick={() => fontScaleStore.set(2)}>
            100%
        </div>
        <div
            class:selected={$fontScaleStore === 3}
            class="letter three"
            onclick={() => fontScaleStore.set(3)}>
            125%
        </div>
        <div
            class:selected={$fontScaleStore === 4}
            class="letter four"
            onclick={() => fontScaleStore.set(4)}>
            150%
        </div>
    </Container>
    <Container>
        <Range min={0} max={4} bind:value={$fontScaleStore} />
    </Container>
</Container>

<style lang="scss">
    .letter {
        position: absolute;
        transform: translateX(-50%);
        cursor: pointer;
        text-align: center;
        font-size: 12px;
        font-weight: 100;
    }

    .selected {
        color: var(--primary);
        font-weight: 700;
    }

    .zero {
        left: 0;
        transform: translateX(0);
    }

    .one {
        left: 25%;
    }

    .two {
        left: 50%;
    }

    .three {
        left: 75%;
    }

    .four {
        transform: translateX(-100%);
        left: 100%;
    }
</style>
