<script lang="ts">
    import { onMount } from "svelte";

    const messages: [number, unknown[]][] = [];

    function rand(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    onMount(() => {
        for (let i = 0; i < 10; i++) {
            const lines = Array.from({ length: rand(2, 6) });
            messages.push([rand(50, 100), lines]);
        }
    });

    $: console.log("Fake messages: ", messages);
</script>

{#each messages as [percentage, lines]}
    <div class="fake-message" style={`{ width: ${percentage}%}`}>
        {#each lines as line}
            <div class="line" />
        {/each}
    </div>
{/each}

<style type="text/scss">
    .fake-message {
        border-radius: $sp3;
        background-color: var(--currentChat-msg-bg);
        padding: toRem(8) toRem(12) toRem(8) toRem(12);
        max-width: 80%;
        min-width: 90px;
        overflow: hidden;
        overflow-wrap: break-word;
        height: 300px;

        @include size-above(xl) {
            max-width: 70%;
        }

        .line {
            height: 10px;
            background-color: #ccc;
            margin-bottom: $sp3;
        }
    }
</style>
