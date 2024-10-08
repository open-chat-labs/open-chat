<script lang="ts">
    export let background = false;
</script>

<div class:background class="witch" />

<style lang="scss">
    :global(body.witch .witch) {
        display: block;
    }

    .witch {
        display: none;
        height: 100%;
        width: 100%;
        position: absolute;
        @include z-index("witch");
        background-color: black;
        background-image: url("/assets/witch.jpg");
        background-image: url("/assets/zombie.png");
        background-repeat: no-repeat;
        background-size: cover;
        animation: shake 100ms linear infinite;

        &.background {
            z-index: -1;
        }
    }

    @keyframes shake {
        0% {
            background-position: center;
        }
        50% {
            background-position: calc(50% - 5px) center;
        }
        100% {
            background-position: calc(50% + 5px) center;
        }
    }
</style>
