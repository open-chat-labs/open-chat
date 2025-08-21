<script>
    import Button from "../src/components/Button.svelte";
</script>

<div class="section">
    <h1>Filled & Outlined buttons</h1>

    <div class="blocks">
        <div class="filled block">
            <h3>Filled / Primary</h3>
            <Button>Button filled</Button>
            <Button>Button with icon</Button>
            <Button loading>Loading button</Button>
            <Button disabled>Disabled button</Button>
        </div>
        <div class="outlined block">
            <h3>Outlined / Secondary</h3>
        </div>
    </div>
</div>

<style lang="scss">
    h1 {
        margin-bottom: 10px;
    }

    .blocks {
        display: flex;
        gap: 20px;
    }

    .block {
        padding: 20px;
        width: 300px;
        border: 1px dashed #9747ff;
        border-radius: 10px;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
</style>
