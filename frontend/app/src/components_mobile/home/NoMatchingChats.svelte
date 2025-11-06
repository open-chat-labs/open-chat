<script lang="ts">
    import { ColourVars, Container } from "component-lib";
    import Robot from "svelte-material-icons/RobotExcitedOutline.svelte";
</script>

<Container
    height={{ kind: "fill" }}
    crossAxisAlignment={"center"}
    mainAxisAlignment={"center"}
    direction={"vertical"}>
    <Robot color={ColourVars.primary} size={"6rem"} />
</Container>
