<script lang="ts">
    import { Container, type Direction, type SpacingSize } from "component-lib";

    let paddingLeft = $state<SpacingSize>("lg");
    let paddingRight = $state<SpacingSize>("lg");
    let paddingTop = $state<SpacingSize>("lg");
    let paddingBottom = $state<SpacingSize>("lg");
    let gap = $state<SpacingSize>("lg");
</script>

{#snippet sizeOptions()}
    <option value="zero">Zero</option>
    <option value="xxs">XXS</option>
    <option value="xs">XS</option>
    <option value="sm">SM</option>
    <option value="md">MD</option>
    <option value="lg">LG</option>
    <option value="xl">XL</option>
    <option value="xxl">XXL</option>
    <option value="xxxl">XXXL</option>
    <option value="huge">Huge</option>
{/snippet}

{#snippet contentBlock(name: string, parent: Direction, fixed = true)}
    <Container
        colour={"var(--secondary-muted)"}
        parentDirection={parent}
        borderWidth={"thick"}
        padding={["lg"]}
        borderColour={"var(--secondary)"}
        borderStyle={"dashed"}
        borderRadius={"md"}
        mainAxisAlignment={"center"}
        crossAxisAlignment={"center"}
        width={!fixed ? { kind: "fill" } : { kind: "fixed", size: "120px" }}
        height={{ kind: "fixed", size: "120px" }}>
        {name} - {fixed ? "fixed 120px" : "fill"}
    </Container>
{/snippet}

{#snippet contentBlocks(parent: Direction)}
    {@render contentBlock("Content A", parent)}
    {@render contentBlock("Content B", parent, false)}
    {@render contentBlock("Content C", parent)}
    {@render contentBlock("Content D", parent)}
{/snippet}

<Container gap={"xxl"}>
    <Container gap={"lg"} direction={"vertical"}>
        <h3>Horizontal Container / Row</h3>

        <Container
            padding={[paddingTop, paddingRight, paddingBottom, paddingLeft]}
            borderWidth={"thick"}
            width={{ kind: "fixed", size: "900px" }}
            borderRadius={"lg"}
            {gap}>
            {@render contentBlocks("horizontal")}
        </Container>

        <h3>Vertical Container / Column</h3>
        <Container gap={"lg"}>
            <Container
                direction={"vertical"}
                padding={[paddingTop, paddingRight, paddingBottom, paddingLeft]}
                borderWidth={"thick"}
                borderRadius={"lg"}
                {gap}>
                {@render contentBlocks("vertical")}
            </Container>
            <Container
                direction={"vertical"}
                padding={[paddingTop, paddingRight, paddingBottom, paddingLeft]}
                borderWidth={"thick"}
                borderRadius={"lg"}
                {gap}>
                {@render contentBlocks("vertical")}
            </Container>
            <Container
                direction={"vertical"}
                padding={[paddingTop, paddingRight, paddingBottom, paddingLeft]}
                borderWidth={"thick"}
                borderRadius={"lg"}
                {gap}>
                {@render contentBlocks("vertical")}
            </Container>
        </Container>
    </Container>
    <Container width={{ kind: "fixed", size: "300px" }} direction={"vertical"}>
        <h3>Spacing</h3>

        <h5>Padding top</h5>
        <select bind:value={paddingTop}>
            {@render sizeOptions()}
        </select>

        <h5>Padding right</h5>
        <select bind:value={paddingRight}>
            {@render sizeOptions()}
        </select>

        <h5>Padding bottom</h5>
        <select bind:value={paddingBottom}>
            {@render sizeOptions()}
        </select>

        <h5>Padding left</h5>
        <select bind:value={paddingLeft}>
            {@render sizeOptions()}
        </select>

        <h5>Gap</h5>
        <select bind:value={gap}>
            {@render sizeOptions()}
        </select>
    </Container>
</Container>

<style lang="scss">
    h5 {
        margin-bottom: 4px;
        color: var(--text-secondary);
    }

    select {
        margin-bottom: var(--sp-lg);
        border: none;
        border-radius: var(--rad-sm);
        padding: var(--sp-xs);
        height: 30px;
        background-color: var(--text-tertiary);
        color: var(--text-placeholder);
    }
</style>
