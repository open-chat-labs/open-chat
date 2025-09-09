<script lang="ts">
    import { Body, Button, Container, FloatingButton, H2, Subtitle } from "component-lib";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import DebugEvent from "./DebugEvent.svelte";

    function onClick(onAction: (action: string) => void) {
        return () => onAction("Button clicked");
    }
</script>

<DebugEvent>
    {#snippet children(onAction)}
        <Container gap={"xl"} direction={"vertical"}>
            <H2>Filled & Outlined buttons</H2>

            <Container gap={"lg"}>
                <Container
                    width={{ kind: "fixed", size: "300px" }}
                    gap={"md"}
                    borderRadius={"lg"}
                    padding={"lg"}
                    borderWidth={"thin"}
                    direction={"vertical"}>
                    <Body>Filled / Primary</Body>
                    <Button onClick={onClick(onAction)}>Button filled</Button>
                    <Button>
                        {#snippet icon(color)}
                            <AccountMultiplePlus size={"1.4rem"} {color} />
                        {/snippet}
                        Button with icon
                    </Button>
                    <Button loading>Loading button</Button>
                    <Button disabled>Disabled button</Button>
                </Container>
                <Container
                    width={{ kind: "fixed", size: "300px" }}
                    gap={"md"}
                    borderRadius={"lg"}
                    padding={"lg"}
                    borderWidth={"thin"}
                    direction={"vertical"}>
                    <Body>Outlined / Secondary</Body>
                    <Button secondary onClick={onClick(onAction)}>Button Outlined</Button>
                    <Button secondary>
                        {#snippet icon(color)}
                            <AccountMultiplePlus size={"1.4rem"} {color} />
                        {/snippet}
                        Button with icon
                    </Button>
                    <Button secondary loading>Loading button</Button>
                    <Button secondary disabled>Disabled button</Button>
                </Container>
            </Container>

            <Container direction={"vertical"} gap={"sm"}>
                <H2>Button Groups (spoiler - they're just containers)</H2>
                <Subtitle>Overflowing</Subtitle>

                <Container
                    padding={"lg"}
                    borderWidth={"thin"}
                    borderRadius={"lg"}
                    width={{ kind: "fixed", size: "450px" }}>
                    <Container gap={"md"}>
                        {#each ["a", "b", "c", "d", "e", "f"] as c}
                            <Button width={{ kind: "fixed", size: "150px" }}>Button {c}</Button>
                        {/each}
                    </Container>
                </Container>

                <Subtitle>Filling</Subtitle>
                <Container
                    padding={"lg"}
                    borderWidth={"thin"}
                    borderRadius={"lg"}
                    width={{ kind: "hug" }}>
                    <Container gap={"md"}>
                        {#each ["a", "b", "c", "d", "e", "f"] as c}
                            <Button width={{ kind: "fixed", size: "150px" }}>Button {c}</Button>
                        {/each}
                    </Container>
                </Container>
            </Container>

            <Container direction={"vertical"} gap={"sm"}>
                <H2>Floating Buttons</H2>

                <Container
                    padding={"lg"}
                    borderWidth={"thin"}
                    borderRadius={"lg"}
                    mainAxisAlignment={"end"}
                    crossAxisAlignment={"end"}
                    width={{ kind: "fixed", size: "450px" }}
                    height={{ kind: "fixed", size: "450px" }}>
                    <FloatingButton>
                        {#snippet icon(color)}
                            <AccountMultiplePlus {color} />
                        {/snippet}
                    </FloatingButton>
                </Container>
            </Container>
        </Container>
    {/snippet}
</DebugEvent>
