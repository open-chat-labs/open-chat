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
            <Avatar name={`extra large ${name}`} url={`/${file}`} size={"xl"} />
            <Avatar name={`large ${name}`} url={`/${file}`} size={"lg"} />
            <Avatar name={`medium ${name}`} url={`/${file}`} size={"md"} />
            <Avatar name={`small ${name}`} url={`/${file}`} size={"sm"} />
            <Avatar name={`extra small ${name}`} url={`/${file}`} size={"xs"} />
        </Container>
    {/each}
</Container>
