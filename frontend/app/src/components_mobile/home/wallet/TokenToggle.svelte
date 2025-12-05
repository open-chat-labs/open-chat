<script module lang="ts">
    export type Option = {
        id: string;
        label: string;
    };
</script>

<script lang="ts">
    import { CommonButton, Container, transition } from "component-lib";

    interface Props {
        options: Option[];
        selected: string;
    }

    let { options, selected = $bindable() }: Props = $props();

    function selectOption(id: string) {
        transition(["fade"], () => {
            selected = id;
        });
    }
</script>

<Container height={{ size: "2rem" }} mainAxisAlignment={"spaceBetween"} gap={"sm"}>
    {#each options as { id, label }}
        {@const isSelected = selected === id}
        <CommonButton
            height={"fill"}
            width={isSelected ? { share: 1.3 } : { share: 1 }}
            onClick={() => selectOption(id)}
            mode={isSelected ? "active" : "default"}
            size={"small"}>
            {label}
        </CommonButton>
    {/each}
</Container>
