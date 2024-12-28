<script lang="ts">
    import { content } from "./content";
    import ContentSection from "./ContentSection.svelte";
    import TocSection from "./TocSection.svelte";
</script>

<div class="docs">
    <section class="toc">
        <TocSection section={content}></TocSection>
    </section>

    <section class="contents">
        <ContentSection section={content}></ContentSection>
    </section>

    <section class="contents">
        <h2>Overview</h2>

        <p>
            We are excited to launch phase one of our OpenChat bot api. Bots will greatly accelerate
            the extension and integration of OpenChat and we can't wait to see what you create.
        </p>

        <h3>How does it work?</h3>

        <p>
            In phase one, you can think of a bot as a piece of server software that will receive a
            command from a user (and optionally receive some parameters) via the OpenChat front end.
            The bot will then have the opportunity to carry out whatever actions it wants before
            responding to the OpenChat frontend. It may also wish to interact with OpenChat's bot
            api to perform actions within OpenChat e.g. send a message to a chat etc.
        </p>

        <p>
            As an example, suppose we have a token price bot. The user may issue a command such as <code
                >/price icp</code
            >. The relevant bot will receive the command, look up the current price via some third
            party service, then use the OpenChat bot api to post a message to the relevant chat with
            the requested token price.
        </p>

        <p>
            A bot can be implemented either as an off-chain server using the technology of your
            choice <em>or</em> as an Internet Computer canister, whichever best suits the characteristics
            of your particular bot.
        </p>

        <h3>Getting started</h3>

        <p>
            When you have decided what functionality you want your bot to provide, you then need to
            decide what technology you want to use for your bot.
        </p>

        <p>
            There are pros and cons to using a canister for your bot that you will want to weigh up.
            The interface that a bot must conform to is the same in either case and is described in
            the form of a <code>json.schema</code> document.
        </p>

        <h4>The bot interface</h4>

        <p>
            As mentioned, a bot must conform to a particular definition schema (which you can find <a
                href="./bot_schema.json">here</a
            >). Having this standard schema allows OpenChat to interact with your bot without
            knowing anything about its specific implementation.
        </p>
    </section>
</div>

<style lang="scss">
    .docs {
        text-align: left;
        @include lp-content-padding();
        margin-top: toRem(80);
        display: flex;
        gap: $sp5;

        .toc {
            flex: 0 0 200px;
        }

        .contents {
            flex: auto;
        }

        h2,
        h3,
        h4 {
            margin-bottom: $sp3;
        }

        p {
            margin-bottom: $sp4;
        }

        @include mobile() {
            margin-top: 0;
        }
    }
</style>
