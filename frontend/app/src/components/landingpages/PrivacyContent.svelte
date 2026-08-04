<script lang="ts">
    import { locationStore } from "@client";
    import { copyToClipboard } from "../../utils/urls";
    import HashLinkTarget from "./HashLinkTarget.svelte";

    function onCopyUrl(e: Event, section: string): void {
        e.stopPropagation();
        copyToClipboard(`${window.location.origin}${$locationStore}?section=${section}`);
    }
</script>

<div class="preamble">
    <p>
        This notice explains what personal data is processed when you use the OpenChat Platform, why
        it is processed, who it is shared with and what rights you have. It supplements the
        <a href="/terms">OpenChat Terms and Conditions</a>, and should be read alongside clause B 6
        of those Terms, which describes safety, moderation and reporting.
    </p>

    <p>
        The OpenChat Platform runs entirely on the Internet Computer blockchain. That has real
        consequences for your privacy which are explained in section 3, and which differ from those
        of a conventional messaging service.
    </p>
</div>

<div class="section">
    <HashLinkTarget {onCopyUrl} id="1">
        <h2>1. Who is responsible for your data</h2>
    </HashLinkTarget>

    <ul class="custom_list" style={"--prefix: '1.'"}>
        <li>
            The OpenChat Platform is operated by OpenChat DAO, a decentralised autonomous
            organisation running on the Internet Computer. OpenChat DAO is the controller in respect
            of the ordinary operation of the OpenChat Platform.
        </li>
        <li>
            Moderation, enforcement and other safety functions, including reporting to authorities,
            are performed by
            <a href="https://openchatlabs.org" target="_blank" rel="noreferrer noopener"
                >OpenChat Labs Ltd</a
            >, a company registered in England and Wales with company number 14871398 ("<strong
                >OpenChat Labs</strong
            >"). OpenChat Labs is the controller in respect of the processing described in section 5
            of this notice.
        </li>
        <li>
            OpenChat Labs is the contact point for this notice as a whole, including for the
            processing OpenChat DAO controls: a decentralised autonomous organisation cannot
            receive correspondence directly, so requests which concern the ordinary operation of
            the OpenChat Platform are received and acted on by OpenChat Labs.
        </li>
        <li>
            You can contact OpenChat Labs about anything in this notice, including any request to
            exercise your rights, at <strong>safety@openchatlabs.org</strong>. That address does not
            require access to an OpenChat account.
        </li>
    </ul>
</div>

<div class="section">
    <HashLinkTarget {onCopyUrl} id="2">
        <h2>2. What we process</h2>
    </HashLinkTarget>

    <ul class="custom_list" style={"--prefix: '2.'"}>
        <li>
            <strong>Account identifiers.</strong> When you register, an Internet Identity principal
            and an OpenChat user identifier are associated with your account, together with the
            username, and any display name and profile image you choose. These identifiers are
            pseudonymous: they are not linked by us to your legal identity.
        </li>
        <li>
            <strong>Content you send.</strong> Messages, media and reactions you send, and the
            groups, communities and channels you belong to.
        </li>
        <li>
            <strong>Account activity.</strong> Records needed to operate the Platform, such as
            Diamond membership status and payments, wallet transactions you initiate, referrals,
            achievements, activity streaks and the version of the Terms you have accepted and when.
        </li>
        <li>
            <strong>Safety records.</strong> Where content is reported or detected, a moderation
            record is created. This is described in section 5.
        </li>
        <li>
            <strong>What we do not collect.</strong> By design, the OpenChat Platform does not
            collect IP addresses, email addresses or phone numbers, and the canisters which run the
            Platform never receive them. This is architectural rather than a policy choice: we
            cannot produce this data, including in response to a lawful request from an authority.
        </li>
    </ul>
</div>

<div class="section">
    <HashLinkTarget {onCopyUrl} id="3">
        <h2>3. What running on a blockchain means for your data</h2>
    </HashLinkTarget>

    <ul class="custom_list" style={"--prefix: '3.'"}>
        <li>
            Your data is held in canister smart contracts on the Internet Computer, and is
            replicated across the independently operated nodes of the subnet hosting each canister.
            Node providers necessarily hold a copy of that replicated state.
        </li>
        <li>
            Content posted to public groups, communities and channels is publicly readable by
            anyone, including people who do not have an OpenChat account, and may be copied,
            indexed or retained by third parties beyond our control.
        </li>
        <li>
            Messages are not end-to-end encrypted. Message content is held in the canisters which
            host the relevant chat.
        </li>
        <li>
            Deleting a message removes its content from the canister which holds it. Data which has
            already been replicated, copied or archived elsewhere - including by other users, by
            node providers, or in the case of public content by anyone who has read it - cannot be
            recalled by us. Where content is preserved as evidence under section 5, deletion is
            deferred for the period described there.
        </li>
    </ul>
</div>

<div class="section">
    <HashLinkTarget {onCopyUrl} id="4">
        <h2>4. Why we process it, and on what legal basis</h2>
    </HashLinkTarget>

    <ul class="custom_list" style={"--prefix: '4.'"}>
        <li>
            <strong>To provide the Platform</strong> - delivering your messages, maintaining your
            account, groups and memberships, and processing Diamond membership and wallet
            operations you initiate. Legal basis: performance of our contract with you (Article
            6(1)(b) UK GDPR).
        </li>
        <li>
            <strong>To keep the Platform working and secure</strong> - preventing abuse, spam and
            attacks on the service. Legal basis: our legitimate interests in the security and
            integrity of the Platform (Article 6(1)(f)).
        </li>
        <li>
            <strong>To meet our safety obligations</strong> - the moderation, evidence preservation
            and authority reporting described in section 5. Legal basis: compliance with legal
            obligations to which OpenChat Labs is subject (Article 6(1)(c)), including the UK Online
            Safety Act 2023.
        </li>
    </ul>
</div>

<div class="section">
    <HashLinkTarget {onCopyUrl} id="5">
        <h2>5. Safety, moderation and automated decisions</h2>
    </HashLinkTarget>

    <ul class="custom_list" style={"--prefix: '5.'"}>
        <li>
            <strong>Classification.</strong> Messages sent to public groups and channels, including
            text and media, are automatically classified for safety purposes. Private messages are
            never proactively scanned; the content of a private message is classified only if a
            recipient reports it. What is sent to the classification provider is the message text
            and the addresses of any attached media - no account identifiers, chat identifiers or
            message identifiers are sent.
        </li>
        <li>
            <strong>The logic involved.</strong> The classifier returns a set of content categories
            and a confidence score for each. Where content is classified as child sexual abuse
            material, it is removed immediately and the sending account is suspended, before any
            human sees it, and the case is then put to a human moderator. Where content is
            classified in any other prohibited category above a configured confidence threshold, it
            is referred to a human moderator and nothing happens to the content or the account
            unless that moderator upholds the referral. A moderator can uphold a case, uphold it as
            child sexual abuse material, or dismiss it.
        </li>
        <li>
            <strong>Consequences.</strong> The consequences of an upheld case are removal of the
            content and suspension of the account - for a fixed period, or indefinitely for child
            sexual abuse material or repeated violations. A dismissed case is reversed in full: the
            content is restored, the suspension is lifted, and you are told the decision and why.
        </li>
        <li>
            <strong>Your right to human review.</strong> Where a decision affecting your account was
            made by an automated system, you have the right under Article 22 UK GDPR not to be
            subject to it: you may contest it and require that a person reviews it. The means to do
            so is provided with the sanction notice and remains available while your account is
            suspended.
        </li>
        <li>
            <strong>Criminal offence data.</strong> Moderation necessarily involves processing data
            relating to suspected criminal offences. OpenChat Labs processes this under Article 10
            UK GDPR and the substantial public interest conditions in Schedule 1 to the Data
            Protection Act 2018, in particular the prevention and detection of unlawful acts and the
            protection of children.
        </li>
        <li>
            <strong>Evidence preservation.</strong> Where suspected child sexual abuse material is
            detected, a copy of the media is preserved as evidence in access-restricted storage.
            Access to it is limited to a small number of specifically designated reviewers, every
            access is recorded in a tamper-evident log which identifies the reviewer, and the
            recorded content is never served publicly.
        </li>
        <li>
            <strong>Moderation records.</strong> A record of each case is kept: the content
            concerned, the identifiers of the sender and of anyone who reported it, what the
            classifier returned, what a moderator decided and when, whether the decision was
            contested, and whether a report was made to an authority. Reports which turn out to
            have been false are recorded against the person who made them.
        </li>
    </ul>
</div>

<div class="section">
    <HashLinkTarget {onCopyUrl} id="6">
        <h2>6. Who your data is shared with</h2>
    </HashLinkTarget>

    <ul class="custom_list" style={"--prefix: '6.'"}>
        <li>
            <strong>Other users.</strong> Anyone in a group, community or channel you post to; and,
            for public spaces, the general public.
        </li>
        <li>
            <strong>Internet Computer node providers</strong>, who host the replicated canister
            state as described in section 3.
        </li>
        <li>
            <strong>Safety processors.</strong> Content classification is currently performed by
            OpenAI. Specialist providers, such as services which match images against databases of
            known child sexual abuse material, may be added.
        </li>
        <li>
            <strong>Authorities.</strong> Detected child sexual exploitation and abuse content,
            together with associated account data, is reported to the relevant authorities,
            including the UK National Crime Agency and, where applicable, the US National Center for
            Missing and Exploited Children, as required by law. We may also disclose data in
            response to a lawful request, so far as we hold it - see section 2 for what we do not
            hold.
        </li>
        <li>
            <strong>International transfers.</strong> Internet Computer nodes and our safety
            processors are located in a number of countries, including the United States. Where
            data leaves the UK, transfers are made under the safeguards required by data protection
            law, such as the UK International Data Transfer Agreement or Addendum.
        </li>
    </ul>
</div>

<div class="section">
    <HashLinkTarget {onCopyUrl} id="7">
        <h2>7. How long it is kept</h2>
    </HashLinkTarget>

    <ul class="custom_list" style={"--prefix: '7.'"}>
        <li>
            Account data is kept while your account exists. Message content is kept until it is
            deleted, subject to section 3.
        </li>
        <li>
            Preserved child sexual abuse material evidence is kept for the period required by law -
            typically one year from the report to an authority - and is then deleted automatically.
            Where a legal preservation request applies, deletion is suspended until that request is
            lifted; where an authority requires destruction, the evidence is destroyed on request.
            The access log, which contains no content, survives the evidence it records.
        </li>
        <li>
            Moderation records and records of reports made to authorities are kept for as long as
            needed to evidence compliance with our safety duties.
        </li>
    </ul>
</div>

<div class="section">
    <HashLinkTarget {onCopyUrl} id="8">
        <h2>8. Your rights</h2>
    </HashLinkTarget>

    <ul class="custom_list" style={"--prefix: '8.'"}>
        <li>
            You have the right to ask for access to your personal data, to have inaccurate data
            corrected, to have data erased, to restrict or object to processing, to data
            portability, and not to be subject to solely automated decisions with significant
            effects. To exercise any of these, contact <strong>safety@openchatlabs.org</strong>.
        </li>
        <li>
            Some of these rights are limited in ways you should understand before relying on them.
            We cannot erase data which has already been replicated across node providers, copied by
            other users, or published publicly. We cannot erase or restrict preserved evidence or
            moderation records where doing so would breach our legal obligations. Where a matter has
            been reported to an authority, we may be prevented by law from confirming that fact to
            you.
        </li>
        <li>
            If you are unhappy with how your data has been handled, you may complain to us at
            <strong>safety@openchatlabs.org</strong> or to the UK Information Commissioner's Office
            at
            <a href="https://ico.org.uk" target="_blank" rel="noreferrer noopener">ico.org.uk</a>.
        </li>
    </ul>
</div>

<div class="section">
    <HashLinkTarget {onCopyUrl} id="9">
        <h2>9. Changes to this notice</h2>
    </HashLinkTarget>

    <ul class="custom_list" style={"--prefix: '9.'"}>
        <li>
            We may update this notice. Where a change materially affects how your data is processed,
            we will bring it to your attention in the OpenChat Platform.
        </li>
    </ul>
</div>

<style lang="scss">
    .preamble {
        margin-bottom: $sp5;
    }

    .section {
        margin-bottom: $sp5;

        h2 {
            @include font(bold, normal, fs-120);
            margin-bottom: $sp4;
        }

        .custom_list {
            --suffix: "";
            list-style-type: none;
            counter-reset: item;
            @include font(book, normal, fs-100);
            margin-bottom: $sp5;
        }

        .custom_list > li {
            padding-left: 60px;
            position: relative;
            margin-bottom: $sp3;
        }

        .custom_list > li::before {
            content: var(--prefix) counter(item) var(--suffix);
            counter-increment: item;
            font-weight: normal;
            position: absolute;
            left: 0;
        }
    }
</style>
