<script lang="ts">
    import { onMount } from "svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import LockOutline from "svelte-material-icons/LockOutline.svelte";

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
    <div class="bubble">
        <div class="avatar" />
        <div class="fake-message" style={`width: ${percentage}%`}>
            {#each lines as line}
                <div class="line" />
            {/each}
        </div>
    </div>
{/each}

<div class="lock">
    <LockOutline size={"6em"} color="var(--txt-light)" />
</div>

<style lang="scss">
    .bubble {
        display: flex;
        gap: $sp4;
    }

    .lock {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);

        @include mobile() {
            position: fixed;
        }
    }

    .avatar {
        flex: 0 0 toRem(48);
        height: toRem(48);
        width: toRem(48);
        border-radius: 50%;
        background-color: var(--currentChat-msg-bg);
    }
    .fake-message {
        border-radius: $sp3;
        background-color: var(--currentChat-msg-bg);
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
            margin-bottom: $sp3;
            border-radius: $sp2;
            &:last-child {
                width: 50%;
            }
        }
    }
</style>
