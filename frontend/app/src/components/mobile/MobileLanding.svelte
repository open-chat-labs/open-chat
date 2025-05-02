<script lang="ts">
    import { getContext } from "svelte";
    import { openUrl } from "tauri-plugin-oc-api";
    import { type OpenChat } from "openchat-client";
    import FancyLoader from "../icons/FancyLoader.svelte";
    import Button from "../Button.svelte";

    const client = getContext<OpenChat>("client");

    const iiUrl = "https://internetcomputer.org/";
    const ocUrl = "https://oc.app/home";

    function openInBrowser(e: MouseEvent, url: string) {
        openUrl({ url });
        e.preventDefault();
    }

    function getStarted() {
        if (client.isAndroid()) {
            console.log("TODO");
        }
    }
</script>

{#snippet logo(label: string = "OpenChat")}
    <div class="logo">
        <div class="img">
            <FancyLoader loop={false} />
        </div>
        <h1>{label}</h1>
    </div>
{/snippet}

{#snippet orSeparator(label: string = "or")}
    <div class="or-separator">
        <div class="line"></div>
        <div class="label">{label}</div>
        <div class="line"></div>
    </div>
{/snippet}

<div class="view">
    <div class="bg"></div>
    <div class="body">
        <div class="content -landing">
            {@render logo()}
            <h2 class="title">Where web3 communicates</h2>
            <p class="blurb">
                OpenChat is a fully featured chat application running end-to-end on the <a
                    onclick={(e) => openInBrowser(e, iiUrl)}
                    rel="noreferrer"
                    href={iiUrl}>
                    Internet Computer
                </a> blockchain.
            </p>
        </div>
        <div class="buttons">
            <button class="btn" onclick={getStarted}>
                <span class="label">Get started</span>
            </button>
            {@render orSeparator("for more info")}
            <Button cls="btn -hollow" hollow onClick={(e) => openInBrowser(e, ocUrl)}
                >Visit OpenChat Web</Button>
        </div>
    </div>
</div>

<style lang="scss">
    @mixin btn-gradient {
        background: #833ab4;
        background: linear-gradient(
            90deg,
            rgba(131, 58, 180, 1) 0%,
            rgba(253, 29, 29, 1) 75%,
            rgba(252, 176, 69, 1) 100%
        );
    }

    .view {
        display: flex;
        flex-direction: column;
        position: relative;
        width: 100%;
        height: 100vh;
        overflow: hidden;
        justify-content: flex-end;
    }

    .bg {
        z-index: 0;
        filter: blur(8px);
        position: absolute;
        /* scale up to hide the halo effect that happens with blured elements */
        top: -50px;
        right: -40px;
        bottom: -10px;
        left: -20px;
        background-size: contain;
        background-position-y: -255px;
        background-repeat: no-repeat;
        background-image: url("/assets/screenshots/intro_light.png");

        @media (prefers-color-scheme: dark) {
            background-image: url("/assets/screenshots/intro_dark.png");
        }

        contain: paint; /* Prevents blur overflow from affecting layout */
        pointer-events: none;
    }

    .body {
        z-index: 1;
        display: flex;
        flex-direction: column;
        height: 70vh;
        gap: $sp8;
        padding: $sp6 $sp6 $sp8;
        background-color: var(--landing-bg);
        border-radius: 2rem 2rem 0 0;
        box-shadow: 0 -1.5rem 2.5rem rgb(77 108 188);

        @media (prefers-color-scheme: dark) {
            box-shadow: 0 -1.5rem 2.5rem rgb(70 69 69);
        }

        .content {
            display: flex;
            flex-direction: column;
            gap: $sp5;
            margin-top: auto;
        }
    }

    .logo {
        gap: $sp3;
        display: flex;
        flex-direction: row;
        align-items: center;
    }

    .btn {
        display: flex;
        padding: 0.5rem 2rem;
        border: none;
        min-height: 45px;
        align-items: center;
        border-radius: 0.25rem;
        color: white;

        @include btn-gradient;

        &.-has-icon {
            padding-left: 0.75rem;
        }

        .icon {
            width: 1.45rem;
            height: 1.45rem;

            &.-passkey img {
                filter: invert(1);
            }

            &.-ii {
                background-color: #fff;
                border-radius: 50px;

                :global {
                    > img {
                        width: 18px;
                    }
                }
            }
        }

        .label {
            flex: 1;
        }
    }

    .buttons {
        display: flex;
        flex-direction: column;
        gap: $sp3;

        :global {
            button {
                font-size: 1.2rem;

                &.back-btn {
                    color: var(--txt-light);
                }

                &.hollow {
                    border-width: calc(1rem * 0.2);
                }
            }
        }
    }

    .or-separator {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 1rem 0;
        gap: 1rem;

        .line {
            flex: 1;
            height: 1px;
            background-color: var(--progress-bd);
        }
    }

    .content.-landing {
        .logo {
            .img {
                height: 36px;
                width: 36px;
            }

            h1 {
                @include font(bold, normal, fs-220);
            }
        }

        .title {
            @include font(medium, normal, fs-230);
        }

        .blurb {
            color: var(--landing-txt-light);
            @include font(bold, normal, fs-120, 32);
        }
    }
</style>
