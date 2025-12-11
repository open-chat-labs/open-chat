<script lang="ts">
    import { Button, H2, Label, Subtitle, type SpacingSize, Column, Row } from "component-lib";

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
    <Row
        colour={"var(--secondary-muted)"}
        borderWidth={"thick"}
        padding={"lg"}
        borderColour={"var(--secondary)"}
        borderStyle={"dashed"}
        borderRadius={"md"}
        mainAxisAlignment={"center"}
        crossAxisAlignment={"center"}
        width={!fixed ? "fill" : { size: "140px" }}
        height={{ size: "140px" }}>
        {name} - {fixed ? "fixed 140px" : "fill"}
    </Row>
{/snippet}

{#snippet contentBlocks()}
    {@render contentBlock("Content A")}
    {@render contentBlock("Content B", false)}
    {@render contentBlock("Content C")}
    {@render contentBlock("Content D")}
{/snippet}

<Row mainAxisAlignment={"spaceBetween"} gap={"xxl"}>
    <Column gap={"lg"}>
        <H2>Horizontal Container / Row</H2>

        <Row
            padding={[paddingTop, paddingRight, paddingBottom, paddingLeft]}
            borderWidth={"thick"}
            width={"fill"}
            borderRadius={"lg"}
            {gap}>
            {@render contentBlocks()}
        </Row>

        <H2>Vertical Container / Column</H2>

        <Row width={"hug"} gap={"lg"}>
            <Column
                padding={[paddingTop, paddingRight, paddingBottom, paddingLeft]}
                borderWidth={"thick"}
                borderRadius={"lg"}
                {gap}>
                {@render contentBlocks()}
            </Column>
            <Column
                padding={[paddingTop, paddingRight, paddingBottom, paddingLeft]}
                borderWidth={"thick"}
                borderRadius={"lg"}
                {gap}>
                {@render contentBlocks()}
            </Column>
            <Column
                padding={[paddingTop, paddingRight, paddingBottom, paddingLeft]}
                borderWidth={"thick"}
                borderRadius={"lg"}
                {gap}>
                {@render contentBlocks()}
            </Column>
        </Row>

        <H2>Complex Layout</H2>

        <Row gap={"lg"} padding={"xl"} borderRadius={"lg"} borderWidth={"thin"}>
            <Column gap={"lg"}>
                {@render contentBlock("A", false)}
                {@render contentBlock("B", false)}
                {@render contentBlock("C", false)}
            </Column>
            <Column height={"fill"} gap={"lg"}>
                {@render contentBlock("A", false)}
                <Row
                    gap={"md"}
                    colour={"var(--secondary-muted)"}
                    borderWidth={"thick"}
                    padding={"lg"}
                    borderColour={"var(--secondary)"}
                    borderStyle={"dashed"}
                    borderRadius={"md"}
                    mainAxisAlignment={"center"}
                    crossAxisAlignment={"end"}
                    width={"fill"}
                    height={"fill"}>
                    <Button>A</Button>
                    <Button secondary>B</Button>
                    <Button secondary>C</Button>
                </Row>
            </Column>
        </Row>
    </Column>
    <Column gap={"xs"} width={{ size: "300px" }}>
        <Subtitle fontWeight={"semi-bold"}>Spacing</Subtitle>

        <Label fontWeight={"light"}>Padding top</Label>
        <select bind:value={paddingTop}>
            {@render sizeOptions()}
        </select>

        <Label fontWeight={"light"}>Padding right</Label>
        <select bind:value={paddingRight}>
            {@render sizeOptions()}
        </select>

        <Label fontWeight={"light"}>Padding bottom</Label>
        <select bind:value={paddingBottom}>
            {@render sizeOptions()}
        </select>

        <Label fontWeight={"light"}>Padding left</Label>
        <select bind:value={paddingLeft}>
            {@render sizeOptions()}
        </select>

        <Label fontWeight={"light"}>Gap</Label>
        <select bind:value={gap}>
            {@render sizeOptions()}
        </select>
    </Column>
</Row>

<style lang="scss">
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
