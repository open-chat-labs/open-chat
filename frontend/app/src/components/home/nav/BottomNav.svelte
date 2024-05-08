<script lang="ts">
    import CommonNavElements from "./CommonNavElements.svelte";
</script>

<div class="bottom-nav">
    <CommonNavElements
        menuAlignment={"end"}
        menuPosition={"top"}
        menuGutter={0}
        orientation={"horizontal"}
        on:profile />
</div>

<style lang="scss">
    .bottom-nav {
        display: flex;
        justify-content: space-evenly;
        align-items: center;
        border-top: var(--bw) solid var(--bd);
        height: toRem(60);
        flex: 0 0 toRem(60);
    }
</style>
