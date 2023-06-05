<script lang="ts">
    import Dao from "./icons/Dao.svelte";
    import OnChain from "./icons/OnChain.svelte";
    import OpenSource from "./icons/OpenSource.svelte";
    import Reliable from "./icons/Reliable.svelte";
    import Scalable from "./icons/Scalable.svelte";
    import Secure from "./icons/Secure.svelte";
    import Section from "./Section.svelte";
</script>

<Section id={"usp"}>
    <div class="selling-points">
        <div class="on-chain item">
            <OnChain />
            <div class="title">100% On Chain</div>
            <div class="txt">
                All of your data is stored 100% on chain in your own canister. Each group chat also
                has its own canister.
            </div>
        </div>
        <div class="dao item">
            <Dao />
            <div class="title">DAO Controlled</div>
            <div class="txt">
                The product roadmap can <em>only</em> be decided, approved and enacted by the community.
                For us, by us.
            </div>
        </div>
        <div class="open-source item">
            <OpenSource />
            <div class="title">Open Source</div>
            <div class="txt">
                All of the source code is available to inspect. We use repeatable, verifiable builds
                so you can confirm that what <em>you</em> approved is what's actually running.
            </div>
        </div>
        <div class="scalable item">
            <Scalable />
            <div class="title">Scalable</div>
            <div class="txt">
                Our canister architecture combined with the power of the Internet Computer allow us
                to scale indefinitely.
            </div>
        </div>
        <div class="secure item">
            <Secure />
            <div class="title">Secure</div>
            <div class="txt">
                Relax in the knowledge that your messages are secured using advanced blockchain
                cryptography thanks to the Internet Computer protocol.
            </div>
        </div>
        <div class="reliable item">
            <Reliable />
            <div class="title">Reliable</div>
            <div class="txt">
                With each canister replicated by the Internet Computer you never have to worry about
                losing your data.
            </div>
        </div>
    </div>
</Section>

<style lang="scss">
    :global(.selling-points .icon) {
        width: toRem(40);
        height: toRem(40);
        margin-bottom: toRem(24);
    }

    .selling-points {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: $sp4;
        margin-bottom: $sp5;

        @include mobile() {
            grid-template-columns: 1fr;
        }
    }

    .item {
        padding: toRem(40) toRem(32) toRem(32) toRem(32);
        min-height: toRem(310);
        // border-radius: toRem(4);
        transition: transform ease-in-out 200ms;
        text-align: left;
        color: #242834;

        &.on-chain {
            background-color: #ff005c;
            color: #ffffff;
        }

        &.dao {
            background-color: #fec000;
        }

        &.open-source {
            background-color: #08aedb;
        }

        &.scalable {
            background-color: #673bb7;
            color: #ffffff;
        }

        &.secure {
            background-color: #05b09f;
        }

        &.reliable {
            background-color: #ff8541;
        }

        .title {
            @include font(bold, normal, fs-160);
            margin-bottom: toRem(24);
        }
    }
</style>
