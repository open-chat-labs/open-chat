<script lang="ts">
    import CollapsibleCard from "../CollapsibleCard.svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import { location } from "../../routes";
    import { copyToClipboard } from "../../utils/urls";
    import Copy from "svelte-material-icons/ContentCopy.svelte";

    export let linked: number | undefined = undefined;
    export let modal: boolean = false;

    function copyUrl(section: string): void {
        copyToClipboard(`${window.location.origin}${$location}?section=${section}`);
    }

    $: copySize = $mobileWidth ? "14px" : "16px";
    $: color = modal ? "var(--txt)" : "var(--landing-txt)";
</script>

<CollapsibleCard transition={false} first open={linked === 1}>
    <div class:modal class="header" slot="titleSlot">
        <span class="subtitle">1</span>
        <div class="title">
            Introduction
            <div class="copy" on:click|stopPropagation={() => copyUrl("1")}>
                <Copy size={copySize} {color} />
            </div>
        </div>
    </div>
    <div class:modal class="body">
        <p>
            OpenChat aims to be an open, productive, enjoyable and safe place for everyone to come
            together, create and share content and chat. To preserve these values we ask that users
            of the system comply with a set of common sense guidelines.
        </p>

        <p>
            All content posted by users on OpenChat is user-generated content, and OpenChat does not
            control or endorse the content posted by users. Content that does not comply with our
            guidelines may be removed by platform moderators and the users that post such content
            may be suspended.
        </p>
    </div>
</CollapsibleCard>

<CollapsibleCard transition={false} open={linked === 2}>
    <div class:modal class="header" slot="titleSlot">
        <span class="subtitle">2</span>
        <div class="title">
            High level guidance
            <div class="copy" on:click|stopPropagation={() => copyUrl("2")}>
                <Copy size={copySize} {color} />
            </div>
        </div>
    </div>
    <div class:modal class="body">
        <p>
            OpenChat is not owned by anyone and does not operate in any particular jurisdiction and
            so our rules simply revolve around protecting the service and protecting the users. Ask
            yourself - does my post threaten the existence of the system itself (e.g. would it be
            considered illegal in most jurisdictions)? Or is my post harmful to other users (e.g.
            does it promote a scam or invite harassment). These are the high level principles that
            will be applied to moderation.
        </p>

        <p>
            These rules apply to all groups whether public or private but we also take the privacy
            of our users extremely seriously and therefore cannot perform active moderation on
            content in private groups.
        </p>
    </div>
</CollapsibleCard>

<CollapsibleCard transition={false} open={linked === 3}>
    <div class:modal class="header" slot="titleSlot">
        <span class="subtitle">3</span>
        <div class="title">
            Platform rules
            <div class="copy" on:click|stopPropagation={() => copyUrl("3")}>
                <Copy size={copySize} {color} />
            </div>
        </div>
    </div>
    <div class:modal class="body">
        <ul class="list">
            <li>
                <strong>Do not threaten to harm another individual or group of people.</strong> This
                includes direct, indirect, and suggestive threats.
            </li>

            <li>
                <strong>
                    Do not solicit, share, or make attempts to distribute content that depicts,
                    promotes, or attempts to normalize child sexual abuse.
                </strong> Also, do not post content that in any way sexualizes children.
            </li>

            <li>
                <strong>
                    Do not share sexually explicit or sexually suggestive content of other people
                    without the subject’s knowledge and consent, otherwise known as “revenge porn.”
                </strong>
                This includes the non-consensual distribution of intimate media that was created either
                with or without an individual’s consent.
            </li>

            <li>
                <strong>
                    Do not intentionally share false or misleading information (otherwise known as
                    misinformation).
                </strong>
            </li>

            <li>
                <strong>Do not impersonate others in a deceptive or misleading manner.</strong>
            </li>

            <li>
                <strong>
                    Do not share content that glorifies, promotes, or normalizes suicide or other
                    acts of physical self-harm.
                </strong> This includes content that encourages others to cut, burn, or starve themselves,
                as well as content that normalizes eating disorders, such as anorexia and bulimia. Self-harm
                acts or threats used as a form of emotional manipulation or coercion are also prohibited.
            </li>

            <li>
                <strong>
                    Do not share real media depicting gore, excessive violence, or animal harm,
                    especially with the intention to harass or shock others.
                </strong>
            </li>

            <li>
                <strong
                    >Do not use OpenChat to promote, coordinate, or execute financial scams.</strong>
            </li>
        </ul>
    </div>
</CollapsibleCard>

