<script lang="ts">
    import { Body, Button, Container, FloatingButton, H2, Subtitle } from "component-lib";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import { fade } from "svelte/transition";

    let filledMouseEvent = $state<MouseEvent>();
    let hollowMouseEvent = $state<MouseEvent>();

    function onFilledClick(e: MouseEvent) {
        filledMouseEvent = e;
        window.setTimeout(() => (filledMouseEvent = undefined), 2000);
    }

    function onHollowClick(e: MouseEvent) {
        hollowMouseEvent = e;
        window.setTimeout(() => (hollowMouseEvent = undefined), 2000);
    }
</script>

<Container gap={"xl"} direction={"vertical"}>
    <H2>Filled & Outlined buttons</H2>

    <Container gap={"lg"}>
        <Container
            width={{ kind: "fixed", size: "300px" }}
            gap={"md"}
            borderRadius={"lg"}
            padding={["lg"]}
            borderWidth={"thin"}
            direction={"vertical"}>
            <Body>Filled / Primary</Body>
            <Button onClick={onFilledClick}>Button filled</Button>
            <Button>
                {#snippet icon(color)}
                    <AccountMultiplePlus size={"1.4rem"} {color} />
                {/snippet}
                Button with icon
            </Button>
            <Button loading>Loading button</Button>
            <Button disabled>Disabled button</Button>
            {#if filledMouseEvent}
                <pre transition:fade>{JSON.stringify(filledMouseEvent)}</pre>
            {/if}
        </Container>
        <Container
            width={{ kind: "fixed", size: "300px" }}
            gap={"md"}
            borderRadius={"lg"}
            padding={["lg"]}
            borderWidth={"thin"}
            direction={"vertical"}>
            <Body>Outlined / Secondary</Body>
            <Button secondary onClick={onHollowClick}>Button Outlined</Button>
            <Button secondary>
                {#snippet icon(color)}
                    <AccountMultiplePlus size={"1.4rem"} {color} />
                {/snippet}
                Button with icon
            </Button>
            <Button secondary loading>Loading button</Button>
            <Button secondary disabled>Disabled button</Button>
            {#if hollowMouseEvent}
                <pre transition:fade>{JSON.stringify(hollowMouseEvent)}</pre>
            {/if}
        </Container>
    </Container>

    <Container direction={"vertical"} gap={"sm"}>
        <H2>Button Groups (spoiler - they're just containers)</H2>
        <Subtitle>Overflowing</Subtitle>

        <Container
            padding={["lg"]}
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
            padding={["lg"]}
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
            padding={["lg"]}
            borderWidth={"thin"}
            borderRadius={"lg"}
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
