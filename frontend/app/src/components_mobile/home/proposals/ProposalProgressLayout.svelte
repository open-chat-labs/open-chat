<script lang="ts">
    import { Column, Row } from "component-lib";
    import type { Snippet } from "svelte";
    interface Props {
        adopt: Snippet;
        reject: Snippet;
        progress: Snippet;
    }

    let { adopt, reject, progress }: Props = $props();
</script>

<Column crossAxisAlignment={"center"} mainAxisAlignment={"center"} gap={"lg"}>
    <Row mainAxisAlignment={"spaceAround"}>
        {@render adopt()}
        {@render reject()}
    </Row>
    {@render progress()}
</Column>