<CollapsibleCard transition={false} open={linked === 4}>
    <div class:modal class="header" slot="titleSlot">
        <span class="subtitle">4</span>
        <div class="title">
            Group rules
            <div class="copy" on:click|stopPropagation={() => copyUrl("4")}>
                <Copy size={copySize} {color} />
            </div>
        </div>
    </div>
    <div class:modal class="body">
        <p>
            In addition to the platform rules, we urge group owners to enable group rules and make
            it very clear what standards you expect to be upheld in your group. When you join a
            group, please read those rules carefully and keep in mind that they will be consulted in
            moderation decisions.
        </p>

        <p>
            Group owners are also encouraged to create a trusted team of admins that are prepared to
            help to moderate the group.
        </p>

        <p>
            While adult material is not against our platform guidelines, we feel it is important
            that such content is clearly labelled. We ask therefore that if you would like to post
            adult material (that complies with the platform rules above) that <strong>
                you must enable group rules and you must specify in the group rules that the group
                contains adults only material.
            </strong> This ensures that a user joining the group can only do so having first been informed
            of the nature of the group and acknowledging that information.
        </p>

        <p>
            Please do not post adult material in a public group that has not been clearly labelled
            in this way. This way, we can keep people safe and comfortable without undue
            restrictions.
        </p>
    </div>
</CollapsibleCard>

<CollapsibleCard transition={false} open={linked === 5}>
    <div class:modal class="header" slot="titleSlot">
        <span class="subtitle">5</span>
        <div class="title">
            Content moderation process
            <div class="copy" on:click|stopPropagation={() => copyUrl("5")}>
                <Copy size={copySize} {color} />
            </div>
        </div>
    </div>
    <div class:modal class="body">
        <p>
            If you see content in a public group which you think violates the group's rules then
            your first option should be to appeal to the group owners. If you feel like content
            violates the platform rules, you should report the content to the platform moderators
            via the message’s context menu.
        </p>

        <p>The message content will then be referred to the platform moderators for review.</p>

        <p>
            The platform moderators will refer to the platform and group rules and make a decision
            on the action to take as a group. The action taken may be one or more of the following:
        </p>
        <ul class="list">
            <li>Delete the content</li>
            <li>Freeze the group</li>
            <li>Delete the group</li>
            <li>Suspend the user who posted the content</li>
        </ul>
        <p>
            We rely significantly on judgement and good intentions of those involved at this stage.
            In the future we hope and plan to further align incentives through tokenization. For
            example, a report which is upheld could be rewarded with tokens. Also platform
            moderators who vote with the consensus should be rewarded with tokens.
        </p>

        <p>We can also envisage using tokenization to disincentivize spurious reports.</p>
    </div>
</CollapsibleCard>

<CollapsibleCard transition={false} open={linked === 6}>
    <div class:modal class="header" slot="titleSlot">
        <span class="subtitle">6</span>
        <div class="title">
            Governance
            <div class="copy" on:click|stopPropagation={() => copyUrl("6")}>
                <Copy size={copySize} {color} />
            </div>
        </div>
    </div>
    <div class:modal class="body">
        <p>
            An alternative view is that content moderation should only be done via SNS proposal. Our
            view is that an SNS proposal is designed to (agree to) <em>change the system</em> in some
            way. Moderation does not require a change to the system. It merely requires the use of existing
            tools and mechanisms. The exact nature of those tools and mechanisms should of course be
            under the control of the SNS and managed by SNS proposal. For example, it would be appropriate
            to make a proposal to change these guidelines or to appoint a new platform moderator.
        </p>

        <p>
            Furthermore, to attempt to perform moderation via proposal would force everyone to be a
            moderator and that is not a job that everyone wants or should be expected to perform. As
            such we believe that it is better to have a clear set of guidelines so that platform
            moderators can make quick and fair decisions.
        </p>
    </div>
</CollapsibleCard>

<style type="text/scss">
    .body {
        padding: 0 0 toRem(30) toRem(80);
        max-width: 75%;
        color: var(--landing-txt);

        @include mobile() {
            padding: 0 0 toRem(24) 0;
            max-width: 100%;
        }

        &.modal {
            color: var(--txt);
            padding: 0 0 toRem(20) toRem(60);
            @include mobile() {
                padding: 0 0 toRem(15) 0;
            }
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

        &.modal {
            color: var(--txt);
            @include font(medium, normal, fs-120, 38);
            @include mobile() {
                @include font(medium, normal, fs-100, 24);
            }
        }
    }

    .subtitle {
        flex: 0 0 toRem(80);

        @include mobile() {
            flex: 0 0 toRem(30);
        }
    }

    .modal .subtitle {
        flex: 0 0 toRem(60);

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
</style>
