<script lang="ts">
    import CollapsibleCard from "../CollapsibleCard.svelte";
    import Headline from "./Headline.svelte";
    import Link from "./Link.svelte";
</script>

<div class="roadmap">
    <Headline>OpenChat Roadmap</Headline>

    <CollapsibleCard transition={false} first open={false}>
        <div class="header" slot="titleSlot">
            <div class="date subtitle">
                <div class="quarter">Q1</div>
                <div class="year">2023</div>
            </div>
            <div class="title">SNS Launch</div>
        </div>
        <div class="body">
            <p>
                When the OpenChat SNS is created control of OpenChat will be handed from the core
                dev team to the SNS. A <em>decentralization sale</em> will be initiated by NNS proposal
                which will decentralize the governance of OpenChat by distributing the CHAT utility token
                to the wider community. It will also raise an endowment to fund the ongoing development
                and growth of OpenChat.
            </p>
            <p>
                This is a crucial step in the decentralisation journey. With this in place the
                system will not be under any centralised control. We, the developement team, will be
                here to provide direction and to implement the roadmap but we will only be able to
                make changes to the system via an approved SNS proposal voted upon by those who have
                demonstrated their commitment to the long term future of OpenChat by staking their
                CHAT tokens.
            </p>
            <p>
                Those users will be invested in the future of the system through the voting rewards
                they receive. This way, we enlist an army of powerful advocates and we can be
                confident that the proposals the community approves will be in the long term
                interest of OpenChat as a whole.
            </p>
        </div>
    </CollapsibleCard>

    <CollapsibleCard transition={false} open={false}>
        <div class="header" slot="titleSlot">
            <div class="date subtitle">
                <div class="quarter">Q1</div>
                <div class="year">2023</div>
            </div>
            <div class="title">User Rewards</div>
        </div>
        <div class="body">
            <p>
                The SNS launch will unlock the potential to reward users with CHAT tokens. This will
                allow community leaders to shape the character of the system, to help build <em
                    >great</em> communities and to supercharge adoption.
            </p>
            <p>
                It will become really important to empower community leaders to build, promote and
                maintain their communities through tokenisation. User rewards can facilitate the
                building of powerful community based moderation systems; adoption can be driven by
                rewarding users for creating great content and sharing it with friends and family.
            </p>
            <p>
                Rewards can and will be used in all sorts of creative ways only made possible by the
                unique way that OpenChat is governed.
            </p>
        </div>
    </CollapsibleCard>

    <CollapsibleCard transition={false} open={false}>
        <div class="header" slot="titleSlot">
            <div class="date subtitle">
                <div class="quarter">Q2</div>
                <div class="year">2023</div>
            </div>
            <div class="title">Communities</div>
        </div>
        <div class="body">
            <p>
                By building the capability to integrate with 3rd party dApps, each with their own
                community, we also unlock the potential to introduce the concept of <em
                    >communities</em>
                to the OpenChat dApp itself. Currently OpenChat is open to all. Any user or public group
                can be found by simply searching. For many scenarios this is perfectly fine.
            </p>
            <p>
                However, sometimes it would be nice to collect a number of groups together where
                they have something in common. That commonality or <em>community</em> could be
                anything: perhaps they all use the same language, or they all relate to a particular
                area of interest, or they all relate to a particular <em>project</em>. In this
                sense, communities are a bit like Discord servers.
            </p>
            <p>
                Furthermore, a community may wish to restict and control its membership creating <em
                    >private</em>
                communities. We see this as an important step for the future monetization of OpenChat
                as it enables us to easily support its use as an internal communication tool
                <em>within a corporate setting.</em> In that sense, communities can also be thought of
                like Slack workspaces.
            </p>
            <p>
                <Link path="blog/communities">Read more</Link>
            </p>
        </div>
    </CollapsibleCard>

    <CollapsibleCard transition={false} open={false}>
        <div class="header" slot="titleSlot">
            <div class="date subtitle">
                <div class="quarter">Q3</div>
                <div class="year">2023</div>
            </div>
            <div class="title">Integrations</div>
        </div>
        <div class="body">
            <p>
                We are keen to provide chat functionality as a service to other dApps in the
                Internet Computer ecosystem.
            </p>
            <p>
                We are currently consulting with many builders in the community to find out how they
                would like to integrate OpenChat functionality in the future. The appetite is
                certainly there! We will likely start with simple direct chat functionality before
                later offering groups and other more advanced features.
            </p>
            <p>
                The OpenChat team will build the apis, libraries and UI components required to make
                chat integration as seamless as possible.
            </p>
        </div>
    </CollapsibleCard>

    <CollapsibleCard transition={false} open={false}>
        <div class="header" slot="titleSlot">
            <div class="date subtitle future">Future</div>
            <div class="title">Voice & Video</div>
        </div>
        <div class="body">
            <p>
                Many (web2) apps in this space offer voice and video calling and we aim to do the
                same. There are certainly challenges in doing this in a way that is both reliable
                and meaningfully decentralized. This is why this function is so often delegated to a
                centralised web2 partner. It is likely to require an incremental approach and a fair
                amount of R&D.
            </p>
        </div>
    </CollapsibleCard>

    <CollapsibleCard transition={false} open={false}>
        <div class="header" slot="titleSlot">
            <div class="date subtitle future">Future</div>
            <div class="title">Native Apps</div>
        </div>
        <div class="body">
            <p>
                Currently OpenChat is delivered as a responsive progressive web app. This means that
                it performs well on <em>any</em> device via the platform's browser. It can also be saved
                or "installed" to your device's home screen for an even more app-like experience. There
                are great advantages to this approach. We can deliver for all platforms using a single
                codebase which allows us to deliver features faster and without preference to any one
                particular platform.
            </p>
            <p>
                However, the native web apis available to us are a work in progress and not all
                platforms develop at the same speed. For example, we are currently unable to provide
                push notifications to users of iOS. Some people also simply prefer to get their apps
                in the chosen app store.
            </p>
            <p>
                In the medium term, the team will explore options to preserve the single codebase
                benefits and combine it with a platform specific native app shell which will provide
                full access to the native platform apis that we need.
            </p>
            <p>
                In the longer term, it may be possible to develop fully native mobile apps for each
                platform.
            </p>
        </div>
    </CollapsibleCard>

    <CollapsibleCard transition={false} open={false}>
        <div class="header" slot="titleSlot">
            <div class="date subtitle future">Future</div>
            <div class="title">End to end encryption</div>
        </div>
        <div class="body">
            <p>
                Currently, while the Internet Computer does provide very strong security guarantees,
                there is still a hypothetical risk that a rogue node provider could gain access to
                ingress messages and node memory.
            </p>
            <p>
                As such we will develop opt-in end-to-end encryption which will of course come with
                some restrictions such as not being able to search your message history.
            </p>
        </div>
    </CollapsibleCard>

    <CollapsibleCard transition={false} open={false}>
        <div class="header" slot="titleSlot">
            <div class="date subtitle future">Future</div>
            <div class="title">Other Features</div>
        </div>
        <div class="body">
            <p>
                As we will be governed by the SNS, we will be obliged to listen to our users along
                the way as we develop the larger features described above and so our roadmap will
                always be fluid.
            </p>
            <p>
                We will continuously dedicate ourselves to performance and usability and there are
                many other smaller features that we would like to work on.
            </p>
            <p>Some smaller feature ideas:</p>
            <ul class="list blurb">
                <li>Send additional tokens as messages, such as ckBTC, ckETH, etc</li>
                <li>Tag groups and search/filter by tag</li>
                <li>Optionally sync with phone contacts and invite contacts</li>
                <li>Link previews</li>
                <li>Profile badges for reputation and achievements</li>
                <li>Tag messages (eg star) and search/filter by tag</li>
                <li>Verified NFT avatars</li>
                <li>NFT gated groups and communities</li>
                <li>Disappearing messages</li>
                <li>Organise events with calendar</li>
                <li>Custom emojis, stickers</li>
                <li>
                    Broadcast groups
                    <ul>
                        <li>stream video 1-many</li>
                        <li>broadcast group roles (owner, admin, participant, viewer)</li>
                        <li>viewers can tip using cycles</li>
                    </ul>
                </li>
            </ul>
        </div>
    </CollapsibleCard>
