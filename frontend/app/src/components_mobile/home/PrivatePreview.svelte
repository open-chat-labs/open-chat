<script lang="ts">
    import { Container } from "component-lib";
    import { mobileWidth } from "openchat-client";
    import { onMount } from "svelte";

    let number = $mobileWidth ? 5 : 7;
    let messages: [number, unknown[]][] = [];

    function rand(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    onMount(() => {
        for (let i = 0; i < number; i++) {
            const lines = Array.from({ length: rand(2, 6) });
            messages.push([rand(50, 100), lines]);
        }
        messages = messages; // force reaction
    });
</script>

{#each messages as [percentage, lines]}
    <Container gap={"md"}>
        <div class="avatar"></div>
        <div class="fake-message" style={`width: ${percentage}%`}>
            {#each lines as _}
                <div class="line"></div>
            {/each}
        </div>
    </Container>
{/each}

<style lang="scss">
    .avatar {
        flex: 0 0 toRem(48);
        height: toRem(48);
        width: toRem(48);
        border-radius: 50%;
        background-color: var(--text-tertiary);
    }
    .fake-message {
        border-radius: $sp3;
        background-color: var(--background-2);
        padding: toRem(8) toRem(12) toRem(8) toRem(12);
        max-width: 80%;
        min-width: 90px;
        overflow: hidden;
        overflow-wrap: break-word;
        margin-bottom: $sp4;

        @include size-above(xl) {
            max-width: 70%;
        }

        .line {
            height: 8px;
            background-color: rgba(255, 255, 255, 0.05);
            background-color: var(--text-tertiary);
            margin-bottom: $sp3;
            border-radius: var(--rd);
            &:last-child {
                width: 50%;
            }
        }
    }
</style>
