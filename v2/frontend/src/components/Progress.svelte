<script lang="ts">
    export let percent: number;
</script>

<div class="bar">
    <span class="meter" style={`width: ${percent}%`} />
</div>

<style type="text/scss">
    $progress-bar-x-large: 40px;

    .bar {
        border: 1px solid #ccc;

        margin: 0 $sp3;
        width: 100%;
        height: $progress-bar-x-large;
        position: relative;
        border-radius: $progress-bar-x-large / 2;
        overflow: hidden;
    }

    .meter {
        width: 0;
        transition: width 300ms;
        display: block;
        height: 100%;
        border-radius: $progress-bar-x-large / 2;
        background-color: var(--button-bg);
        position: relative;
    }
</style>
