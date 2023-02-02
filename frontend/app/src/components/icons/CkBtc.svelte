<script lang="ts">
    export let shadow = false;
</script>

<div class:shadow class="coin" />

<style type="text/scss">
    :root {
        --face: var(--prize);
        --lowlight: #111;
        --side: var(--prize);
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
        border-radius: 50% 50% 0% 0% / 60% 60% 0% 0%;

        &.shadow::after {
            content: "";
            position: absolute;
            bottom: 9px;
            left: 35%;
            right: 35%;
            height: 20px;
            border-radius: 50%;
            background-color: rgba(0, 0, 0, 0.1);
        }
    }

    .coin::before {
        content: "";
        display: block;
        position: relative;
        height: var(--coin-size);
        width: var(--coin-size);
        border-radius: 50%;
        // background-color: var(--face);
        animation: spin 2s linear infinite;
        background-image: var(--coin-face);
        background-size: 100% 100%;
        background-position: center;
        background-blend-mode: overlay;
    }

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
