<script lang="ts">
    import { Button } from "component-lib";
    import { type ResourceKey } from "openchat-client";
    import Translatable from "../../Translatable.svelte";

    interface Props {
        name: ResourceKey;
        hollow?: boolean;
        onClick?: (e: MouseEvent) => void;
    }

    let { name, hollow = false, onClick }: Props = $props();
</script>

<Button width={"fill"} secondary={hollow} {onClick}>
    <Translatable resourceKey={name} />
</Button>
