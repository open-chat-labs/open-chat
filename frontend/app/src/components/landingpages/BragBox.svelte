<script lang="ts">
    import { onMount } from "svelte";
    import Brag from "./Brag.svelte";
    import Section from "./Section.svelte";
    import { themeStore } from "../../theme/themes";

    let isFirefox = navigator.userAgent.indexOf("Firefox") >= 0;
    $: bgPath = $themeStore.mode === "light" ? "../assets/brag_light" : "../assets/brag_dark";
    $: bgUrl = isFirefox ? `${bgPath}.png` : `${bgPath}.svg`;

    const brags = [
        {
            avatar: "https://i5gel-qaaaa-aaaaf-alxma-cai.raw.ic0.app/avatar/136778887567610871828541274245283446784",
            username: "Rommyjah",
            date: new Date(2022, 9, 31),
            title: "I have been using openchat for a while now. I enjoy the nice features, interface and the rest.. Thanks to the team behind this . They have done a great job so far.",
        },
        {
            avatar: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc2NCcgaGVpZ2h0PSc2NCcgc3R5bGU9J2JhY2tncm91bmQtY29sb3I6cmdiYSgyNDAsMjQwLDI0MCwxKTsnPjxnIHN0eWxlPSdmaWxsOnJnYmEoMjE3LDM4LDExMiwxKTsgc3Ryb2tlOnJnYmEoMjE3LDM4LDExMiwxKTsgc3Ryb2tlLXdpZHRoOjAuMzI7Jz48cmVjdCAgeD0nMjYnIHk9JzInIHdpZHRoPScxMicgaGVpZ2h0PScxMicvPjxyZWN0ICB4PScyNicgeT0nMjYnIHdpZHRoPScxMicgaGVpZ2h0PScxMicvPjxyZWN0ICB4PScxNCcgeT0nMicgd2lkdGg9JzEyJyBoZWlnaHQ9JzEyJy8+PHJlY3QgIHg9JzM4JyB5PScyJyB3aWR0aD0nMTInIGhlaWdodD0nMTInLz48cmVjdCAgeD0nMicgeT0nMTQnIHdpZHRoPScxMicgaGVpZ2h0PScxMicvPjxyZWN0ICB4PSc1MCcgeT0nMTQnIHdpZHRoPScxMicgaGVpZ2h0PScxMicvPjxyZWN0ICB4PScyJyB5PScyNicgd2lkdGg9JzEyJyBoZWlnaHQ9JzEyJy8+PHJlY3QgIHg9JzUwJyB5PScyNicgd2lkdGg9JzEyJyBoZWlnaHQ9JzEyJy8+PHJlY3QgIHg9JzInIHk9JzM4JyB3aWR0aD0nMTInIGhlaWdodD0nMTInLz48cmVjdCAgeD0nNTAnIHk9JzM4JyB3aWR0aD0nMTInIGhlaWdodD0nMTInLz48L2c+PC9zdmc+",
            username: "Ndollo",
            date: new Date(2022, 9, 30),
            title: "This is awesome. I don't know about facebook but i think this will be sweeter and more interesting. A great platform, a great social gathering and I am liking it.",
        },
        {
            avatar: "https://p3erf-qiaaa-aaaaf-af22q-cai.raw.ic0.app/avatar/240900553903060277843838192458303275008",
            username: "Apostle",
            date: new Date(2022, 9, 18),
            title: "The team has been an inspiration in their innovative approaches towards achieving the project goals and visions, I am so glad to be part of this.",
        },
        {
            avatar: "https://ze4en-tqaaa-aaaaf-aru4q-cai.raw.ic0.app/avatar/188901360218020175838673890525187145728",
            username: "HiroProtagonist",
            date: new Date(2022, 9, 15),
            title: "OpenChat is the only way to breathe freely in our camp 🤍❤🤍 to hell with Whatsapp to hell with telegram ✌",
        },
        {
            avatar: "https://kdiwm-3yaaa-aaaaf-aplqa-cai.raw.ic0.app/avatar/111378888760193105951556237691472314368",
            username: "Alvarendra",
            date: new Date(2022, 7, 30),
            title: "It's a great pleasure to be part of this wonderful opportunity, I trust this is a solid project, so guys you can't afford to miss out. 🥳",
        },
    ];

    let counter = 0;
    $: index = counter % brags.length;

    onMount(() => {
        setInterval(() => {
            counter = counter + 1;
        }, 6000);
    });
</script>

<Section id={"brag-box"}>
    <div class="bragbox" style={`background-image: url(${bgUrl})`}>
        <div class="brags">
            {#each brags as brag, i}
                <Brag
                    visible={i === index}
                    avatar={brag.avatar}
                    username={brag.username}
                    date={brag.date.getTime()}
                    title={brag.title} />
            {/each}
        </div>
    </div>
</Section>

<style lang="scss">
    .bragbox {
        background-repeat: no-repeat;
        background-position: center;
        background-size: cover;

        padding: toRem(800) toRem(600);
        margin: toRem(-640) toRem(-440);

        @include mobile() {
            padding: toRem(340) toRem(324);
            margin: toRem(-260) toRem(-276);
        }
    }
    .brags {
        position: relative;
        overflow: hidden;
        height: 324px;
        display: flex;
        justify-content: center;
        align-items: center;
    }
</style>
