<script lang="ts">
    import Headline from "./Headline.svelte";
    import Copy from "svelte-material-icons/ContentCopy.svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import CollapsibleCard from "../CollapsibleCard.svelte";
    import HashLinkTarget from "./HashLinkTarget.svelte";
    import { copyToClipboard, scrollToSection } from "../../utils/urls";
    import ZoomableImage from "./ZoomableImage.svelte";
    import ExternalLink from "./ExternalLink.svelte";
    import HashLink from "./HashLink.svelte";
    import ArrowLink from "../ArrowLink.svelte";
    import Overlay from "../Overlay.svelte";
    import ModalContent from "../ModalContent.svelte";
    import { location, querystring } from "svelte-spa-router";

    let linked: number | undefined = undefined;
    let zooming: { url: string; alt: string } | undefined = undefined;

    $: copySize = $mobileWidth ? "14px" : "16px";

    function zoomImage(ev: CustomEvent<{ url: string; alt: string }>) {
        zooming = ev.detail;
    }

    function onCopyUrl(ev: CustomEvent<string>): void {
        copyUrl(ev.detail);
    }

    function copyUrl(section: string): void {
        copyToClipboard(`${window.location.origin}/#${$location}?section=${section}`);
    }

    $: {
        if ($querystring !== undefined) {
            const qs = new URLSearchParams($querystring);
            const section = qs.get("section");
            if (section) {
                linked = scrollToSection(section);
            }
        }
    }
</script>

