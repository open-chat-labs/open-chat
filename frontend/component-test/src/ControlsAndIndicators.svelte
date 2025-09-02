<script lang="ts">
    import {
        Body,
        Caption,
        Container,
        CountBadge,
        H2,
        NotificationIndicator,
        Switch,
    } from "component-lib";

    let toggle = $state(true);
</script>

<Container gap={"xl"} direction={"vertical"}>
    <H2>Controls & Indicators</H2>

    <Container gap={"xl"}>
        <Container gap={"lg"} direction={"vertical"}>
            <Body>Notification Indicator</Body>

            <NotificationIndicator />

            <Caption>
                TBD - how to position this. Will work this out when building the nav bottom bar
            </Caption>
        </Container>
        <Container gap={"lg"} direction={"vertical"}>
            <Body>Badges (Counted / Added)</Body>

            <CountBadge>21</CountBadge>

            <CountBadge size={"large"}>55</CountBadge>

            <CountBadge mode={"additive"}>+21</CountBadge>

            <CountBadge size={"large"} mode={"additive"}>+21</CountBadge>

            <Caption>Will also need to figure out how these are positioned</Caption>
        </Container>
        <Container gap={"lg"} direction={"vertical"}>
            <Body>Switch / Checkbox</Body>

            <Switch bind:checked={toggle} />

            <pre>Toggle value: {toggle}</pre>
        </Container>
        <Container gap={"lg"} direction={"vertical"}>
            <Body>Radio</Body>
        </Container>
    </Container>
</Container>
