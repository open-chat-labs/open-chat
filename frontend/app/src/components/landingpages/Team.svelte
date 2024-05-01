<script lang="ts">
    import Section from "./Section.svelte";
    import TeamCard from "./TeamCard.svelte";
</script>

<Section id={"team"}>
    <h2>The Team</h2>

    <div class="team">
        <TeamCard
            imageUrl={"/assets/team/matt2.png"}
            hoverImageUrl={"/assets/team/matt.jpeg"}
            name={"Matt"}
            blurb={`Matthew is a Software Engineer with 25 years experience across a wide range of domains generally involving web technologies. Recently he has focused on building microservice backends supporting a multi-tenant platform for running online travel agencies. Matt values reliable and maintainable software. He holds a Masters Degree in Engineering and Computer Science from the University of Oxford.`} />
        <TeamCard
            imageUrl={"/assets/team/hamish2.png"}
            hoverImageUrl={"/assets/team/hamish.jpeg"}
            name={"Hamish"}
            blurb={`After graduating with a degree in mathematics from Cambridge University, Hamish transitioned into the world of software engineering where he focused primarily on high throughput, low latency cloud based systems. Before building OpenChat, he worked at Emirates where he quickly rose through the ranks, eventually leading the design of their new B2B hotel search engine.`} />
        <TeamCard
            imageUrl={"/assets/team/julian2.png"}
            hoverImageUrl={"/assets/team/julian.jpg"}
            name={"Julian"}
            blurb={`Julian has been dabbling in software engineering for the last 25 years or so. He has a varied industry background from defence to risk management, from e-commerce to education technology and from travel to chat. He has developed a penchant for functional front ends. He holds a masters degree in Politics, Philosophy & Economics from the University of Oxford and likes things to be just so.`} />
        <TeamCard
            imageUrl={"/assets/team/steffen2.png"}
            hoverImageUrl={"/assets/team/steffen.jpeg"}
            name={"Steffen"}
            blurb={`With extensive expertise spanning founder coaching, life coaching, management consulting, innovation management, and startup marketing, Steffen brings a wealth of knowledge to the table. As a seasoned professional, he excels in guiding entrepreneurs, fostering personal growth, and providing strategic insights for effective management.`} />
    </div>
</Section>

<style lang="scss">
    h2 {
        margin-bottom: $sp6;
    }

    .team {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: toRem(50);

        @include mobile() {
            grid-template-columns: 1fr;
        }
    }
    h2 {
        @include font(bold, normal, fs-220);
        @include mobile() {
            @include font(bold, normal, fs-200);
        }
    }
</style>
