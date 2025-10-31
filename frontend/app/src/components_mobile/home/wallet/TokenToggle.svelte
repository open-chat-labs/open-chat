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

<Container mainAxisAlignment={"spaceBetween"} gap={"sm"}>
    {#each options as { id, label }}
        {@const isSelected = selected === id}
        <CommonButton
            width={isSelected ? { kind: "share", value: 1.3 } : { kind: "share", value: 1 }}
            onClick={() => selectOption(id)}
            mode={isSelected ? "active" : "default"}
            size={"small"}>
            {label}
        </CommonButton>
    {/each}
</Container>
