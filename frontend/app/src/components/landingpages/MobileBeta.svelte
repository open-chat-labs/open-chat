<script lang="ts">
    import Section from "./Section.svelte";

    const GROUP_URL = "https://groups.google.com/g/openchatbeta";
    const PLAY_TEST_URL = "https://play.google.com/apps/testing/com.oclabs.openchat";
    const APK_URL = "https://github.com/open-chat-labs/open-chat/releases/latest";
</script>

<Section id={"beta"}>
    <div class="beta">
        <h2>Try OpenChat on your phone</h2>
        <p class="sub">
            The Android app is in closed testing. Anyone can join, there is just a little
            Google-imposed ceremony to get through first.
        </p>

        <div class="cards">
            <article class="card android">
                <header>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                            fill="currentColor"
                            d="M6.38 3.2l1.02 1.77A7.97 7.97 0 0 0 4 11.5h16a7.97 7.97 0 0 0-3.4-6.53l1.02-1.77a.4.4 0 1 0-.69-.4L15.9 4.6a7.9 7.9 0 0 0-7.8 0L7.07 2.8a.4.4 0 1 0-.69.4zM8.5 8.75a.95.95 0 1 1 0-1.9.95.95 0 0 1 0 1.9zm7 0a.95.95 0 1 1 0-1.9.95.95 0 0 1 0 1.9zM4 13h16v5.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V13z" />
                    </svg>
                    <h3>Android</h3>
                    <span class="pill open">Beta open</span>
                </header>

                <p class="preamble">
                    <strong>Use the same Google account your phone's Play Store is signed in to.</strong
                    >
                    Play matches testers by exact address, so anything else and it will tell you the
                    app cannot be found.
                </p>

                <ol>
                    <li>
                        <span class="n">1</span>
                        <span>
                            Join the testers group. This is what tells Google you are allowed in.<br />
                            <a href={GROUP_URL} target="_blank" rel="noreferrer"
                                >groups.google.com/g/openchatbeta →</a>
                        </span>
                    </li>
                    <li>
                        <span class="n">2</span>
                        <span>
                            Accept the test on the Google Play testing page.<br />
                            <a href={PLAY_TEST_URL} target="_blank" rel="noreferrer"
                                >play.google.com/apps/testing →</a>
                        </span>
                    </li>
                    <li>
                        <span class="n">3</span>
                        <span>Install OpenChat from the Play Store link that page gives you.</span>
                    </li>
                </ol>

                <a class="btn" href={GROUP_URL} target="_blank" rel="noreferrer"
                    >Join the Android beta</a>

                <p class="note">
                    The Play Store listing stays invisible until you have done steps 1 and 2.
                </p>

                <aside>
                    <strong>Already running OpenChat from a downloaded APK?</strong> The Play version
                    is a separate app, so install it first and then uninstall the old one. If you leave
                    both installed, every notification arrives twice.
                </aside>
            </article>

            <article class="card ios">
                <header>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                            fill="currentColor"
                            d="M17.05 12.54c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.8 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.89 2.65 3.24 2.6 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.39.81 1.4-.02 2.28-1.27 3.14-2.52.99-1.45 1.39-2.85 1.42-2.92-.03-.01-2.72-1.04-2.74-4.14zM14.46 4.9c.72-.87 1.2-2.08 1.07-3.28-1.03.04-2.28.69-3.02 1.55-.66.77-1.24 2-.09 3.16 1.15.09 2.32-.58 3.04-1.43z" />
                    </svg>
                    <h3>iPhone</h3>
                    <span class="pill soon">Coming soon</span>
                </header>

                <p class="preamble">
                    The iOS app is being built now and will go out through TestFlight when it is
                    ready.
                </p>

                <p class="note">
                    In the meantime OpenChat runs in Safari, and you can add it to your home screen
                    from the share menu.
                </p>
            </article>
        </div>

        <div class="direct">
            <h3>Or install it yourself</h3>
            <p>
                Every release is published as an APK you can install directly. It is the same app
                without the restrictions Google requires of a store build, so it keeps the wallet
                and the token features. You will need to allow installs from unknown sources, and
                it updates itself rather than through the Play Store.
            </p>
            <p class="warn">
                <strong>Pick one or the other.</strong> Android identifies an app by its signature
                as well as its name, and the Play version is signed by Google while this one is
                signed by us. Swapping between them means uninstalling first, so choose the route
                you want and stay on it.
            </p>
            <a class="btn ghost" href={APK_URL} target="_blank" rel="noreferrer"
                >Download the latest APK →</a>
        </div>
    </div>
</Section>

<style lang="scss">
    .beta {
        margin-bottom: $sp5;
    }

    h2 {
        @include font(bold, normal, fs-160, 38);
        margin-bottom: $sp3;
    }

    .sub {
        @include font(book, normal, fs-100, 28);
        margin-bottom: $sp5;
        max-width: toRem(620);
    }

    .cards {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: $sp4;

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
        margin-bottom: $sp4;
    }

    ol {
        list-style: none;
        padding: 0;
        margin: 0 0 $sp4 0;
    }

    li {
        display: flex;
        gap: $sp3;
        margin-bottom: $sp3;
        @include font(book, normal, fs-80, 24);
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

    a {
        color: inherit;
        text-decoration: underline;
        text-underline-offset: toRem(3);
    }

    .btn {
        display: block;
        text-align: center;
        text-decoration: none;
        padding: toRem(14) toRem(20);
        background-color: #ffffff;
        color: #242834;
        margin-bottom: $sp3;
        @include font(bold, normal, fs-90, 24);
    }

    .note {
        @include font(book, normal, fs-70, 22);
        opacity: 0.85;
    }

    .direct {
        margin-top: $sp4;
        padding: toRem(32);
        background-color: #242834;
        color: #ffffff;

        h3 {
            @include font(bold, normal, fs-120, 28);
            margin: 0 0 $sp3 0;
        }

        p {
            @include font(book, normal, fs-80, 24);
            margin-bottom: $sp3;
            max-width: toRem(720);
        }

        .warn {
            opacity: 0.85;
        }
    }

    .btn.ghost {
        display: inline-block;
        background-color: transparent;
        color: #ffffff;
        border: toRem(1) solid rgba(255, 255, 255, 0.5);
        margin-bottom: 0;
    }

    aside {
        margin-top: $sp4;
        padding: toRem(16);
        background-color: rgba(0, 0, 0, 0.15);
        @include font(book, normal, fs-70, 22);
    }
</style>
