<script lang="ts">
    import Link from "../Link.svelte";
</script>

<section>
    <h2>Introduction</h2>

    <p>
        OpenChat is about to make the biggest change to how content moderation works on the platform
        since it launched. This post explains what is changing, why we have to do it, how the new
        system works, and what it means for you. Some of it is not optional for us, and we want to
        be completely open about that rather than have it arrive unannounced.
    </p>

    <p>
        The short version: we are introducing an automated system for detecting the worst categories
        of illegal content, backed by human review; we are prohibiting pornography on the platform;
        and we are updating our terms of service to reflect both. These changes will roll out soon,
        and when they do you will be asked to review and accept the updated terms.
    </p>
</section>

<section>
    <h2>Why is this necessary?</h2>

    <p>
        OpenChat is a decentralized application governed by its DAO, but the real world does not
        pause for decentralization. Communication platforms which allow users to share messages and
        media are subject to a growing body of law, and the obligations fall on the real people and
        companies who build and support the platform.
    </p>

    <p>
        The most significant of these for us is the UK Online Safety Act 2023, which is now fully in
        force. Among many other things it requires platforms to assess the risk of illegal content,
        to take proportionate measures against it, and — since April 2026 — to report child sexual
        exploitation and abuse (CSEA) content to the UK National Crime Agency. Alongside the UK
        regime sit equivalent and overlapping obligations elsewhere, including EU law and US federal
        law on the reporting and preservation of child sexual abuse material.
    </p>

    <p>
        These duties are not abstract. OpenChat Labs Ltd — the UK company behind OpenChat's
        development, which performs trust and safety functions for the platform — carries real legal
        exposure if the platform does not meet them. The people building OpenChat should not have to
        choose between working on the product they love and their own legal safety, and the platform
        itself cannot grow, or remain in the app stores, without meeting the standards that
        mainstream distribution requires. Apple and Google both mandate child safety standards, and
        Google Play now requires a published statement of standards against CSEA together with a
        working reporting and enforcement capability behind it.
    </p>
</section>

<section>
    <h2>Why not carry on as we are?</h2>

    <p>
        OpenChat has always had content rules and a reporting mechanism, and for some time we used
        the third-party decentralized moderation service Modclub to review reported content. We have
        to be honest about how that has worked out: it hasn't. Reports frequently went unreviewed,
        outcomes were inconsistent, and in practice the pipeline stopped functioning altogether. A
        moderation system which does not reliably work does not meet our legal obligations, and it
        does not protect our users either.
    </p>

    <p>
        The existing arrangements also predate the Online Safety Act's specific duties. Nothing in
        the old system could detect illegal content proactively, preserve evidence in the way the
        law requires, or make a report to the National Crime Agency. Those capabilities have to be
        built deliberately, and that is what we have done.
    </p>
</section>

<section>
    <h2>What is changing?</h2>

    <p>There are three headline changes:</p>

    <p>
        <strong>1. An automated moderation system with humans in the loop.</strong> Messages sent to public
        groups and channels will be automatically classified for the most serious categories of harmful
        content. Automated detection is backed by human review at every consequential step — more on how
        this works below.
    </p>

    <p>
        <strong>2. Pornography is prohibited.</strong> Until now our guidelines permitted adult content
        in clearly-labelled groups. That position is no longer tenable: our children's risk assessment
        under the Online Safety Act concluded, and the law requires us to act on the conclusion, that
        pornographic content must either be put behind highly effective age assurance or prohibited. Age
        verification is fundamentally at odds with OpenChat's privacy-preserving, no-identity design —
        we do not want to collect your identity documents, and we suspect you do not want to give them
        to us. So we are prohibiting pornographic content, and all other "primary priority content" (content
        encouraging suicide, deliberate self-injury, or eating disorders), on all parts of the platform
        for all users. This also aligns OpenChat's rules with what Apple and Google already require of
        apps distributed through their stores. Owners of existing adult-labelled communities will be notified
        when the updated terms take effect and will have 28 days to remove such content or close.
    </p>

    <p>
        <strong>3. Updated terms of service.</strong> The terms will spell all of this out plainly: what
        is prohibited, what is scanned and what is not, what happens when something is detected, your
        right to contest automated decisions, and what we report to authorities. When the updated terms
        go live, every user will be shown a notice and asked to accept them before continuing to use the
        app.
    </p>
</section>