{#if zooming}
    <Overlay on:close={() => (zooming = undefined)} dismissible={true} alignBottomOnMobile={false}>
        <ModalContent hideHeader hideFooter fill fitToContent fixedWidth>
            <img slot="body" class="zoomed" src={zooming.url} alt={zooming.alt} />
        </ModalContent>
    </Overlay>
{/if}

<div class="architecture">
    <Headline>Architecture</Headline>

    <CollapsibleCard first open={linked === 1}>
        <div class="header" slot="titleSlot">
            <span class="subtitle">1</span>
            <div class="title">
                System overview
                <div class="copy" on:click|stopPropagation={() => copyUrl("1")}>
                    <Copy size={copySize} color={"var(--landing-txt)"} />
                </div>
            </div>
        </div>
        <div class="body">
            <p>
                OpenChat is a system composed of canister smart contracts running on the Internet
                Computer which provides chat functionality. The canisters provide an API and serve
                the assets for the OpenChat web app, and going forwards, will allow 3rd-party
                services to integrate chat. The following diagram shows the OpenChat system in
                yellow with its various external dependencies. The orange boxes are services running
                on the Internet Computer and the blue boxes are off-chain.
            </p>

            <ZoomableImage
                on:zoom={zoomImage}
                url={"../assets/architecture/simple.svg"}
                alt="High level architecture" />
        </div>
    </CollapsibleCard>

    <CollapsibleCard open={linked === 2}>
        <div class="header" slot="titleSlot">
            <span class="subtitle">2</span>
            <div class="title">
                System components in depth
                <div class="copy" on:click|stopPropagation={() => copyUrl("2")}>
                    <Copy size={copySize} color={"var(--landing-txt)"} />
                </div>
            </div>
        </div>
        <div class="body">
            <p>
                This diagram shows the OpenChat system enclosed in the box with the dashed orange
                border, decomposed into the various deployable units. The solid links represent
                Internet Computer updates which go through blockchain consensus. The green boxes are
                all canisters and the light gray boxes are services hosted on AWS.
            </p>

            <ZoomableImage
                on:zoom={zoomImage}
                url={"../assets/architecture/complex.svg"}
                alt="Complete architecture" />

            <HashLinkTarget on:copyUrl={onCopyUrl} id="2-1">Canister components</HashLinkTarget>

            <HashLinkTarget on:copyUrl={onCopyUrl} id="2-1-1">User canister</HashLinkTarget>

            <p>
                A key decision was made to give each user their own canister. This holds the user’s
                direct chats including the messages of both parties, references to each group the
                user is a member of, and other data such as their authentication principal,
                username, bio, avatar and blocked users. The user’s canister becomes a wallet for
                holding tokens in IC ledgers which allows tokens to be sent between users as chat
                messages. The user can also add their canister as a hotkey to their neurons which
                allows them to easily vote on proposals within the NNS and SNS proposal groups on
                OpenChat.
            </p>

            <p>
                There are pros and cons to this architecture but it will best support the long term
                scalability of the system.
            </p>

            <HashLinkTarget on:copyUrl={onCopyUrl} id="2-1-2">User index canister</HashLinkTarget>

            <p>
                The user index canister essentially holds the global registry of OpenChat users.
                Each user record includes the principal, user id, username, avatar id,
                created/updated/last online, account charges, phone verification status, storage
                limit, user referred by, wasm version, and several other fields. It is responsible
                for creating, upgrading, topping up, and keeping track of user canisters. It can
                verify users (using a code sent over SMS) and take payment for premium services such
                as more storage or groups. It calls into <HashLink id="2-1-5">OpenStorage</HashLink>
                to manage users’ file storage quotas.
            </p>

            <p>
                Ultimately it might be necessary to shard the user index across multiple canisters
                but 32 GB of stable memory will give enough capacity for a long time yet and we can
                cross that bridge later.
            </p>

            <HashLinkTarget on:copyUrl={onCopyUrl} id="2-1-3">Group canister</HashLinkTarget>

            <p>
                As for users, each group has its own canister. This stores and manages the group
                members and their roles, all the messages and other events that have occurred in the
                group, and other details of the group such as name, description, rules, avatar,
                permissions, pinned messages etc. Any message file attachments such as images and
                videos are stored using the OpenStorage service rather than in the group canister
                itself. We anticipate that with 32 GB of stable storage available to a single
                canister and since the messages in group canisters only have text, no groups will
                outgrow their canister. The same goes for user canisters.
            </p>

            <HashLinkTarget on:copyUrl={onCopyUrl} id="2-1-4">Group index canister</HashLinkTarget>

            <p>
                The group index canister essentially holds the global registry of OpenChat groups.
                Each group record includes the group id (canister id), active until timestamp, wasm
                version, and several other fields. In addition, public group records include the
                name, description, avatar id, and various other fields. It is responsible for
                creating, upgrading, topping up, and keeping track of user canisters. It also
                provides a searchable index of public groups and maintains a list of hot groups.
            </p>

            <!-- TODO possibly openstorage is 2-2 rather than 2-1-5 -->
            <HashLinkTarget on:copyUrl={onCopyUrl} id="2-1-5">OpenStorage</HashLinkTarget>

            <p>
                <ExternalLink href="https://github.com/open-ic/open-storage"
                    >OpenStorage</ExternalLink
                >is a scalable file storage system built by the OpenChat team which is available to
                be used by other projects. It consists of an index canister and dynamically created
                bucket canisters which hold the file data. Once a bucket is full it becomes
                read-only and a new bucket is created. OpenStorage implements <ExternalLink
                    href="https://en.wikipedia.org/wiki/Content-addressable_storage"
                    >content addressing</ExternalLink> so that for duplicate files the data is only stored
                once. This makes the forwarding of file messages on OpenChat cheap and quick. Files in
                OpenStorage are owned by users, in the case of OpenChat the sender of a file message
                is the file owner. Internally a file holds a reference to the underlying blob. It uses
                reference counting so that if all the files for a given blob are deleted then the blob
                is deleted.
            </p>

            <p>
                Each user is given a byte allowance which they can’t exceed. The first file
                reference a user has to a blob comes out of the user’s allowance but any further
                file references the user has to the same blob do not. This allows a user to upload
                or forward the same file multiple times without additional cost.
            </p>

            <HashLinkTarget on:copyUrl={onCopyUrl} id="2-1-6">Notifications</HashLinkTarget>

            <p>
                The notifications canister holds a queue of notifications sent from user or group
                canisters to be sent on to registered users using <ExternalLink
                    href="https://web.dev/push-notifications-overview/"
                    >web push notifications</ExternalLink
                >. It also holds a set of web push subscriptions for each user.
            </p>

            <HashLinkTarget on:copyUrl={onCopyUrl} id="2-1-6">Proposals bot</HashLinkTarget>

            <p>
                The proposals bot canister syncs proposals from the NNS and each registered SNS with
                the equivalent proposals group in OpenChat.
            </p>

            <HashLinkTarget on:copyUrl={onCopyUrl} id="2-1-7"
                >Online users aggregator</HashLinkTarget>

            <p>
                The online users aggregator canister has one simple responsibility. Every 61
                seconds, while the user is signed-in, the app calls mark_as_online on this canister
                which adds it to a set of online user principals. In the background, on every
                heartbeat, if this set is not empty the online users aggregator will call
                c2c_mark_users_online on the user index canister with all of these users before then
                emptying the set. The user index can then update the online status of its users
                which are discovered by the app using the users endpoint. This canister exists
                purely to take update load away from the user index canister.
            </p>

            <HashLinkTarget on:copyUrl={onCopyUrl} id="2-1-8">Assets canister</HashLinkTarget>

            <p>
                The assets canister (via the service worker) serves the static assets for the web
                app. The response from the assets canister includes the asset data and a threshold
                signature. The service worker uses the IC public key to verify the signature of each
                asset and prove it has not been served by a malicious node and tampered with, before
                returning the HTTP GET response. Thus any assets served by the asset canister can be
                considered on-chain and are tamperproof. The service worker itself, and the root
                html which loads it, cannot be served by the assets canister.
            </p>

            <HashLinkTarget on:copyUrl={onCopyUrl} id="2-1-9">Cycles dispenser</HashLinkTarget>

            <p>
                The cycles dispenser is a canister responsible for topping up the other canisters
                with cycles automatically when they are running low.
            </p>

            <p>
                Cycles can also be deposited into the cycles dispenser. It also has an ICP ledger
                account which it will access if its cycles balance dips below a threshold and then
                burn some into cycles. When OpenChat is controlled by its SNS, a simple ICP transfer
                proposal can be made periodically to keep the whole system topped up with cycles.
            </p>

            <HashLinkTarget on:copyUrl={onCopyUrl} id="2-1-10">Deployment / Upgrade</HashLinkTarget>

            <p>
                User and group canisters are upgraded in batches with an API call to their
                respective index canisters which can only be called by dev team member principals
                and going forward, only by the SNS.
            </p>

            <HashLinkTarget on:copyUrl={onCopyUrl} id="2-1-11">APIs</HashLinkTarget>

            <p>
                The client-facing APIs all use candid which is the standard for the Internet
                Computer. The internal canister-to-canister APIs use <ExternalLink
                    href="https://msgpack.org/index.html">MessagePack</ExternalLink> which is efficient
                and flexible allowing them to evolve easily by keeping backward compatibility.
            </p>

            <p>
                Every OpenChat canister exposes a public <ExternalLink
                    href="https://4bkt6-4aaaa-aaaaf-aaaiq-cai.raw.ic0.app/metrics"
                    >metrics endpoint</ExternalLink> which includes some common data (below) and also
                data specific to the type of canister.
            </p>

            <ul class="list">
                <li>memory used</li>
                <li>time now (in milliseconds since unix epoch)</li>
                <li>cycles balance</li>
                <li>wasm version</li>
                <li>git commit id</li>
            </ul>

            <p>
                Also every OpenChat canister exposes a public <ExternalLink
                    href="https://4bkt6-4aaaa-aaaaf-aaaiq-cai.raw.ic0.app/logs"
                    >logs endpoint</ExternalLink
                >.
            </p>

            <HashLinkTarget on:copyUrl={onCopyUrl} id="2-2">Off-chain components</HashLinkTarget>

            <HashLinkTarget on:copyUrl={onCopyUrl} id="2-2-1">SMS relay oracle</HashLinkTarget>

            <p>
                This is used as part of the phone number verification process we currently use. Once
                we start using NFID for proof of unique personhood we can remove it.
            </p>

            <HashLinkTarget on:copyUrl={onCopyUrl} id="2-2-2"
                >Notification relay oracle</HashLinkTarget>

            <p>
                This is currently required to support push notifications. Once the Internet Computer
                supports HTTP calls from a single replica, the notifications canister will be able
                to directly send notifications to web push notifications servers.
            </p>

            <HashLinkTarget on:copyUrl={onCopyUrl} id="2-2-3"
                >Landing page assets and service worker</HashLinkTarget>

            <p>
                Our landing page assets and custom service worker are currently served from an AWS
                S3 bucket. Once DFINITY have made the changes laid out in the <ExternalLink
                    href="https://forum.dfinity.org/t/boundary-node-roadmap/15562"
                    >Boundary Node Roadmap</ExternalLink>
                we will no longer need to fork the service worker and we can also move all the landing
                page assets into the assets canister. At this point we will have no need for AWS s3.
            </p>

            <HashLinkTarget on:copyUrl={onCopyUrl} id="2-3">Frontend components</HashLinkTarget>

            <ZoomableImage
                on:zoom={zoomImage}
                url={"../assets/architecture/frontend.svg"}
                alt="Frontend architecture" />

            <HashLinkTarget on:copyUrl={onCopyUrl} id="2-3-1">Landing pages</HashLinkTarget>

            <p>
                When a user navigates to <ExternalLink href="https://oc.app">oc.app</ExternalLink> for
                the first time the root html is loaded from an AWS s3 bucket. In turn this loads the
                landing page css and javascript plus the service worker javascript. Once the landing
                page javascript is loaded it installs the service worker.
            </p>

            <HashLinkTarget on:copyUrl={onCopyUrl} id="2-3-2">Service worker</HashLinkTarget>

            <p>
                Our forked service worker allows us to modify the default behaviour in two key ways.
                Firstly we can choose precisely when we route requests through to the asset
                canister. This way, if the user is signed in we will route through to the asset
                canister and thus serve the chat app, if not we will serve assets from AWS and the
                user will remain on the landing page. Secondly, we can intercept all requests and
                implement an optimum caching strategy for all resources.
            </p>

            <p>
                The service worker will still simply pass through any calls to raw canister urls. We
                request message files such as images from the OpenStorage bucket canisters over
                HTTPS on the raw domain. Because these requests are not changed by the service
                worker the responses can be cached by the browser’s standard HTTP cache.
            </p>

            <p>
                The responses for update calls contain a threshold signature which the service
                worker verifies using the Internet Computer public key.
            </p>

            <p>The service worker has also been modified to handle web push notifications.</p>

            <HashLinkTarget on:copyUrl={onCopyUrl} id="2-3-3">Chat app</HashLinkTarget>

            <p>
                The OpenChat app is written in typescript and Svelte and is composed of three
                layers.
            </p>

            <ul class="list">
                <li>
                    the UI layer built using the <ExternalLink href="https://svelte.dev/"
                        >Svelte compiler</ExternalLink>
                </li>
                <li>
                    the OpenChat client library which exposes the app’s runtime state to the UI as a
                    collection of reactive svelte stores
                </li>
                <li>
                    the OpenChat agent which is responsible for calling canisters APIs and caching
                    their responses
                </li>
            </ul>

            <HashLinkTarget on:copyUrl={onCopyUrl} id="2-3-3-1">Agent</HashLinkTarget>

            <p>
                The OpenChat agent runs in a separate thread from the UI as a web worker which helps
                keep the UI responsive. It exposes its API to the client library on top of the
                browser’s <ExternalLink
                    href="https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage"
                    >post message API</ExternalLink
                >.
            </p>

            <p>
                It calls into the OpenChat canister APIs using the <ExternalLink
                    href="https://github.com/dfinity/agent-js">Internet Computer agent</ExternalLink
                >. Internally it uses the decorator pattern to implement a caching layer using
                IndexDB.
            </p>

            <HashLinkTarget on:copyUrl={onCopyUrl} id="2-3-3-2">Client library</HashLinkTarget>

            <p>
                When the client library is loaded it registers a web worker running the OpenChat
                agent which it wraps to provide an API to the UI layer. It also polls the agent to
                keep important runtime state up to date in the form of a collection of reactive
                svelte stores.
            </p>

            <p>
                In general the readable runtime state is derived from a merging of the confirmed
                server-side state (which it reads from the agent) and pending local updates (made
                locally by the user). The pending updates are synced with the canister backend using
                API calls and eventually become confirmed.
            </p>

            <p>It maintains local user settings in the browser’s local storage.</p>

            <HashLinkTarget on:copyUrl={onCopyUrl} id="2-3-3-3">User interface</HashLinkTarget>

            <p>
                The UI is composed of svelte components which call into APIs and react to svelte
                stores exposed by the client library and UI specific svelte stores. This layer also
                deals with the application routing, the global styling and theming, and
                multi-language text resources.
            </p>

            <HashLinkTarget on:copyUrl={onCopyUrl} id="2-3-3-4">WebRTC</HashLinkTarget>

            <p>
                The client library uses <ExternalLink href="https://en.wikipedia.org/wiki/WebRTC"
                    >WebRTC</ExternalLink> to instantaneously send messages and typing notifications
                to online users directly between browsers. We always send messages via the Internet Computer
                but will also send them over WebRTC sockets where possible. WebRTC is a securely encrypted
                peer-2-peer protocol and so is a good fit for a decentralized chat application. However
                there are a couple of off-chain components involved.
            </p>

            <p>
                Currently we use third party STUN and signalling infrastructure to support WebRTC
                (and will probably incorporate TURN servers for improved reliability in the future).
            </p>

            <p>We hope that these features will become supported on the IC itself in the future.</p>
        </div>
    </CollapsibleCard>

    <CollapsibleCard open={linked === 3}>
        <div class="header" slot="titleSlot">
            <span class="subtitle">3</span>
            <div class="title">
                Verification of canister code
                <div class="copy" on:click|stopPropagation={() => copyUrl("3")}>
                    <Copy size={copySize} color={"var(--landing-txt)"} />
                </div>
            </div>
        </div>
        <div class="body">
            <p>
                The <ExternalLink href={"https://github.com/open-ic/open-chat"}
                    >OpenChat source code</ExternalLink> is built into the WASMs used by each type of
                OpenChat canister in a repeatable way using docker. Anyone who pulls the OpenChat source
                code and uses the docker build will produce identical WASM files.
            </p>

            <p>
                Each canister exposes a metrics endpoint which is publicly accessible over the raw
                domain. In each case these metrics include the git commit id which identifies the
                specific source code revision used to build the WASM currently running on that
                canister. For example here is the url of the metrics endpoint for the user index
                canister: https://4bkt6-4aaaa-aaaaf-aaaiq-cai.raw.ic0.app/metrics.
            </p>

            <p>
                You can use dfx to interrogate the sha256 hash of the WASM module for any given
                canister id using the following command:
            </p>

            <code class="code">dfx canister --network ic info 4bkt6-4aaaa-aaaaf-aaaiq-cai </code>

            <p>
                By building the WASM module for a canister at the given git commit, calculating its
                sha256 hash, and comparing with the module hash returned by the IC using dfx, the
                source code running on any canister can be verified.
            </p>
            <ul class="list">
                <li>
                    the canister ids of the top-level OpenChat canisters can be found in the
                    canister_ids.json file in the root of the OpenChat repo
                </li>
                <li>
                    the canister id of any group canister can be found in the url for that group in
                    the OpenChat app
                </li>
                <li>
                    likewise the canister id of any user canister can be found in the url of a
                    direct chat with that user
                </li>
                <li>
                    your own canister id can be found from the main menu in the advanced section of
                    your profile
                </li>
            </ul>
        </div>
    </CollapsibleCard>

    <CollapsibleCard open={linked === 4}>
        <div class="header" slot="titleSlot">
            <span class="subtitle">4</span>
            <div class="title">
                External system dependencies
                <div class="copy" on:click|stopPropagation={() => copyUrl("4")}>
                    <Copy size={copySize} color={"var(--landing-txt)"} />
                </div>
            </div>
        </div>
        <div class="body">
            <HashLinkTarget on:copyUrl={onCopyUrl} id="4-1">Internet Identity (II)</HashLinkTarget>

            <p>
                II is the standard authentication mechanism supported by the InternetComputer and
                the default authentication option for OpenChat and is described
                <ExternalLink href="https://wiki.internetcomputer.org/wiki/Internet_Identity"
                    >here.</ExternalLink
                >.
            </p>

            <HashLinkTarget on:copyUrl={onCopyUrl} id="4-2">NFID</HashLinkTarget>

            <p>
                <ExternalLink href="https://docs.nfid.one/">NFID</ExternalLink> is a very interesting
                alternative to II. It is actually built on top of II and provides a superset of functionality.
                It also provides a revised UX on top of II and provides some other capabilities such
                as social login, advanced phone number verification and in the future, any number of
                other useful credentials e.g. email address or even full blown KYC.
            </p>

            <p>
                NFID is implemented using its own smart contracts and by integrating with those of
                II. It is developed and maintained by Identity Labs who have worked closely with
                DFINITY’s cryptographers to ensure their system is secure. However at this point
                their source code is not publicly available and they directly control the upgrade
                process. In time they plan to open source and become an SNS controlled DAO which
                would then put them on an equal footing with II in terms of security. Until that
                point we expect to keep II as the default authentication provider for OpenChat.
            </p>

            <HashLinkTarget on:copyUrl={onCopyUrl} id="4-3">Ledgers</HashLinkTarget>

            <p>
                OpenChat currently integrates with the NNS ledger and is poised to integrate with
                the OpenChat SNS ledger. It is also ready to integrate with any future Internet
                Computer ledgers as they become available. This allows users to transfer tokens into
                and out of their OpenChat wallet (canister) and to send tokens as messages to other
                users.
            </p>

            <HashLinkTarget on:copyUrl={onCopyUrl} id="4-4">Governance</HashLinkTarget>

            <p>
                Likewise we integrate with the NNS governance canister and very soon the OpenChat
                SNS governance canister. As they become available we will also integrate with the
                SNS governance canisters for other projects. This enables special proposal groups in
                OpenChat which allow users to see/filter proposals, chat about them in threads, and
                conveniently vote with all linked neurons in one operation.
            </p>

            <HashLinkTarget on:copyUrl={onCopyUrl} id="4-5">UserGeek</HashLinkTarget>

            <p>
                We integrate with <ExternalLink
                    href="https://fbbjb-oyaaa-aaaah-qaojq-cai.raw.ic0.app/">UserGeek</ExternalLink> from
                the browser to anonymously collect and analyze user app usage data. Below is the UserGeek
                dashboard for OpenChat at the time of writing (1st Nov 2022 at 4pm UTC). We hope UserGeek
                will support public dashboards so we can make this permanently available from our website.
            </p>

            <ZoomableImage
                on:zoom={zoomImage}
                url={"../assets/architecture/usergeek.png"}
                alt="UserGeek charts" />
        </div>
    </CollapsibleCard>
    <div class="unabridged">
        <ArrowLink
            url="https://github.com/open-ic/open-chat/blob/master/architecture/doc.md#openchat-architecture"
            target="_blank"
            color={"#23A2EE"}>
            Unabridged architecture
        </ArrowLink>
    </div>
</div>

<style type="text/scss">
    .architecture {
        text-align: left;
        @include lp-content-padding();
        margin-top: toRem(80);

        @include mobile() {
            margin-top: 0;
        }
    }

    .body {
        padding: 0 0 toRem(30) toRem(80);
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
        flex: 0 0 toRem(80);

        @include mobile() {
            flex: 0 0 toRem(30);
        }
    }

    .title {
        flex: auto;
        display: flex;
        align-items: center;
        gap: $sp3;

        .copy {
            cursor: pointer;

            opacity: 0;
            transition: opacity 250ms ease-in-out;
        }

        &:hover .copy {
            opacity: 1;
        }
    }

    .list {
        @include bullet_list();
    }

    .code {
        margin-bottom: toRem(24);
        display: inline-block;

        &::before {
            content: " > ";
        }
    }

    .unabridged {
        margin-top: toRem(36);
        margin-bottom: toRem(20);
        display: flex;
        justify-content: flex-end;
    }
</style>
