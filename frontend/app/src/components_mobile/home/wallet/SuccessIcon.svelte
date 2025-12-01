<script lang="ts">
    import { Avatar, Container } from "component-lib";

    interface Props {
        tokenUrl: string;
    }

    let { tokenUrl }: Props = $props();
</script>

<Container padding={"xl"} crossAxisAlignment={"center"} mainAxisAlignment={"center"}>
    <Container overflow={"visible"} width={{ kind: "hug" }}>
        <svg
            width="80"
            height="80"
            viewBox="0 0 80 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg">
            <path
                d="M40 2C60.9868 2 78 19.0132 78 40C78 60.9868 60.9868 78 40 78C19.0132 78 2 60.9868 2 40C2 19.0132 19.0132 2 40 2Z"
                fill="#1C1D26" />
            <path
                d="M40 2C60.9868 2 78 19.0132 78 40C78 60.9868 60.9868 78 40 78C19.0132 78 2 60.9868 2 40C2 19.0132 19.0132 2 40 2Z"
                stroke="#4DC164"
                stroke-width="4" />
            <path
                d="M60.25 28.7496L33.25 55.7496L20.875 43.3746L24.0475 40.2021L33.25 49.3821L57.0775 25.5771L60.25 28.7496Z"
                fill="#4DC164" />
        </svg>
        <div class="nested_avatar">
            <Avatar size={"sm"} url={tokenUrl}></Avatar>
        </div>
    </Container>
</Container>

<style lang="scss">
    .nested_avatar {
        padding: 4px;
        background-color: var(--background-1);
        border-radius: var(--rad-circle);
        position: absolute;
        bottom: -0.5rem;
        right: -0.5rem;
    }
</style>