</div>

<style type="text/scss">
    .roadmap {
        text-align: left;
        @include lp-content-padding();
        margin-top: toRem(80);

        @include mobile() {
            margin-top: 0;
        }
    }

    .list {
        @include bullet_list();
    }

    .body {
        padding: 0 0 toRem(30) toRem(160);
        max-width: 75%;

        @include mobile() {
            padding: 0 0 toRem(24) 0;
            max-width: 100%;
        }
    }

    .body p,
    .body li {
        @include font(book, normal, fs-100, 28);
    }

    .body p {
        margin-bottom: toRem(24);
    }

    .header {
        display: flex;
        align-items: center;
        flex: auto;
        color: var(--landing-txt);
        @include font(medium, normal, fs-160, 38);

        @include mobile() {
            @include font(medium, normal, fs-110, 24);
        }
    }

    .subtitle {
        flex: 0 0 toRem(160);

        @include mobile() {
            flex: 0 0 toRem(80);
        }
    }

    .title {
        flex: auto;
    }

    .date {
        display: flex;
        align-items: flex-start;
        gap: toRem(15);
        @include font(bold, normal, fs-160, 38);

        .quarter {
            color: #23a2ee;
        }

        .year {
            @include font(book, normal, fs-100, 28);
            color: var(--landing-txt-light);
        }

        &.future {
            @include font(book, normal, fs-100, 38);
            font-weight: 500;
        }

        @include mobile() {
            gap: toRem(8);
            @include font(medium, normal, fs-110, 24);

            .year {
                @include font(book, normal, fs-80, 28);
            }
        }
    }
</style>
