<script lang="ts">
    import { CommonButton, Container, H2 } from "component-lib";
    import Cog from "svelte-material-icons/Cog.svelte";
    import DiamondOutline from "svelte-material-icons/DiamondOutline.svelte";
    import DebugEvent from "./DebugEvent.svelte";

    let mouseEvent = $state<MouseEvent>();

    type Option = "all" | "unread" | "groups" | "favourites";

    const labels: Record<Option, string> = {
        all: "All",
        unread: "Unread",
        groups: "Groups",
        favourites: "Favourites",
    };

    let selected = $state<Option>("all");

    function onClick(onAction: (action: string) => void) {
        return () => onAction("Button clicked");
    }
</script>

<DebugEvent>
    {#snippet children(onAction)}
        <Container width={{ kind: "fixed", size: "800px" }} gap={"xl"} direction={"vertical"}>
            <H2>Common buttons for any use</H2>

            <Container gap={"lg"}>
                {#each Object.keys(labels) as option}
                    <CommonButton
                        onClick={() => (selected = option as Option)}
                        size={"medium"}
                        mode={(option as Option) === selected ? "active" : "default"}>
                        {#snippet icon(color)}
                            <Cog {color}></Cog>
                        {/snippet}
                        {labels[option as Option]}
                    </CommonButton>
                {/each}
            </Container>

            <Container gap={"lg"}>
                {#each Object.keys(labels) as option}
                    <CommonButton
                        onClick={() => (selected = option as Option)}
                        size={"small_text"}
                        mode={(option as Option) === selected ? "active" : "default"}>
                        {#snippet icon(color)}
                            <Cog {color}></Cog>
                        {/snippet}
                        {labels[option as Option]}
                    </CommonButton>
                {/each}
            </Container>

            <Container gap={"lg"}>
                <CommonButton onClick={onClick(onAction)} size={"small_text"} mode={"default"}>
                    {#snippet icon(color)}
                        <Cog {color}></Cog>
                    {/snippet}
                    Small text
                </CommonButton>
                <CommonButton onClick={onClick(onAction)} size={"small_text"} mode={"active"}>
                    {#snippet icon(color)}
                        <Cog {color}></Cog>
                    {/snippet}
                    Active variant
                </CommonButton>
            </Container>

            <Container gap={"lg"}>
                <CommonButton onClick={onClick(onAction)} size={"small"} mode={"default"}>
                    {#snippet icon(color)}
                        <Cog {color}></Cog>
                    {/snippet}
                    Small button
                </CommonButton>
                <CommonButton onClick={onClick(onAction)} size={"small"} mode={"active"}>
                    {#snippet icon(color)}
                        <Cog {color}></Cog>
                    {/snippet}
                    Active variant
                </CommonButton>
            </Container>

            <Container gap={"md"}>
                <CommonButton onClick={onClick(onAction)} size={"medium"} mode={"default"}>
                    {#snippet icon(color)}
                        <DiamondOutline {color} />
                    {/snippet}
                    Medium button
                </CommonButton>
                <CommonButton onClick={onClick(onAction)} size={"medium"} mode={"active"}>
                    {#snippet icon(color)}
                        <DiamondOutline {color} />
                    {/snippet}
                    Active variant
                </CommonButton>
            </Container>

            <Container gap={"md"}>
                <CommonButton onClick={onClick(onAction)} size={"large"} mode={"default"}
                    >Large / icon is optional</CommonButton>
                <CommonButton onClick={onClick(onAction)} size={"large"} mode={"active"}
                    >Active variant</CommonButton>
            </Container>
        </Container>
    {/snippet}
</DebugEvent>
