<script lang="ts">
    import {
        Body,
        BodySmall,
        Caption,
        Container,
        type FontWeight,
        H1,
        H2,
        Label,
        Overview,
        Subtitle,
    } from "component-lib";

    let fontWeight = $state<FontWeight>("normal");
</script>

<Container gap={"xl"} direction={"vertical"}>
    <H2>Typography</H2>

    <Container gap={"md"}>
        <Overview width={{ size: "200px" }}>Overview</Overview>
        <Overview {fontWeight}>The quick brown fox jumps over the lazy dog</Overview>
    </Container>
    <Container gap={"md"}>
        <H1 width={{ size: "200px" }}>H1</H1>
        <H1 {fontWeight}>The quick brown fox jumps over the lazy dog</H1>
    </Container>
    <Container gap={"md"}>
        <H2 width={{ size: "200px" }}>H2</H2>
        <H2 {fontWeight}>The quick brown fox jumps over the lazy dog</H2>
    </Container>
    <Container gap={"md"}>
        <Subtitle width={{ size: "200px" }}>Subtitle</Subtitle>
        <Subtitle {fontWeight}>The quick brown fox jumps over the lazy dog</Subtitle>
    </Container>
    <Container gap={"md"}>
        <Body width={{ size: "200px" }}>Body</Body>
        <Body {fontWeight}>The quick brown fox jumps over the lazy dog</Body>
    </Container>
    <Container gap={"md"}>
        <BodySmall width={{ size: "200px" }}>Body Small</BodySmall>
        <BodySmall {fontWeight}>The quick brown fox jumps over the lazy dog</BodySmall>
    </Container>
    <Container gap={"md"}>
        <Caption width={{ size: "200px" }}>Caption</Caption>
        <Caption {fontWeight}>The quick brown fox jumps over the lazy dog</Caption>
    </Container>
    <Container gap={"md"}>
        <Label width={{ size: "200px" }}>Label</Label>
        <Label {fontWeight}>The quick brown fox jumps over the lazy dog</Label>
    </Container>

    <Container gap={"sm"} width={{ size: "300px" }} direction={"vertical"}>
        <Subtitle>Font weight</Subtitle>
        <select bind:value={fontWeight}>
            <option value="light">Light</option>
            <option value="normal">Normal</option>
            <option value="semi-bold">Semi-bold</option>
            <option value="bold">Bold</option>
        </select>
    </Container>
</Container>

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
