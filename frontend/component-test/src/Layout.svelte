<script lang="ts">
    import { Container, type SpacingSize } from "component-lib";

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

{#snippet contentBlock(name: string, fixed = true)}
    <Container
        colour={"var(--secondary-muted)"}
        borderWidth={"thick"}
        padding={["lg"]}
        borderColour={"var(--secondary)"}
        borderStyle={"dashed"}
        borderRadius={"md"}
        mainAxisAlignment={"center"}
        crossAxisAlignment={"center"}
        width={!fixed ? { kind: "fill" } : { kind: "fixed", size: "140px" }}
        height={{ kind: "fixed", size: "140px" }}>
        {name} - {fixed ? "fixed 140px" : "fill"}
    </Container>
{/snippet}

{#snippet contentBlocks()}
    {@render contentBlock("Content A")}
    {@render contentBlock("Content B", false)}
    {@render contentBlock("Content C")}
    {@render contentBlock("Content D")}
{/snippet}

<Container mainAxisAlignment={"spaceBetween"} gap={"xxl"}>
    <Container gap={"lg"} direction={"vertical"}>
        <h3>Horizontal Container / Row</h3>

        <Container
            padding={[paddingTop, paddingRight, paddingBottom, paddingLeft]}
            borderWidth={"thick"}
            width={{ kind: "fill" }}
            borderRadius={"lg"}
            {gap}>
            {@render contentBlocks()}
        </Container>

        <h3>Vertical Container / Column</h3>
        <Container width={{ kind: "hug" }} gap={"lg"}>
            <Container
                direction={"vertical"}
                padding={[paddingTop, paddingRight, paddingBottom, paddingLeft]}
                borderWidth={"thick"}
                borderRadius={"lg"}
                {gap}>
                {@render contentBlocks()}
            </Container>
            <Container
                direction={"vertical"}
                padding={[paddingTop, paddingRight, paddingBottom, paddingLeft]}
                borderWidth={"thick"}
                borderRadius={"lg"}
                {gap}>
                {@render contentBlocks()}
            </Container>
            <Container
                direction={"vertical"}
                padding={[paddingTop, paddingRight, paddingBottom, paddingLeft]}
                borderWidth={"thick"}
                borderRadius={"lg"}
                {gap}>
                {@render contentBlocks()}
            </Container>
        </Container>

        <h3>Complex layout</h3>

        <Container gap={"lg"} padding={["xl"]} borderRadius={"lg"} borderWidth={"thin"}>
            <Container gap={"lg"} direction={"vertical"}>
                {@render contentBlock("A", false)}
                {@render contentBlock("B", false)}
                {@render contentBlock("C", false)}
            </Container>
            <Container height={{ kind: "fill" }} gap={"lg"} direction={"vertical"}>
                {@render contentBlock("A", false)}
                <Container
                    gap={"md"}
                    colour={"var(--secondary-muted)"}
                    borderWidth={"thick"}
                    padding={["lg"]}
                    borderColour={"var(--secondary)"}
                    borderStyle={"dashed"}
                    borderRadius={"md"}
                    mainAxisAlignment={"center"}
                    crossAxisAlignment={"end"}
                    width={{ kind: "fill" }}
                    height={{ kind: "fill" }}>
                    <Container
                        padding={["md"]}
                        borderColour={"var(--secondary)"}
                        borderStyle={"dashed"}
                        mainAxisAlignment={"center"}
                        crossAxisAlignment={"center"}
                        borderRadius={"md"}
                        borderWidth={"thin"}>A</Container>
                    <Container
                        padding={["md"]}
                        borderColour={"var(--secondary)"}
                        borderStyle={"dashed"}
                        mainAxisAlignment={"center"}
                        crossAxisAlignment={"center"}
                        borderRadius={"md"}
                        borderWidth={"thin"}>B</Container>
                    <Container
                        padding={["md"]}
                        borderColour={"var(--secondary)"}
                        borderStyle={"dashed"}
                        mainAxisAlignment={"center"}
                        crossAxisAlignment={"center"}
                        borderRadius={"md"}
                        borderWidth={"thin"}>C</Container>
                </Container>
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
        width: 100%;
        background-color: var(--text-tertiary);
        color: var(--text-placeholder);
    }
</style>
