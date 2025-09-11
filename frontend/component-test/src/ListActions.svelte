<script lang="ts">
    import { Container, ListAction } from "component-lib";
    import Compass from "svelte-material-icons/CompassOutline.svelte";
    import Plus from "svelte-material-icons/Plus.svelte";
    import DebugEvent from "./DebugEvent.svelte";

    let showSmallIcon = $state(false);
</script>

<Container gap={"lg"} direction="vertical">
    <DebugEvent>
        {#snippet children(onAction)}
            <Container gap={"xxl"}>
                <Container
                    width={{ kind: "fixed", size: "400px" }}
                    borderWidth={"thick"}
                    borderRadius={"lg"}
                    borderStyle={"dashed"}
                    borderColour={"cyan"}
                    padding={"xl"}
                    gap={"lg"}
                    direction="vertical">
                    <ListAction onClick={() => onAction("Primary clicked")} colour={"primary"}>
                        {#snippet icon(color)}
                            <Compass {color} />
                        {/snippet}
                        Primary list label
                    </ListAction>
                    <ListAction onClick={() => onAction("Secondary clicked")} colour={"secondary"}>
                        {#snippet icon(color)}
                            <Compass {color} />
                        {/snippet}
                        Secondary list label
                    </ListAction>
                    <ListAction onClick={() => onAction("Tertiary clicked")} colour={"tertiary"}>
                        {#snippet icon(color)}
                            <Compass {color} />
                        {/snippet}
                        Tertiary list label
                    </ListAction>
                    <ListAction onClick={() => onAction("Truncated clicked")} colour={"primary"}>
                        {#snippet icon(color)}
                            <Compass {color} />
                        {/snippet}
                        Ellipsis truncation should apply to list actions
                    </ListAction>
                </Container>
                <Container
                    width={{ kind: "fixed", size: "400px" }}
                    borderWidth={"thick"}
                    borderRadius={"lg"}
                    borderStyle={"dashed"}
                    borderColour={"cyan"}
                    padding={"xl"}
                    gap={"lg"}
                    direction="vertical">
                    <ListAction onClick={() => onAction("Primary clicked")} colour={"primary"}>
                        {#snippet icon(color)}
                            <Compass {color} />
                        {/snippet}
                        {#snippet smallIcon(color: string)}
                            <Plus {color} />
                        {/snippet}
                        Primary list label
                    </ListAction>
                    <ListAction onClick={() => onAction("Secondary clicked")} colour={"secondary"}>
                        {#snippet icon(color)}
                            <Compass {color} />
                        {/snippet}
                        {#snippet smallIcon(color: string)}
                            <Plus {color} />
                        {/snippet}
                        Secondary list label
                    </ListAction>
                    <ListAction onClick={() => onAction("Tertiary clicked")} colour={"tertiary"}>
                        {#snippet icon(color)}
                            <Compass {color} />
                        {/snippet}
                        {#snippet smallIcon(color: string)}
                            <Plus {color} />
                        {/snippet}
                        Tertiary list label
                    </ListAction>
                    <ListAction onClick={() => onAction("Truncated clicked")} colour={"primary"}>
                        {#snippet icon(color)}
                            <Compass {color} />
                        {/snippet}
                        {#snippet smallIcon(color: string)}
                            <Plus {color} />
                        {/snippet}
                        Ellipsis truncation should apply to list actions
                    </ListAction>
                </Container>
            </Container>
        {/snippet}
    </DebugEvent>
</Container>
