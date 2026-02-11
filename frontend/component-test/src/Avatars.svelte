<script lang="ts">
    import { Avatar, Container } from "component-lib";

    const images = [
        ["witch", "witch.png"],
        ["disco", "disco.png"],
        ["horse", "horse.png"],
        ["robot", "robot.jpg"],
        ["mushroom", "mushroom.png"],
    ];
</script>

<Container gap={"xl"} direction={"vertical"}>
    {#each images as [name, file]}
        <Container gap={"xl"} crossAxisAlignment={"center"}>
            <Avatar name={`huge ${name}`} url={`/${file}`} size={"huge"} />
            <Avatar name={`extra extra large ${name}`} url={`/${file}`} size={"xxl"} />
            <Avatar name={`extra large ${name}`} url={`/${file}`} size={"xl"} />
            <Avatar name={`large ${name}`} url={`/${file}`} size={"lg"} />
            <Avatar name={`medium ${name}`} url={`/${file}`} size={"md"} />
            <Avatar name={`small ${name}`} url={`/${file}`} size={"sm"} />
            <Avatar name={`extra small ${name}`} url={`/${file}`} size={"xs"} />
        </Container>
    {/each}
    <Container gap={"xl"} crossAxisAlignment={"center"}>
        <Avatar name={`huge`} url={`/witch.png`} size={"huge"} highlightBorder />
        <Avatar name={`extra extra large`} url={`/witch.png`} size={"xxl"} />
        <Avatar name={`extra large`} url={`/witch.png`} size={"xl"} />
        <Avatar name={`large`} url={`/witch.png`} size={"lg"} />
        <Avatar name={`medium`} url={`/witch.png`} size={"md"} />
        <Avatar name={`small`} url={`/witch.png`} size={"sm"} />
        <Avatar name={`extra small`} url={`/witch.png`} size={"xs"} />
    </Container>
</Container>
