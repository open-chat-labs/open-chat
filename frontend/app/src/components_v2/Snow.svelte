<script lang="ts">
    // Credit goes to: https://codepen.io/josetxu/pen/BaVMaGQ

    import { onMount } from "svelte";
    import { snowing } from "../stores/snow";

    let flakes: number[] = $state([]);

    function reduce() {
        if (flakes.length > 10) {
            flakes = new Array(flakes.length - 10);
            window.setTimeout(reduce, 400);
        } else {
            $snowing = false;
        }
    }

    onMount(() => {
        flakes = new Array(200);
        window.setTimeout(reduce, 400);
    });
</script>

<div class="snow">
    {#each flakes as _}
        <div class="snowflake">
            <span></span>
        </div>
    {/each}
</div>

<style lang="scss">
    .snow {
        position: absolute;
        width: 120vw;
        height: 100vh;
        left: -10vw;
        pointer-events: none;
    }

    .snowflake {
        $snowflakes: 200;
        position: absolute;
        top: -5vmin;
        @for $i from 1 through $snowflakes {
            &:nth-child(#{$i}) {
                opacity: random(90) * 0.01;
                font-size: (random(5) * 3px);
                left: random(1200) * 0.1vw;
                animation: fall-#{$i} (random(5) * 10s) (random(25) * -1.5s) ease-in infinite;
                span {
                    animation: spin (random(5) * 3s) linear 0s infinite;
                    filter: drop-shadow(0 0 (random(5) * 1px) #fff);
                }
            }
            @keyframes fall-#{$i} {
                #{percentage( math.div(random(50), 600) )} {
                    transform: rotate(90deg) translateX(0);
                }
                to {
                    transform: rotate(90deg) translateX(calc(100vh + 5vmin));
                    left: random(1200) * 0.1vw;
                }
            }
        }
        span {
            display: block;
            color: #fff;
            &:before {
                content: "\2744";
            }
        }
        &:nth-child(4n + 2) span:before {
            content: "\2745";
        }
        &:nth-child(4n + 3) span:before {
            content: "\2747";
        }
        &:nth-child(4n + 4) span:before {
            content: "\274B";
        }
    }

    @keyframes spin {
        0% {
            transform: rotate(0deg);
        }
        100% {
            transform: rotate(360deg);
        }
    }
</style>
