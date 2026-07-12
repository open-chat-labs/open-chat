<script lang="ts">
    import { Chip } from "component-lib";

    interface Props {
        match: { name: string };
        onRemove: () => void;
    }

    let { match, onRemove }: Props = $props();
</script>

<Chip {onRemove} mode={"filter"}>
    {match.name}
</Chip>
