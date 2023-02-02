<script lang="ts">
</script>

<div class="coin" />

<style type="text/scss">
    :root {
        // --face: #be9d66;
        --face: #f79413;
        --lowlight: #111;
        // --side: #896c3b;
        --side: #f79413;
        --side-dark: #120e08;
        --coin-size: 9rem;
        --coin-face: url("../assets/ckbtc_nobackground.svg");
    }

    .coin {
        height: var(--coin-size);
        width: var(--coin-size);
        margin: 0.5rem;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    }

    .coin::before {
        content: "";
        display: block;
        position: relative;
        height: var(--coin-size);
        width: var(--coin-size);
        border-radius: 50%;
        // background-color: var(--face);
        animation: spin 1s linear infinite;
        background-image: var(--coin-face);
        background-size: 100% 100%;
        background-position: center;
        background-blend-mode: overlay;
    }

    /* animation definitions */

    @keyframes spin {
        0% {
            width: var(--coin-size);
            box-shadow: 0 0 0 var(--side-dark);
            animation-timing-function: ease-in;
        }

        49.999% {
            width: 0.1rem;
            box-shadow: 0.05rem 0 0 var(--side), 0.1rem 0 0 var(--side), 0.15rem 0 0 var(--side),
                0.2rem 0 0 var(--side), 0.25rem 0 0 var(--side), 0.3rem 0 0 var(--side),
                0.35rem 0 0 var(--side), 0.4rem 0 0 var(--side), 0.45rem 0 0 var(--side),
                0.5rem 0 0 var(--side), 0.55rem 0 0 var(--side), 0.6rem 0 0 var(--side),
                0.65rem 0 0 var(--side), 0.7rem 0 0 var(--side), 0.75rem 0 0 var(--side);
            transform: translateX(-0.375rem);
            background-color: var(--lowlight);
            animation-timing-function: linear;
        }

        50.001% {
            width: 0.1rem;
            box-shadow: -0.05rem 0 0 var(--side), -0.1rem 0 0 var(--side), -0.15rem 0 0 var(--side),
                -0.2rem 0 0 var(--side), -0.25rem 0 0 var(--side), -0.3rem 0 0 var(--side),
                -0.35rem 0 0 var(--side), -0.4rem 0 0 var(--side), -0.45rem 0 0 var(--side),
                -0.5rem 0 0 var(--side), -0.55rem 0 0 var(--side), -0.6rem 0 0 var(--side),
                -0.65rem 0 0 var(--side), -0.7rem 0 0 var(--side), -0.75rem 0 0 var(--side);
            transform: translateX(0.375rem);
            background-color: var(--lowlight);
            animation-timing-function: ease-out;
        }

        100% {
            width: var(--coin-size);
            box-shadow: 0 0 0 var(--side-dark);
        }
    }
</style>
