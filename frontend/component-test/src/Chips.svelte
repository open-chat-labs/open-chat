<script lang="ts">
    import { Chip, Container, UserChip } from "component-lib";
    import GiftOutline from "svelte-material-icons/GiftOutline.svelte";
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
        <Container width={{ kind: "fixed", size: "500px" }} gap={"xl"} direction={"vertical"}>
            <Container mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"center"}>
                <Chip mode={"default"}>Chip</Chip>

                <Chip mode={"filter"}>Chip</Chip>

                <Chip mode={"rounded"}>Chip</Chip>
            </Container>

            <Container mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"center"}>
                <Chip mode={"default"}>
                    {#snippet icon(color)}
                        <GiftOutline {color} />
                    {/snippet}

                    Chip</Chip>

                <Chip mode={"filter"}>
                    {#snippet icon(color)}
                        <GiftOutline {color} />
                    {/snippet}
                    Chip</Chip>

                <Chip mode={"rounded"}>
                    {#snippet icon(color)}
                        <GiftOutline {color} />
                    {/snippet}
                    Chip</Chip>
            </Container>

            <Container mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"center"}>
                <Chip onRemove={() => onAction("remove clicked")} mode={"default"}>Chip</Chip>

                <Chip onRemove={() => onAction("remove clicked")} mode={"filter"}>Chip</Chip>

                <Chip onRemove={() => onAction("remove clicked")} mode={"rounded"}>Chip</Chip>
            </Container>

            <Container mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"center"}>
                <Chip onRemove={() => onAction("remove clicked")} mode={"default"}>
                    {#snippet icon(color)}
                        <GiftOutline {color} />
                    {/snippet}
                    Chip</Chip>

                <Chip onRemove={() => onAction("remove clicked")} mode={"filter"}>
                    {#snippet icon(color)}
                        <GiftOutline {color} />
                    {/snippet}
                    Chip</Chip>

                <Chip onRemove={() => onAction("remove clicked")} mode={"rounded"}>
                    {#snippet icon(color)}
                        <GiftOutline {color} />
                    {/snippet}
                    Chip</Chip>
            </Container>

            <Container mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"center"}>
                <UserChip avatarUrl={"/witch.png"} onRemove={() => onAction("remove clicked")}
                    >@AlphaUser</UserChip>
                <UserChip avatarUrl={"/horse.png"} onRemove={() => onAction("remove clicked")}
                    >@BetaUser</UserChip>
                <UserChip avatarUrl={"/disco.png"} onRemove={() => onAction("remove clicked")}
                    >@CharlieUser</UserChip>
            </Container>

            <Container mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"center"}>
                <UserChip avatarUrl={"/witch.png"}>@AlphaUser</UserChip>
                <UserChip avatarUrl={"/horse.png"}>@BetaUser</UserChip>
                <UserChip avatarUrl={"/disco.png"}>@CharlieUser</UserChip>
            </Container>
        </Container>
    {/snippet}
</DebugEvent>
