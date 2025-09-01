<script lang="ts">
    import { Body, Container, H1, H2, Overview, Subtitle } from "component-lib";
</script>

<Container gap={"xl"} direction={"vertical"}>
    <H2>Typography</H2>

    <Container gap={"md"}>
        <Overview width={{ kind: "fixed", size: "200px" }}>Overview</Overview>
        <Overview>The quick brown fox jumps over the lazy dog</Overview>
    </Container>
    <Container gap={"md"}>
        <H1 width={{ kind: "fixed", size: "200px" }}>H1</H1>
        <H1>The quick brown fox jumps over the lazy dog</H1>
    </Container>
    <Container gap={"md"}>
        <H2 width={{ kind: "fixed", size: "200px" }}>H2</H2>
        <H2>The quick brown fox jumps over the lazy dog</H2>
    </Container>
    <Container gap={"md"}>
        <Subtitle width={{ kind: "fixed", size: "200px" }}>Subtitle</Subtitle>
        <Subtitle>The quick brown fox jumps over the lazy dog</Subtitle>
    </Container>
    <Container gap={"md"}>
        <Body width={{ kind: "fixed", size: "200px" }}>Body</Body>
        <Body>The quick brown fox jumps over the lazy dog</Body>
    </Container>
</Container>
