<script lang="ts">
    import { Container, Label, Subtitle, type SpacingSize } from "component-lib";

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
        <Subtitle>Horizontal Container / Row</Subtitle>

        <Container
            padding={[paddingTop, paddingRight, paddingBottom, paddingLeft]}
            borderWidth={"thick"}
            width={{ kind: "fill" }}
            borderRadius={"lg"}
            {gap}>
            {@render contentBlocks()}
        </Container>

        <Subtitle>Vertical Container / Column</Subtitle>

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

        <Subtitle>Complex Layout</Subtitle>

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
    <Container gap={"xs"} width={{ kind: "fixed", size: "300px" }} direction={"vertical"}>
        <Subtitle>Spacing</Subtitle>

        <Label>Padding top</Label>
        <select bind:value={paddingTop}>
            {@render sizeOptions()}
        </select>

        <Label>Padding right</Label>
        <select bind:value={paddingRight}>
            {@render sizeOptions()}
        </select>

        <Label>Padding bottom</Label>
        <select bind:value={paddingBottom}>
            {@render sizeOptions()}
        </select>

        <Label>Padding left</Label>
        <select bind:value={paddingLeft}>
            {@render sizeOptions()}
        </select>

        <Label>Gap</Label>
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
