<script lang="ts">
    import Feature from "./Feature.svelte";
    import { communityThemes, themeStore, themes } from "../../theme/themes";

    import { mobileWidth, toPixel, availableHeight } from "../../stores/screenDimensions";

    let scrollTop = 0;
    let phoneBorder = 5;
    let windowHeight = window.innerHeight;
    let menuHeight = toPixel(5);

    // all the crazy calculations
    $: sectionHeight = $availableHeight;
    $: phoneHeight = $mobileWidth ? $availableHeight * 0.7 : 600;
    $: phoneTop = (sectionHeight - phoneHeight) / 2 + menuHeight;
    $: phoneWidth = phoneHeight * 0.56;
    $: cssHeight = phoneHeight + phoneBorder * 2;
    $: cssWidth = phoneWidth + phoneBorder * 2;
    $: scrollOffset = (sectionHeight - cssHeight) / 2;

    const black = "#242834";

    function onScroll() {
        scrollTop = window.scrollY;
    }

    function clamp(n: number) {
        if (n < 0) return 0;
        if (n > phoneHeight) return phoneHeight;
        return n;
    }

    const screenshotMap: Record<string, { url: string; alt: string }[]> = {};

    [...communityThemes, themes.dark, themes.light].forEach((theme) => {
        screenshotMap[theme.name] = [
            { url: "../assets/screenshots/mobilefirst.png", alt: "mobile first" },
            { url: "../assets/screenshots/creategroup1.png", alt: "create group" },
            { url: "../assets/screenshots/permissions.png", alt: "group permissions" },
            { url: "../assets/screenshots/whatshot.gif", alt: "find groups to join" },
            { url: "../assets/screenshots/userprofile.gif", alt: "user profile" },
            { url: "../assets/screenshots/messages.gif", alt: "sending messages" },
            { url: "../assets/screenshots/search.gif", alt: "searching" },
            { url: `../assets/screenshots/voting_${theme.mode}.png`, alt: "voting" },
        ];
    });

    $: screenshots = screenshotMap[$themeStore.name] ?? [];
</script>

<svelte:window bind:innerHeight={windowHeight} on:scroll={onScroll} />

<div
    class="phone"
    style={`top: ${phoneTop}px; height: ${cssHeight}px; width: ${cssWidth}px; transform: translateX(${cssWidth}px)`}>
    {#each screenshots as screenshot, i}
        <div
            style={`height: ${
                i === 0 ? phoneHeight : clamp(scrollTop - (scrollOffset + sectionHeight * (i - 1)))
            }px`}
            class="feature-img-container">
            <img class="feature-img" src={screenshot.url} alt={screenshot.alt} />
        </div>
    {/each}
</div>

<div class="content">
    <Feature height={sectionHeight} backgroundColor={"transparent"} title={"Mobile first"}>
        <p>
            A chat app should be used on the go and so OpenChat was designed from the beginning to
            work well first and foremost on your mobile device.
        </p>
        <p>
            The user interface will respond to give a seamless experience on devices of any size
            from mobile to desktop.
        </p>
    </Feature>

    <Feature height={sectionHeight} backgroundColor={"#FF005C"} color={"#ffffff"} title={"Groups"}>
        <p>
            Create private groups with friends and family to coordinate and chat together. With a
            private group, you have full control over who is the group.
        </p>
        <p>Or create a public group and share it with the world.</p>
    </Feature>

    <Feature height={sectionHeight} backgroundColor={"#FEC000"} color={black} title={"Permissions"}>
        <p>
            Permissions are assigned to different types of users. As the group owner you will decide
            who gets admin or moderator privileges. This will allow them to help you moderate the
            group to make sure it works the way you want.
        </p>
    </Feature>

    <Feature
        height={sectionHeight}
        backgroundColor={"#08AEDB"}
        color={black}
        title={"Finding groups"}>
        <p>Select the "What's hot" menu option to find popular groups.</p>
        <p>
            Or simply search from the universal search box to preview or join the group from there.
        </p>
    </Feature>

    <Feature
        height={sectionHeight}
        backgroundColor={"#673BB7"}
        color={"#ffffff"}
        title={"User profile"}>
        <p>Configure your personal information, UI settings and chat settings at any time.</p>

        <p>Manage your crypt accounts and account storage.</p>

        <p>View your own personl stats. Get messaging!</p>
    </Feature>

    <Feature
        height={sectionHeight}
        backgroundColor={"#05B09F"}
        color={black}
        title={"Sending messages"}>
        <p>
            Sending messages is the heart of any chat app. OpenChat provides all of the features
            that you would expect and adds a few unique capabilities of its own.
        </p>
    </Feature>

    <Feature height={sectionHeight} backgroundColor={"#FF8541"} color={"#ffffff"} title={"Search"}>
        <p>
            Search globally for users, messages or public groups right from the universal search box
            below the user panel.
        </p>

        <p>You can also search for messages within any selected chat.</p>
    </Feature>

    <Feature height={sectionHeight} backgroundColor={"transparent"} title={"Proposal voting"}>
        <p>
            A unique feature of OpenChat is that it allows you to vote directly on NNS and (soon)
            SNS proposals.
        </p>

        <p>
            Simply register your OpenChat account as a hotkey for the neuron that you wish to vote
            with and join the relevant public group.
        </p>
    </Feature>
</div>

<style lang="scss">
    p {
        @include font(light, normal, fs-120, 28);
        margin-bottom: toRem(24);
    }

    .phone {
        pointer-events: none;
        overflow: hidden;
        display: block;
        position: fixed;
        right: 40%;
        border: 5px solid var(--landing-phone-bd);
        border-radius: toRem(18);
        @include box-shadow(3);
        @include z-index("phone");
    }

    .feature-img-container {
        display: block;
        position: absolute;
        bottom: 0;
        left: 0;
        @include z-index("phone-image");
        width: 100%;

        .feature-img {
            width: 100%;
            max-width: 100%;
            height: 100%;
            max-height: 100%;
            object-fit: cover;
            object-position: bottom;
        }
    }

    .content {
        position: relative;
        @include z-index("features");
        padding: 0;
    }
</style>