<section>
    <h2>How the new moderation system works</h2>

    <h3>What gets scanned — and what doesn't</h3>

    <p>
        Only content sent to <em>public</em> groups and channels is automatically classified. This
        is worth stating as plainly as possible:
        <strong>
            private groups, private channels and direct chats are never proactively scanned.</strong
        >
        The content of a private message is only ever classified if one of its recipients reports it.
        This is a deliberate line. The law asks us to take proportionate measures, and proactively scanning
        private conversations would be neither proportionate nor compatible with what OpenChat stands
        for.
    </p>

    <h3>Detection with human review</h3>

    <p>
        Public content is classified automatically for the most serious categories of harm. What
        happens next depends on what is found:
    </p>

    <p>
        <strong>Suspected child sexual abuse material</strong> is removed immediately and the sending
        account is suspended. This is the one case where action precedes human review — the harm of leaving
        such material visible outweighs everything else, and the law effectively requires immediate removal.
        But a human moderator then reviews every such detection. If the moderator finds the automated
        system got it wrong, the action is fully reversed: the message is restored and the suspension
        lifted. If they confirm it, the material is reported to the National Crime Agency, as UK law requires
        of us.
    </p>

    <p>
        <strong>Other prohibited content</strong> (for example pornography, once the prohibition is in
        force) is never actioned automatically. A high-confidence detection creates a report for our moderators,
        a human looks at it, and only a human decision results in removal or suspension. If the moderator
        disagrees with the classifier, nothing happens at all.
    </p>

    <h3>Your right to contest</h3>

    <p>
        If your account is ever suspended by the automated system, the suspension notice tells you
        why, and you have the right to contest the decision and have it reviewed by a human — a
        right you can exercise directly from within the app, even while suspended. This is not just
        good practice; where automated decisions significantly affect people, data protection law
        (GDPR Article 22) guarantees the right to human intervention, and we have built the system
        around that guarantee rather than treating it as an afterthought.
    </p>

    <h3>Evidence, not destruction</h3>

    <p>
        When suspected child sexual abuse material is detected, the law does not just require
        removal — it requires preservation. Destroying detected material would destroy the evidence
        that law enforcement needs to protect real children. So detected material is quarantined in
        access-restricted storage where nobody can view it except designated reviewers, every access
        is permanently logged, and it is retained for the legally required period (about a year)
        before being deleted. It is removed from public view immediately; it is preserved privately
        because the law demands exactly that.
    </p>

    <h3>Reporting to authorities</h3>

    <p>
        Since April 2026, UK law requires providers to report detected CSEA content to the National
        Crime Agency. When our moderators confirm such content, a report is filed, including the
        content and the account data we hold. We hold very little — OpenChat's architecture means we
        have no names, no email addresses, no phone numbers and no IP addresses — and our reports
        say exactly that. But we will comply with this duty fully.
    </p>

    <h3>What comes later</h3>

    <p>
        We are also working to integrate industry-standard image hash matching, which detects known
        child sexual abuse imagery by comparing image fingerprints against databases maintained by
        child-safety organisations — without anyone ever viewing your images and without any
        detectable content leaving the classification pipeline. This depends on third-party
        approvals which are in progress. Automated filing of authority reports is planned on the
        same basis.
    </p>
</section>

<section>
    <h2>When will this happen?</h2>

    <p>
        The system is built and tested, and will be released in stages. The updated terms and
        guidelines will be published first — that is what this post is preparing you for — followed
        by the platform changes. Automated detection itself is switched on only when the remaining
        pieces are in place: our registration with the National Crime Agency's reporting portal and
        our third-party service agreements. We are deliberately not enabling detection before the
        legal and operational scaffolding around it is complete, because half-launching a system
        like this would be worse than not launching it. Realistically: soon, in a matter of weeks
        rather than months.
    </p>
</section>

<section>
    <h2>What does this mean for the average user?</h2>

    <p>For almost everyone, almost nothing changes day to day — except for the better.</p>

    <p>
        Your private conversations remain private, exactly as before. Public spaces become safer and
        more consistently moderated, with rules that are actually enforced and enforcement that is
        actually reviewable. If you ever get caught on the wrong end of an automated mistake, you
        have a real, guaranteed path to a human being who can fix it — which is more than most big
        platforms offer.
    </p>

    <p>
        If you post pornographic content, OpenChat will no longer be the platform for that, and
        adult-labelled communities will be wound down over the transition period.
    </p>

    <p>
        More broadly, this is OpenChat growing up. A platform that aspires to be a mainstream,
        self-sovereign alternative to the big messaging apps has to be safe, lawful and
        distributable through the app stores — and has to protect the people who build it. These
        changes make OpenChat compliant with the laws that apply to it, fit for the app stores'
        child-safety requirements, and safer for every user and every community on it. We think that
        is the foundation the next phase of OpenChat's growth gets built on.
    </p>

    <p>
        As ever, we welcome your questions and feedback — find us in the
        <Link path="community">OpenChat community</Link>.
    </p>
</section>
