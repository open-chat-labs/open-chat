<script lang="ts">
    import Section from "./Section.svelte";

    const GROUP_URL = "https://groups.google.com/g/openchatbeta";
    const PLAY_TEST_URL = "https://play.google.com/apps/testing/com.oclabs.openchat";
    const APK_URL = "https://github.com/open-chat-labs/open-chat/releases/latest";

    // Which build the reader has chosen. Deliberately not persisted: the choice is
    // cheap to make again and the two paths are mutually exclusive, so landing on
    // one of them without having picked it would be confusing.
    let step = $state<"choice" | "store" | "full">("choice");
</script>

<Section id={"beta"}>
    <div class="beta">
        <h2>Try the OpenChat native app</h2>
        <p class="sub">
            The Android app is in beta. Pick the build you want below — the iOS app is on its way.
        </p>

        <div class="cards">
            <article class="card android">
                <header>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                            fill="currentColor"
                            d="M6.38 3.2l1.02 1.77A7.97 7.97 0 0 0 4 11.5h16a7.97 7.97 0 0 0-3.4-6.53l1.02-1.77a.4.4 0 1 0-.69-.4L15.9 4.6a7.9 7.9 0 0 0-7.8 0L7.07 2.8a.4.4 0 1 0-.69.4zM8.5 8.75a.95.95 0 1 1 0-1.9.95.95 0 0 1 0 1.9zm7 0a.95.95 0 1 1 0-1.9.95.95 0 0 1 0 1.9zM4 13h16v5.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V13z"
                        />
                    </svg>
                    <h3>Android</h3>
                    <span class="pill open">Beta open</span>
                </header>

                {#if step === "choice"}
                    <p class="preamble">There are two builds of the app. Which would you like?</p>
                    <p class="note pick">
                        Pick one and stick with it — the two builds can't be installed together.
                    </p>

                    <div class="options">
                        <button class="option" onclick={() => (step = "store")}>
                            <span class="option-title">Play Store version →</span>
                            <span class="option-body">
                                Installs and updates through Google Play. A couple of features are
                                trimmed to meet store rules.
                            </span>
                        </button>
                        <button class="option" onclick={() => (step = "full")}>
                            <span class="option-title">Full version →</span>
                            <span class="option-body">
                                Everything, including the wallet and token features. You install the
                                APK yourself and it keeps itself up to date.
                            </span>
                        </button>
                    </div>
                {:else if step === "store"}
                    <button class="back" onclick={() => (step = "choice")}
                        >← Back to the choice</button
                    >

                    <p class="preamble">
                        The beta is open to everyone — there's just a little Google-imposed ceremony
                        first. <strong
                            >Use the same Google account your phone's Play Store is signed in to</strong
                        >; Play matches testers by exact address.
                    </p>

                    <ol>
                        <li>
                            <span class="n">1</span>
                            <span>
                                Join the testers group. This is what tells Google you're allowed in.
                                <a class="btn" href={GROUP_URL} target="_blank" rel="noreferrer"
                                    >Join the testers group →</a
                                >
                            </span>
                        </li>
                        <li>
                            <span class="n">2</span>
                            <span>
                                Accept the test on the Google Play testing page.
                                <a
                                    class="btn outline"
                                    href={PLAY_TEST_URL}
                                    target="_blank"
                                    rel="noreferrer">Accept the test →</a
                                >
                            </span>
                        </li>
                        <li>
                            <span class="n">3</span>
                            <span>
                                Install OpenChat from the Play Store link that page gives you. The
                                listing stays invisible until you've done steps 1 and 2.
                            </span>
                        </li>
                    </ol>

                    <aside>
                        <strong>Already running OpenChat from a downloaded APK?</strong> The Play version
                        is a separate app — install it, then uninstall the old one. Leave both on your
                        phone and every notification arrives twice.
                    </aside>
                {:else}
                    <button class="back" onclick={() => (step = "choice")}
                        >← Back to the choice</button
                    >

                    <p class="preamble">
                        Every release is published as an APK you can install directly. It's the same
                        app without the restrictions Google puts on store builds, so it keeps the
                        wallet and token features. Your phone will ask you to allow installs from
                        unknown sources, and the app updates itself rather than through the Play
                        Store.
                    </p>

                    <a class="btn" href={APK_URL} target="_blank" rel="noreferrer"
                        >Download the latest APK →</a
                    >

                    <aside>
                        <strong>Switching from the Play version?</strong> Uninstall it first. Android
                        identifies an app by its signature as well as its name, and the two builds are
                        signed differently — one won't install over the other.
                    </aside>
                {/if}
            </article>

            <article class="card ios">
                <header>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                            fill="currentColor"
                            d="M17.05 12.54c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.8 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.89 2.65 3.24 2.6 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.39.81 1.4-.02 2.28-1.27 3.14-2.52.99-1.45 1.39-2.85 1.42-2.92-.03-.01-2.72-1.04-2.74-4.14zM14.46 4.9c.72-.87 1.2-2.08 1.07-3.28-1.03.04-2.28.69-3.02 1.55-.66.77-1.24 2-.09 3.16 1.15.09 2.32-.58 3.04-1.43z"
                        />
                    </svg>
                    <h3>iPhone</h3>
                    <span class="pill soon">Coming soon</span>
                </header>

                <p class="preamble">
                    The iOS app is being built now and will go out through TestFlight when it's
                    ready.
                </p>

                <p class="note">
                    In the meantime OpenChat runs nicely in Safari — open <strong>oc.app</strong> and
                    add it to your home screen from the share menu.
                </p>
            </article>
        </div>
    </div>
</Section>

<style lang="scss">
    // The landing header is position:fixed and 80px tall, so scrollIntoView would
    // put the top of this section underneath it. Lives here rather than at the call
    // site so anything scrolling to #beta gets the offset. 80 plus a little air.
    :global(section#beta) {
        scroll-margin-top: toRem(96);
    }

    .beta {
        margin-bottom: $sp5;
    }

    h2 {
        @include font(bold, normal, fs-160, 38);
        margin-bottom: $sp3;
    }

    .sub {
        @include font(book, normal, fs-100, 28);
        color: var(--txt-light);
        margin-bottom: $sp5;
        max-width: toRem(620);
    }

    .cards {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: $sp4;
        // The android card grows and shrinks as the wizard advances; without this
        // the iPhone card stretches to match whatever it is currently showing.
        align-items: start;

        @include mobile() {
            grid-template-columns: 1fr;
        }
    }

    .card {
        padding: toRem(40) toRem(32) toRem(32) toRem(32);
        text-align: left;

        &.android {
            background-color: #05b09f;
            color: #ffffff;
        }

        &.ios {
            background-color: #fec000;
            color: #242834;
        }
    }

    header {
        display: flex;
        align-items: center;
        gap: $sp3;
        margin-bottom: $sp4;

        svg {
            width: toRem(28);
            height: toRem(28);
            flex: 0 0 auto;
        }

        h3 {
            @include font(bold, normal, fs-120, 28);
            margin: 0;
            flex: 1;
        }
    }

    .pill {
        @include font(bold, normal, fs-60, 18);
        padding: toRem(4) toRem(10);
        border-radius: toRem(12);
        white-space: nowrap;

        &.open {
            background-color: rgba(255, 255, 255, 0.25);
            color: #ffffff;
        }

        &.soon {
            background-color: rgba(36, 40, 52, 0.15);
            color: #242834;
        }
    }

    .preamble {
        @include font(book, normal, fs-80, 24);
        margin-bottom: $sp3;
    }

    .options {
        display: grid;
        gap: toRem(12);
    }

    .option {
        display: grid;
        gap: toRem(6);
        text-align: left;
        cursor: pointer;
        padding: toRem(16);
        color: #ffffff;
        background-color: rgba(0, 0, 0, 0.15);
        border: toRem(1) solid rgba(255, 255, 255, 0.35);

        &:hover {
            background-color: rgba(0, 0, 0, 0.25);
            border-color: #ffffff;
        }

        &:focus-visible {
            outline: toRem(2) solid #ffffff;
            outline-offset: toRem(2);
        }
    }

    .option-title {
        @include font(bold, normal, fs-90, 24);
    }

    .option-body {
        @include font(book, normal, fs-70, 22);
        opacity: 0.9;
    }

    .back {
        background: none;
        border: none;
        padding: 0;
        margin: 0 0 $sp4 0;
        cursor: pointer;
        color: #ffffff;
        text-decoration: underline;
        text-underline-offset: toRem(3);
        @include font(bold, normal, fs-70, 22);

        &:hover {
            opacity: 0.8;
        }

        &:focus-visible {
            outline: toRem(2) solid #ffffff;
            outline-offset: toRem(2);
        }
    }

    ol {
        list-style: none;
        padding: 0;
        margin: 0 0 $sp4 0;
    }

    li {
        display: flex;
        gap: $sp3;
        margin-bottom: $sp4;
        @include font(book, normal, fs-80, 24);

        > span:last-child {
            display: grid;
            gap: $sp3;
        }
    }

    .n {
        flex: 0 0 auto;
        width: toRem(22);
        height: toRem(22);
        border-radius: 50%;
        background-color: rgba(255, 255, 255, 0.25);
        display: flex;
        align-items: center;
        justify-content: center;
        @include font(bold, normal, fs-60, 22);
    }

    .btn {
        display: block;
        text-align: center;
        text-decoration: none;
        padding: toRem(10) toRem(20);
        background-color: #ffffff;
        color: #242834;
        @include font(bold, normal, fs-80, 24);

        &:hover {
            background-color: #e8e8e8;
        }

        &.outline {
            background-color: transparent;
            color: #ffffff;
            border: toRem(1) solid rgba(255, 255, 255, 0.6);

            &:hover {
                border-color: #ffffff;
                background-color: rgba(255, 255, 255, 0.1);
            }
        }
    }

    .note {
        @include font(book, normal, fs-70, 22);
        opacity: 0.85;

        &.pick {
            margin-bottom: $sp4;
        }
    }

    aside {
        margin-top: $sp4;
        padding: toRem(16);
        background-color: rgba(0, 0, 0, 0.15);
        @include font(book, normal, fs-70, 22);
    }
</style>
