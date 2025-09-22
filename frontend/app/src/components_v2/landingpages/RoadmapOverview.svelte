<script lang="ts">
    import Section from "./Section.svelte";
    import Link from "./Link.svelte";
    import ArrowLink from "../ArrowLink.svelte";
    import page from "page";
</script>

<Section id={"roadmap"}>
    <div class="roadmap" on:click={() => page("/roadmap")}>
        <div class="header">
            <h2 class="title">Roadmap</h2>
            <div class="features">
                <ArrowLink url={"/roadmap"} color={"#23A2EE"}>View Entire Roadmap</ArrowLink>
            </div>
        </div>
        <div class="grid">
            <div class="item">
                <div class="status">
                    <span class="complete">Complete</span>
                </div>
                <div class="title">Standard chat features</div>
                <div class="detail">
                    All of the features you expect from a chat app: direct chats, public and private
                    groups, communities and channels; attach files, images, gifs, emojis; translate,
                    pin, edit and delete messages; voice and video calls; notifications; inline and
                    threaded replies; create polls; customise appearance; use on desktop or mobile - <Link
                        path="features">and much more!</Link>
                </div>
            </div>

            <div class="item">
                <div class="status">
                    <span class="complete">Complete</span>
                </div>
                <div class="title">Crypto native features</div>
                <div class="detail">
                    Send crypto tokens as chat messages (more tokens supported all the time); swap
                    tokens by exchange or p2p; send and claim prize messages; tip messages; gate
                    chats by token balance, token payment, staked tokens and more
                </div>
            </div>

            <div class="item">
                <div class="status">
                    <span class="complete">Complete</span>
                </div>
                <div class="title">SNS launch</div>
                <div class="detail">
                    Launching of a Service Nervous System and handing over control of OpenChat to
                    the control of that SNS. With this complete the system is now democratically
                    controlled by the holders of the CHAT utility token.
                </div>
            </div>

            <div class="item">
                <div class="status">
                    <span class="complete">Continuous</span>
                </div>
                <div class="title">User rewards</div>
                <div class="detail">
                    The SNS launch unlocks the potential to reward users with CHAT tokens to shape
                    the character of the system, to help build great communities and to supercharge
                    adoption.
                </div>
            </div>

            <div class="item">
                <div class="status">
                    <div class="complete">Continuous</div>
                </div>
                <div class="title">The future</div>
                <div class="detail">
                    We see great potential and have many ideas for the future, but what makes
                    OpenChat unique is that the community will decide the directions we take and the
                    priorities we pursue. We are excited to see what you come up with!
                </div>
            </div>
        </div>

        <ArrowLink url={"/roadmap"} color={"#23A2EE"}>View Entire Roadmap</ArrowLink>
    </div>
</Section>

<style lang="scss">
    :global(.roadmap a.link) {
        z-index: 1;
    }

    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: $sp5;

        .title {
            @include font(bold, normal, fs-220);
            @include mobile() {
                @include font(bold, normal, fs-200);
            }
        }
    }

    .grid {
        display: grid;
        grid-template-columns: 1fr;
        margin-bottom: toRem(60);
        align-items: flex-start;

        .item {
            border-top: solid 1px var(--landing-roadmap-bd);
            padding: toRem(48) 0;
            justify-content: flex-start;
            gap: $sp3;
            display: grid;
            grid-template-columns: 1fr 2fr 2fr;
            grid-template-areas: "status title detail";

            @include mobile() {
                grid-template-columns: 1fr 2fr;
                grid-template-areas:
                    "status title title"
                    "detail detail detail";
            }
        }

        .item:last-child {
            border-bottom: solid 1px var(--landing-roadmap-bd);
        }

        .status {
            grid-area: status;
            display: flex;
            gap: $sp3;
            align-items: flex-start;
            justify-content: flex-start;
            flex: 2;
        }

        .title {
            grid-area: title;
            @include font(bold, normal, fs-230, 57);
            flex: 4;

            @include mobile() {
                @include font(bold, normal, fs-160, 38);
                margin-bottom: toRem(20);
            }
        }

        .when {
            @include font(bold, normal, fs-160, 32);
            color: #23a2ee;
        }

        .detail {
            grid-area: detail;
            flex: 4;
        }

        .detail,
        .year {
            color: var(--landing-txt-light);
        }

        .complete {
            color: #23a2ee;
            @include font(bold, normal, fs-100, 28);
        }
    }
</style>
