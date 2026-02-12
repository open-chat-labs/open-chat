<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import {
        Body,
        BodySmall,
        Caption,
        ColourVars,
        Column,
        Row,
        Subtitle,
        Title,
    } from "component-lib";
    import CollapsibleCard from "../../CollapsibleCard.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import ArrowLink from "./ArrowLink.svelte";
    import ExternalLink from "./ExternalLink.svelte";
</script>

<SlidingPageContent title={i18nKey("Architecture")}>
    <Column padding={["sm", "lg", "xxl", "lg"]} height={"fill"} gap={"xs"}>
        <CollapsibleCard>
            {#snippet titleSlot()}
                <Title fontWeight={"bold"}>System overview</Title>
            {/snippet}
            <Column gap={"lg"}>
                <Body colour={"textSecondary"}>
                    OpenChat is a system composed of canister smart contracts running on the
                    Internet Computer which provides chat functionality. The canisters provide an
                    API and serve the assets for the OpenChat web app, and going forwards, will
                    allow 3rd-party services to integrate chat. The following diagram shows the
                    OpenChat system in yellow with its various external dependencies. The orange
                    boxes are services running on the Internet Computer and the blue boxes are
                    off-chain.
                </Body>

                <img src={"/assets/architecture/simple.svg"} alt={"High level architecture"} />
            </Column>
        </CollapsibleCard>

        <CollapsibleCard open={false}>
            {#snippet titleSlot()}
                <Title fontWeight={"bold"}>System components in depth</Title>
            {/snippet}
            <Column gap={"lg"}>
                <Body colour={"textSecondary"}>
                    This diagram shows the OpenChat system enclosed in the box with the dashed
                    orange border, decomposed into the various deployable units. The solid links
                    represent Internet Computer updates which go through blockchain consensus. The
                    green boxes are all canisters and the light gray boxes are services hosted on
                    AWS.
                </Body>

                <img src={"/assets/architecture/complex.svg"} alt={"Complete architecture"} />

                <Subtitle fontWeight={"bold"}>Canister components</Subtitle>

                <Subtitle>User canister</Subtitle>

                <Body colour={"textSecondary"}>
                    A key decision was made to give each user their own canister. This holds the
                    user’s direct chats including the messages of both parties, references to each
                    group the user is a member of, and other data such as their authentication
                    principal, username, bio, avatar and blocked users. The user’s canister becomes
                    a wallet for holding tokens in IC ledgers which allows tokens to be sent between
                    users as chat messages. The user can also add their canister as a hotkey to
                    their neurons which allows them to easily vote on proposals within the NNS and
                    SNS proposal groups on OpenChat.
                </Body>

                <Body colour={"textSecondary"}>
                    There are pros and cons to this architecture but it will best support the long
                    term scalability of the system.
                </Body>

                <Subtitle>User index canister</Subtitle>

                <Body colour={"textSecondary"}>
                    The user index canister essentially holds the global registry of OpenChat users.
                    Each user record includes the principal, user id, username, avatar id,
                    created/updated/last online, account charges, phone verification status, storage
                    limit, user referred by, wasm version, and several other fields. It is
                    responsible for creating, upgrading, topping up, and keeping track of user
                    canisters. It can verify users (using a code sent over SMS) and take payment for
                    premium services such as more storage or groups. It calls into OpenStorage to
                    manage users’ file storage quotas.
                </Body>

                <Body colour={"textSecondary"}>
                    Ultimately it might be necessary to shard the user index across multiple
                    canisters but 32 GB of stable memory will give enough capacity for a long time
                    yet and we can cross that bridge later.
                </Body>

                <Subtitle>Group canister</Subtitle>

                <Body colour={"textSecondary"}>
                    As for users, each group has its own canister. This stores and manages the group
                    members and their roles, all the messages and other events that have occurred in
                    the group, and other details of the group such as name, description, rules,
                    avatar, permissions, pinned messages etc. Any message file attachments such as
                    images and videos are stored using the OpenStorage service rather than in the
                    group canister itself. We anticipate that with 32 GB of stable storage available
                    to a single canister and since the messages in group canisters only have text,
                    no groups will outgrow their canister. The same goes for user canisters.
                </Body>

                <Subtitle>Group index canister</Subtitle>

                <Body colour={"textSecondary"}>
                    The group index canister essentially holds the global registry of OpenChat
                    groups. Each group record includes the group id (canister id), active until
                    timestamp, wasm version, and several other fields. In addition, public group
                    records include the name, description, avatar id, and various other fields. It
                    is responsible for creating, upgrading, topping up, and keeping track of user
                    canisters. It also provides a searchable index of public groups and maintains a
                    list of hot groups.
                </Body>

                <Subtitle>OpenStorage</Subtitle>

                <Body colour={"textSecondary"}>
                    <ExternalLink href="https://github.com/open-chat-labs/open-storage"
                        >OpenStorage</ExternalLink
                    >is a scalable file storage system built by the OpenChat team which is available
                    to be used by other projects. It consists of an index canister and dynamically
                    created bucket canisters which hold the file data. Once a bucket is full it
                    becomes read-only and a new bucket is created. OpenStorage implements <ExternalLink
                        href="https://en.wikipedia.org/wiki/Content-addressable_storage"
                        >content addressing</ExternalLink> so that for duplicate files the data is only
                    stored once. This makes the forwarding of file messages on OpenChat cheap and quick.
                    Files in OpenStorage are owned by users, in the case of OpenChat the sender of a
                    file message is the file owner. Internally a file holds a reference to the underlying
                    blob. It uses reference counting so that if all the files for a given blob are deleted
                    then the blob is deleted.
                </Body>

                <Body colour={"textSecondary"}>
                    Each user is given a byte allowance which they can’t exceed. The first file
                    reference a user has to a blob comes out of the user’s allowance but any further
                    file references the user has to the same blob do not. This allows a user to
                    upload or forward the same file multiple times without additional cost.
                </Body>

                <Subtitle>Notifications</Subtitle>

                <Body colour={"textSecondary"}>
                    The notifications canister holds a queue of notifications sent from user or
                    group canisters to be sent on to registered users using <ExternalLink
                        href="https://web.dev/push-notifications-overview/"
                        >web push notifications</ExternalLink
                    >. It also holds a set of web push subscriptions for each user.
                </Body>

                <Subtitle>Proposals bot</Subtitle>

                <Body colour={"textSecondary"}>
                    The proposals bot canister syncs proposals from the NNS and each registered SNS
                    with the equivalent proposals group in OpenChat.
                </Body>

                <Subtitle>Online users aggregator</Subtitle>

                <Body colour={"textSecondary"}>
                    The online users aggregator canister has one simple responsibility. Every 61
                    seconds, while the user is signed-in, the app calls mark_as_online on this
                    canister which adds it to a set of online user principals. In the background, on
                    every heartbeat, if this set is not empty the online users aggregator will call
                    c2c_mark_users_online on the user index canister with all of these users before
                    then emptying the set. The user index can then update the online status of its
                    users which are discovered by the app using the users endpoint. This canister
                    exists purely to take update load away from the user index canister.
                </Body>

                <Subtitle>Assets canister</Subtitle>

                <Body colour={"textSecondary"}>
                    The assets canister (via the service worker) serves the static assets for the
                    web app. The response from the assets canister includes the asset data and a
                    threshold signature. The service worker uses the IC public key to verify the
                    signature of each asset and prove it has not been served by a malicious node and
                    tampered with, before returning the HTTP GET response. Thus any assets served by
                    the asset canister can be considered on-chain and are tamperproof. The service
                    worker itself, and the root html which loads it, cannot be served by the assets
                    canister.
                </Body>

                <Subtitle>Cycles dispenser</Subtitle>

                <Body colour={"textSecondary"}>
                    The cycles dispenser is a canister responsible for topping up the other
                    canisters with cycles automatically when they are running low.
                </Body>

                <Body colour={"textSecondary"}>
                    Cycles can also be deposited into the cycles dispenser. It also has an ICP
                    ledger account which it will access if its cycles balance dips below a threshold
                    and then burn some into cycles. When OpenChat is controlled by its SNS, a simple
                    ICP transfer proposal can be made periodically to keep the whole system topped
                    up with cycles.
                </Body>

                <Subtitle>Deployment / Upgrade</Subtitle>

                <Body colour={"textSecondary"}>
                    User and group canisters are upgraded in batches with an API call to their
                    respective index canisters which can only be called by dev team member
                    principals and going forward, only by the SNS.
                </Body>

                <Subtitle>APIs</Subtitle>

                <Body colour={"textSecondary"}>
                    The client-facing APIs all use candid which is the standard for the Internet
                    Computer. The internal canister-to-canister APIs use <ExternalLink
                        href="https://msgpack.org/index.html">MessagePack</ExternalLink> which is efficient
                    and flexible allowing them to evolve easily by keeping backward compatibility.
                </Body>

                <Body colour={"textSecondary"}>
                    Every OpenChat canister exposes a public <ExternalLink
                        href="https://4bkt6-4aaaa-aaaaf-aaaiq-cai.raw.ic0.app/metrics"
                        >metrics endpoint</ExternalLink> which includes some common data (below) and
                    also data specific to the type of canister.
                </Body>

                <Body colour={"textSecondary"}>
                    <ul class="list">
                        <li>memory used</li>
                        <li>time now (in milliseconds since unix epoch)</li>
                        <li>cycles balance</li>
                        <li>wasm version</li>
                        <li>git commit id</li>
                    </ul>
                </Body>

                <Body colour={"textSecondary"}>
                    Also every OpenChat canister exposes a public <ExternalLink
                        href="https://4bkt6-4aaaa-aaaaf-aaaiq-cai.raw.ic0.app/logs"
                        >logs endpoint</ExternalLink
                    >.
                </Body>

                <Subtitle fontWeight={"bold"}>Off-chain components</Subtitle>

                <Subtitle>SMS relay oracle</Subtitle>

                <Body colour={"textSecondary"}>
                    This is used as part of the phone number verification process we currently use.
                    Once we start using NFID for proof of unique personhood we can remove it.
                </Body>

                <Subtitle>Notifications relay oracle</Subtitle>

                <Body colour={"textSecondary"}>
                    This is currently required to support push notifications. Once the Internet
                    Computer supports HTTP calls from a single replica, the notifications canister
                    will be able to directly send notifications to web push notifications servers.
                </Body>

                <Subtitle fontWeight={"bold"}>Frontend components</Subtitle>

                <img src={"/assets/architecture/frontend.svg"} alt={"Frontend architecture"} />

                <Subtitle>Service worker</Subtitle>

                <Body colour={"textSecondary"}>
                    Our service worker provides a caching layer supported by google workbox. This
                    improves performance and also supports offline mode. It also exists to recieve
                    push notification in PWA mode.
                </Body>

                <Subtitle>Chat app</Subtitle>

                <Body colour={"textSecondary"}>
                    The OpenChat app is written in typescript and Svelte and is composed of three
                    layers.
                </Body>

                <Body colour={"textSecondary"}>
                    <ul class="list">
                        <li>
                            the UI layer built using the <ExternalLink href="https://svelte.dev/"
                                >Svelte compiler</ExternalLink>
                        </li>
                        <li>
                            the OpenChat client library which exposes the app’s runtime state to the
                            UI as a collection of reactive svelte stores
                        </li>
                        <li>
                            the OpenChat agent which is responsible for calling canisters APIs and
                            caching their responses
                        </li>
                    </ul>
                </Body>

                <Body fontWeight={"bold"}>Agent</Body>

                <Body colour={"textSecondary"}>
                    The OpenChat agent runs in a separate thread from the UI as a web worker which
                    helps keep the UI responsive. It exposes its API to the client library on top of
                    the browser’s <ExternalLink
                        href="https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage"
                        >post message API</ExternalLink
                    >.
                </Body>

                <Body colour={"textSecondary"}>
                    It calls into the OpenChat canister APIs using the <ExternalLink
                        href="https://github.com/dfinity/agent-js"
                        >Internet Computer agent</ExternalLink
                    >. Internally it uses the decorator pattern to implement a caching layer using
                    IndexDB.
                </Body>

                <Body fontWeight={"bold"}>Client library</Body>

                <Body colour={"textSecondary"}>
                    When the client library is loaded it registers a web worker running the OpenChat
                    agent which it wraps to provide an API to the UI layer. It also polls the agent
                    to keep important runtime state up to date in the form of a collection of
                    reactive svelte stores.
                </Body>

                <Body colour={"textSecondary"}>
                    In general the readable runtime state is derived from a merging of the confirmed
                    server-side state (which it reads from the agent) and pending local updates
                    (made locally by the user). The pending updates are synced with the canister
                    backend using API calls and eventually become confirmed.
                </Body>

                <Body colour={"textSecondary"}>
                    It maintains local user settings in the browser’s local storage.</Body>

                <Body fontWeight={"bold"}>User interface</Body>

                <Body colour={"textSecondary"}>
                    The UI is composed of svelte components which call into APIs and react to svelte
                    stores exposed by the client library and UI specific svelte stores. This layer
                    also deals with the application routing, the global styling and theming, and
                    multi-language text resources.
                </Body>

                <Body fontWeight={"bold"}>WebRTC</Body>

                <Body colour={"textSecondary"}>
                    The client library uses <ExternalLink
                        href="https://en.wikipedia.org/wiki/WebRTC">WebRTC</ExternalLink> to instantaneously
                    send messages and typing notifications to online users directly between browsers.
                    We always send messages via the Internet Computer but will also send them over WebRTC
                    sockets where possible. WebRTC is a securely encrypted peer-2-peer protocol and so
                    is a good fit for a decentralized chat application. However there are a couple of
                    off-chain components involved.
                </Body>

                <Body colour={"textSecondary"}>
                    Currently we use third party STUN and signalling infrastructure to support
                    WebRTC (and will probably incorporate TURN servers for improved reliability in
                    the future).
                </Body>

                <Body colour={"textSecondary"}>
                    We hope that these features will become supported on the IC itself in the
                    future.
                </Body>
            </Column>
        </CollapsibleCard>

        <CollapsibleCard open={false}>
            {#snippet titleSlot()}
                <Title fontWeight={"bold"}>Verification of canister code</Title>
            {/snippet}
            <Column gap={"lg"}>
                <Body colour={"textSecondary"}>
                    The <ExternalLink href={"https://github.com/open-chat-labs/open-chat"}
                        >OpenChat source code</ExternalLink> is built into the WASMs used by each type
                    of OpenChat canister in a repeatable way using docker. Anyone who pulls the OpenChat
                    source code and uses the docker build will produce identical WASM files.
                </Body>

                <Body colour={"textSecondary"}>
                    Each canister exposes a metrics endpoint which is publicly accessible over the
                    raw domain. In each case these metrics include the git commit id which
                    identifies the specific source code revision used to build the WASM currently
                    running on that canister. For example here is the url of the metrics endpoint
                    for the user index canister:
                    https://4bkt6-4aaaa-aaaaf-aaaiq-cai.raw.ic0.app/metrics.
                </Body>

                <Body colour={"textSecondary"}>
                    You can use dfx to interrogate the sha256 hash of the WASM module for any given
                    canister id using the following command:
                </Body>

                <Caption colour={"tertiary"}>
                    <code class="code"
                        >dfx canister --network ic info 4bkt6-4aaaa-aaaaf-aaaiq-cai
                    </code>
                </Caption>

                <Body colour={"textSecondary"}>
                    By building the WASM module for a canister at the given git commit, calculating
                    its sha256 hash, and comparing with the module hash returned by the IC using
                    dfx, the source code running on any canister can be verified.
                </Body>
                <Body colour={"textSecondary"}>
                    <ul class="list">
                        <li>
                            the canister ids of the top-level OpenChat canisters can be found in the
                            canister_ids.json file in the root of the OpenChat repo
                        </li>
                        <li>
                            the canister id of any group canister can be found in the url for that
                            group in the OpenChat app
                        </li>
                        <li>
                            likewise the canister id of any user canister can be found in the url of
                            a direct chat with that user
                        </li>
                        <li>
                            your own canister id can be found from the main menu in the advanced
                            section of your profile
                        </li>
                    </ul>
                </Body>
            </Column>
        </CollapsibleCard>

        <CollapsibleCard open={false}>
            {#snippet titleSlot()}
                <Title fontWeight={"bold"}>External system dependencies</Title>
            {/snippet}
            <Column gap={"lg"}>
                <Subtitle>Internet Identity (II)</Subtitle>

                <Body colour={"textSecondary"}>
                    II is the standard authentication mechanism supported by the InternetComputer
                    and the default authentication option for OpenChat and is described
                    <ExternalLink href="https://wiki.internetcomputer.org/wiki/Internet_Identity"
                        >here.</ExternalLink
                    >.
                </Body>

                <Subtitle>Ledgers</Subtitle>

                <Body colour={"textSecondary"}>
                    OpenChat currently integrates with the NNS ledger and is poised to integrate
                    with the OpenChat SNS ledger. It is also ready to integrate with any future
                    Internet Computer ledgers as they become available. This allows users to
                    transfer tokens into and out of their OpenChat wallet (canister) and to send
                    tokens as messages to other users.
                </Body>

                <Subtitle>Governance</Subtitle>

                <Body colour={"textSecondary"}>
                    Likewise we integrate with the NNS governance canister and very soon the
                    OpenChat SNS governance canister. As they become available we will also
                    integrate with the SNS governance canisters for other projects. This enables
                    special proposal groups in OpenChat which allow users to see/filter proposals,
                    chat about them in threads, and conveniently vote with all linked neurons in one
                    operation.
                </Body>

                <Subtitle>Usergeek</Subtitle>

                <Body colour={"textSecondary"}>
                    We integrate with <ExternalLink
                        href="https://fbbjb-oyaaa-aaaah-qaojq-cai.raw.ic0.app/"
                        >UserGeek</ExternalLink> from the browser to anonymously collect and analyze
                    user app usage data. Below is the UserGeek dashboard for OpenChat at the time of
                    writing (1st Nov 2022 at 4pm UTC). We hope UserGeek will support public dashboards
                    so we can make this permanently available from our website.
                </Body>

                <img src={"/assets/architecture/usergeek.png"} alt={"Usergeek charts"} />
            </Column>
        </CollapsibleCard>

        <Row padding={["lg", "zero"]}>
            <ArrowLink
                url="https://github.com/open-chat-labs/open-chat/blob/master/architecture/doc.md#openchat-architecture"
                target="_blank"
                color={ColourVars.secondary}>
                <BodySmall colour={"textSecondary"}>Unabridged architecture</BodySmall>
            </ArrowLink>
        </Row>
    </Column>
</SlidingPageContent>

<style lang="scss">
    .list {
        @include bullet_list();
    }

    img {
        width: 100%;
    }
</style>
