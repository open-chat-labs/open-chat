<script lang="ts">
    import { BottomBar, Container, H2 } from "component-lib";
</script>

<Container gap={"md"} direction={"vertical"}>
    <H2>Used for main navigation</H2>
    <Container width={{ kind: "fixed", size: "412px" }} gap={"lg"} direction={"vertical"}>
        <BottomBar selection={"chats"}></BottomBar>
        <BottomBar selection={"communities"}></BottomBar>
        <BottomBar selection={"notification"}></BottomBar>
        <BottomBar selection={"profile"}></BottomBar>
    </Container>
</Container>
