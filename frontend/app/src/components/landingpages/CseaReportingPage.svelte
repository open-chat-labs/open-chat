<script lang="ts">
    import { platformModeratorStore, platformOperatorStore, querystringStore } from "@client";
    import { onMount } from "svelte";
    import CseaChecklistItem from "./CseaChecklistItem.svelte";
    import Headline from "./Headline.svelte";

    type Origin = "hash" | "manual";
    type Priority = 1 | 2 | 3;

    let report = $derived($querystringStore.get("report") ?? undefined);
    let urgentHint = $derived($querystringStore.get("urgent") === "true");
    let storageKey = $derived(`csea_checklist_${report ?? "adhoc"}`);

    let origin = $state<Origin | undefined>(undefined);
    let priority = $state<Priority | undefined>(undefined);
    let ticks = $state<Record<string, boolean>>({});
    let loaded = $state(false);

    // The current hour in the UK drives the "call after submitting" rule, which applies to
    // P1/P2 reports submitted outside 07:00-17:00 UK time
    let ukHour = $state(currentUkHour());
    let ukTime = $state(currentUkTime());

    function currentUkHour(): number {
        return Number(
            new Intl.DateTimeFormat("en-GB", {
                timeZone: "Europe/London",
                hour: "numeric",
                hour12: false,
            }).format(new Date()),
        );
    }

    function currentUkTime(): string {
        return new Intl.DateTimeFormat("en-GB", {
            timeZone: "Europe/London",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        }).format(new Date());
    }

    onMount(() => {
        const interval = window.setInterval(() => {
            ukHour = currentUkHour();
            ukTime = currentUkTime();
        }, 60_000);
        return () => window.clearInterval(interval);
    });

    let outsideHours = $derived(ukHour < 7 || ukHour >= 17);
    let callRequired = $derived((priority === 1 || priority === 2) && outsideHours);

    let authorized = $derived($platformModeratorStore || $platformOperatorStore);

    // Load any saved state for this report once, then persist every change
    $effect(() => {
        const saved = localStorage.getItem(storageKey);
        if (saved !== null) {
            try {
                const parsed = JSON.parse(saved);
                origin = parsed.origin;
                priority = parsed.priority;
                ticks = parsed.ticks ?? {};
            } catch {
                // ignore corrupt state
            }
        }
        loaded = true;
    });

    $effect(() => {
        const state = JSON.stringify({ origin, priority, ticks });
        if (loaded) {
            localStorage.setItem(storageKey, state);
        }
    });

    function toggle(id: string) {
        ticks[id] = ticks[id] !== true;
    }

    function reset() {
        origin = undefined;
        priority = undefined;
        ticks = {};
    }

    let tickedCount = $derived(Object.values(ticks).filter((v) => v).length);
</script>

<div class="csea">
    <Headline>Manual NCA report checklist</Headline>

    {#if !authorized}
        <div class="restricted">
            <p>
                This page is a procedural checklist for OpenChat platform moderators filing reports
                with the National Crime Agency. If you believe you are seeing this in error, make
                sure you are signed in to your moderator account in this browser.
            </p>
            <p>
                If you have encountered child sexual abuse material on OpenChat, please report the
                message in the app, or report directly to the police, the NCA (<a
                    href="https://www.nca.gov.uk">nca.gov.uk</a
                >), or the Internet Watch Foundation (<a href="https://report.iwf.org.uk"
                    >report.iwf.org.uk</a
                >).
            </p>
        </div>
    {:else}
        <div class="toolbar">
            <span class="progress">
                {#if report !== undefined}
                    Report #{report} &middot;
                {/if}
                {tickedCount} item{tickedCount === 1 ? "" : "s"} checked
            </span>
            <button class="reset" onclick={reset}>Reset checklist</button>
        </div>

        <p class="intro">
            Filing a report on the NCA's Child Sexual Exploitation and Abuse Industry Reporting
            Portal (CSEA-IRP) by hand. Work top to bottom — progress is saved in this browser.
            Report <strong>as soon as reasonably practicable — same day wherever possible</strong>;
            the report never waits for an internal verdict on the material.
        </p>

        <section>
            <h2><span class="num">1</span> Before you start</h2>
            <CseaChecklistItem id="prep-reviewer" {ticks} onToggle={toggle}>
                You are a <strong>designated vault reviewer</strong>. If you are not, stop here and
                hand the case to one immediately. Do not view, download, or copy anything — the
                incident protocol's absolute rules (never view, never copy, never visit reported
                URLs) bind everyone who is not a designated reviewer.
            </CseaChecklistItem>
            <CseaChecklistItem id="prep-creds" {ticks} onToggle={toggle}>
                You have the CSEA-IRP portal credentials and the <strong
                    >organisation reference number</strong
                > to hand (password manager). The reference number is needed if you have to phone the
                NCA.
            </CseaChecklistItem>
        </section>

        <section>
            <h2><span class="num">2</span> How was this detected?</h2>
            <p>
                This changes how the material itself is handled in step 6 — everything else is the
                same.
            </p>
            <div class="choice">
                <button class:selected={origin === "hash"} onclick={() => (origin = "hash")}>
                    <strong>Hash match</strong>
                    <span>
                        PhotoDNA match or a blocked re-upload of denylisted material. The report
                        carries the original hash and metadata — the NCA matches the hash on their
                        side, so nobody needs to view or handle the material.
                    </span>
                </button>
                <button class:selected={origin === "manual"} onclick={() => (origin = "manual")}>
                    <strong>Manual assertion</strong>
                    <span>
                        A user report, a third-party report, or moderator discovery. The portal
                        requires the material itself to be uploaded, so the controlled-handling
                        steps in section 6 apply.
                    </span>
                </button>
            </div>
        </section>

        <section>
            <h2><span class="num">3</span> Priority level</h2>
            {#if urgentHint}
                <p class="note">
                    This report was marked <strong>urgent</strong> in OpenChat, which usually means Priority
                    1 or 2 — but make the call against the definitions below, not the flag.
                </p>
            {/if}
            <div class="choice vertical">
                <button class:selected={priority === 1} onclick={() => (priority = 1)}>
                    <strong>Priority 1 — current or immediate risk to an individual</strong>
                    <span>
                        A real and immediate threat to life or of serious harm or injury, including
                        serious sexual assault and rape; or a child needs immediate safeguarding
                        because abuse is taking place now or is imminent.
                    </span>
                </button>
                <button class:selected={priority === 2} onclick={() => (priority = 2)}>
                    <strong>Priority 2 — possible risk in the near future, or time-sensitive</strong
                    >
                    <span>
                        Safeguarding action is needed urgently but there is no immediate threat:
                        suspected contact offending, content indicating recently generated images,
                        or a child who has produced self-generated material or has sent or received
                        child sexual abuse material. Most credible manual reports of fresh,
                        non-hash-matched material belong here.
                    </span>
                </button>
                <button class:selected={priority === 3} onclick={() => (priority = 3)}>
                    <strong>Priority 3 — other</strong>
                    <span>
                        No impending danger to a child: hash-list matches, problematic chat with no
                        material shared, or material shared among known adults where ages are
                        indeterminate and there is no threat to life.
                    </span>
                </button>
            </div>
            {#if priority === 1}
                <div class="warn">
                    <strong>Priority 1 fast path:</strong> submit <em>immediately</em> with whatever
                    information you have to hand. You may select "Data not held" for any mandatory
                    field you do not have <em>yet</em> — getting the report to law enforcement is the
                    priority. File a supplementary report with the rest afterwards, quoting the reference
                    number.
                </div>
            {/if}
        </section>

        <section>
            <h2><span class="num">4</span> Phone rules — know these before you submit</h2>
            <div class="phonebox" class:active={callRequired}>
                {#if priority === undefined}
                    <p>Select a priority above to see whether a call is needed.</p>
                {:else if callRequired}
                    <p>
                        <strong>A call is required after you submit.</strong> It is {ukTime} in the UK
                        — outside 07:00&ndash;17:00. After submitting a Priority
                        {priority} report, call the NCA control centre on
                        <strong><a href="tel:01925663355">01925 663355</a></strong> and give the organisation
                        reference number, so they know a priority report has arrived. That number is for
                        this purpose only.
                    </p>
                {:else if priority === 3}
                    <p>
                        <strong>No call needed.</strong> Priority 3 reports never require a phone call.
                    </p>
                {:else}
                    <p>
                        <strong>No call needed right now.</strong> It is {ukTime} in the UK — inside 07:00&ndash;17:00,
                        so a Priority {priority} report needs no follow-up call. If you end up submitting
                        after 17:00, call the NCA control centre on
                        <strong><a href="tel:01925663355">01925 663355</a></strong> after submitting.
                    </p>
                {/if}
            </div>
            <p>
                <strong>If the portal is unavailable</strong> and this is Priority 1 or 2: download
                and fill in the
                <a href="/assets/nca/nca-p1-p2-contingency-reporting-template-v1.0.pdf" download>
                    Priority 1 &amp; 2 Contingency Reporting Template</a
                >, email it to
                <strong><a href="mailto:DRB@nca.gov.uk">DRB@nca.gov.uk</a></strong>, then call
                <strong><a href="tel:01925663355">01925 663355</a></strong>. Priority 3 waits for
                the portal to come back. Either way, submit the full report through the portal once
                it is restored.
            </p>
            <p>
                Portal <em>technical</em> problems (sign-in, uploads failing) go to the Service and
                Support desk: <a href="tel:03301115047">0330 111 5047</a> (UK),
                <a href="tel:+441615218753">+44 161 521 8753</a> (international), or
                <a href="mailto:support@csea-irp.atlassian.net">support@csea-irp.atlassian.net</a>.
                They cannot discuss the contents of a report.
            </p>
        </section>

        <section>
            <h2><span class="num">5</span> Portal — general report information</h2>
            <p>
                Sign in to the portal at
                <a
                    href="https://www.uk-child-sexual-abuse-industry-reporting.gov.uk/home"
                    target="_blank"
                    rel="noopener noreferrer">uk-child-sexual-abuse-industry-reporting.gov.uk</a
                >, start a new report, and read the Declaration. The report has five sections; this
                checklist follows them in order. Fields marked * on the portal are mandatory — where
                we genuinely do not hold the data, tick the "data not held" box rather than delaying
                or guessing.
            </p>
            <CseaChecklistItem id="gen-prev" {ticks} onToggle={toggle}>
                <strong>Related to a previous report?</strong> Answer Yes for supplementary reports and
                for blocked re-uploads of material we have reported before, and quote the earlier reference
                from the filed-report register. Otherwise No.
            </CseaChecklistItem>
            <CseaChecklistItem id="gen-police" {ticks} onToggle={toggle}>
                <strong>Previously reported to local police?</strong> Usually No. If Yes, provide the
                police reference and officer details if known.
            </CseaChecklistItem>
            <CseaChecklistItem id="gen-contact" {ticks} onToggle={toggle}>
                <strong>Platform and point of contact.</strong> Platform is OpenChat (pre-filled
                from registration). Give <em>your own</em> name, phone number, and email — law enforcement
                must be able to reach a person, not just the portal account.
            </CseaChecklistItem>
            <CseaChecklistItem id="gen-detected-when" {ticks} onToggle={toggle}>
                <strong>Date and time incident detected.</strong> When <em>we</em> detected it — the hash-match
                timestamp or when the user report arrived — not when the content was posted. HH:MM:SS,
                in UTC.
            </CseaChecklistItem>
            <CseaChecklistItem id="gen-detected-who" {ticks} onToggle={toggle}>
                <strong>Who detected the content?</strong>
                {#if origin === "hash"}
                    "An automated detection tool" (the hash-matching service).
                {:else if origin === "manual"}
                    "A user of the platform" for in-app reports, "a third-party reporter" if another
                    organisation or an outside individual told us, or "an employee moderating the
                    platform" for moderator discovery.
                {:else}
                    User of the platform / third-party reporter / automated detection tool /
                    employee moderating the platform — pick the one that matches.
                {/if}
            </CseaChecklistItem>
            <CseaChecklistItem id="gen-reviewed" {ticks} onToggle={toggle}>
                <strong>Has someone in your organisation reviewed the content?</strong> Answer
                truthfully. "No" is a lawful and expected answer — <em>never</em> view material just to
                change this answer. If a designated reviewer has viewed it in the vault, answer Yes.
            </CseaChecklistItem>
            <CseaChecklistItem id="gen-format" {ticks} onToggle={toggle}>
                <strong>Is the content in the original format?</strong> Yes — we never alter stored media.
            </CseaChecklistItem>
            <CseaChecklistItem id="gen-framing" {ticks} onToggle={toggle}>
                <strong>Unverified framing, everywhere free text allows it.</strong> State plainly what
                has and has not been verified, e.g. "User-reported; not viewed or verified by us" or "Automated
                PhotoDNA hash match; not human-verified at the time of this report". Never overstate confidence
                to make a report look stronger — a truthful unverified report is protected; an overstated
                one is not.
            </CseaChecklistItem>
        </section>

        <section>
            <h2><span class="num">6</span> The content detected — and handling the material</h2>
            <p>
                <strong>One sender per report.</strong> If several users posted material in the same chat,
                that is one report per sender, each listing the other participants as recipients. Run
                this checklist once per sender.
            </p>
            <CseaChecklistItem id="content-type" {ticks} onToggle={toggle}>
                <strong>Report content type:</strong> indecent imagery of children / indecent video /
                audio / messaging / viral-meme / URL / multiple / other.
            </CseaChecklistItem>
            <CseaChecklistItem id="content-date" {ticks} onToggle={toggle}>
                <strong>Date and time uploaded to the platform</strong> — from the message metadata, HH:MM:SS,
                in UTC. "File 1" is the file we detected first; add the sender's other offending files
                after it in any order.
            </CseaChecklistItem>
            <CseaChecklistItem id="content-ip" {ticks} onToggle={toggle}>
                <strong>IP address and port of the uploading device:</strong> tick
                <em>data not held</em>. OpenChat does not record IP addresses — this is a
                deliberate, standing declaration, not an oversight. Same for the IP date and time
                fields.
            </CseaChecklistItem>
            <CseaChecklistItem id="content-hash" {ticks} onToggle={toggle}>
                <strong>Original hash of the file:</strong>
                {#if origin === "hash"}
                    provide the original hash of the <em>known</em> image from the matched hash list (this
                    is what lets the NCA match it without the file), plus the match provider and record
                    details in the additional-information field.
                {:else}
                    provide our stored hash of the blob.
                {/if}
            </CseaChecklistItem>
            <CseaChecklistItem id="content-url" {ticks} onToggle={toggle}>
                <strong>URL of the reported content at the point of upload:</strong> the blob URL the
                media was served from when it was uploaded, pasted as text. This is a historical fact
                — the URL no longer resolves once the media is quarantined, and that is the expected answer.
                Say so in the additional-information field: "URL no longer resolves — media was quarantined
                by the platform on detection." Do not open it to check it.
            </CseaChecklistItem>
            <CseaChecklistItem id="content-exif" {ticks} onToggle={toggle}>
                <strong>EXIF data:</strong> confirm whether held; provide it if we have it, otherwise
                No.
            </CseaChecklistItem>
            <CseaChecklistItem id="content-group" {ticks} onToggle={toggle}>
                <strong>Group chat / chat room:</strong> give the group, channel, or community name. If
                the reported user is an admin or moderator of it, say so in the user section's additional-information
                field.
            </CseaChecklistItem>
            <CseaChecklistItem id="content-chat" {ticks} onToggle={toggle}>
                <strong>Illegal chat with no media:</strong> if the report is about messages rather than
                media, upload a copy of the entire chat between the sender and the recipient(s) — the
                text excerpt we hold, plus context.
            </CseaChecklistItem>
            <CseaChecklistItem id="content-more" {ticks} onToggle={toggle}>
                <strong>More information:</strong> the reporter's description verbatim, message links
                as text, and anything else not captured — with the unverified framing from section 5.
            </CseaChecklistItem>

            <h3>Uploading the material itself</h3>
            {#if origin === "hash"}
                <div class="handling">
                    <p>
                        <strong>Nothing to handle.</strong> Do not view the material, do not download
                        it, do not open the blob URL. The original hash from the matched list plus the
                        metadata above is the payload — the NCA matches the hash on their side.
                    </p>
                    <p class="note">
                        If the portal will not accept the report without a file attached, stop and
                        contact the NCA (support desk for portal mechanics, DRB for report content)
                        rather than improvising a download.
                    </p>
                </div>
            {:else if origin === "manual"}
                <div class="handling">
                    <p>
                        The portal requires the material in its original, unedited format. Only a
                        designated reviewer may handle it, only for as long as the submission takes,
                        and the NCA portal (or NCMEC's CyberTipline) is the only destination it may
                        ever be sent to.
                    </p>
                    <CseaChecklistItem id="media-device" {ticks} onToggle={toggle}>
                        Use a machine with <strong>no file-sync or backup agent running</strong>
                        — no iCloud Drive, Dropbox, Google Drive, OneDrive, or cloud backup covering the
                        download location. Sync tools copy files off the machine without asking; deleting
                        later does not undo a copy already taken.
                    </CseaChecklistItem>
                    <CseaChecklistItem id="media-portal-first" {ticks} onToggle={toggle}>
                        Sign in to the portal and get the report to the upload field
                        <strong>before</strong> touching the file, so the handling window is as short
                        as possible.
                    </CseaChecklistItem>
                    <CseaChecklistItem id="media-download" {ticks} onToggle={toggle}>
                        Obtain the file by the approved vault export route, without opening or
                        previewing it. Viewing happens only in the vault viewer under the assessment
                        procedure — it is a separate act with its own rules, not part of filing. If
                        no approved export route is available to you,
                        <strong>stop and escalate</strong> — do not improvise a way to copy the material.
                    </CseaChecklistItem>
                    <CseaChecklistItem id="media-upload" {ticks} onToggle={toggle}>
                        Upload to the portal in the original format, unedited. Supported: any file
                        type except .exe, up to 5&nbsp;GB.
                    </CseaChecklistItem>
                    <CseaChecklistItem id="media-purge" {ticks} onToggle={toggle}>
                        <strong>Immediately after submitting, purge every local copy:</strong>
                        the downloads folder, the browser's download history and cache, the bin/trash,
                        and any preview caches. The submission is complete when no copy remains on the
                        machine.
                    </CseaChecklistItem>
                    <div class="warn">
                        <strong>Never</strong> email the material, screenshot it, print it, put it in
                        any third-party tool, keep a "backup", or send it to anyone other than the NCA
                        portal or NCMEC — including police forces, other agencies, or colleagues. Everyone
                        else gets a report and a reference number, never the file.
                    </div>
                </div>
            {:else}
                <p class="note">
                    Select how this was detected in section 2 to see the handling steps.
                </p>
            {/if}
        </section>

        <section>
            <h2><span class="num">7</span> The user (sender / recipients)</h2>
            <p>
                Status is <strong>sender</strong> for the account that uploaded or sent the
                material, <strong>recipient</strong> for each account that received it. One sender per
                report; recipients can be many.
            </p>
            <CseaChecklistItem id="user-username" {ticks} onToggle={toggle}>
                <strong>What OpenChat holds — provide it all:</strong> the username at the time of the
                incident (plus any previous usernames and display names if known), the user's principal
                as the unique identification number, the profile URL as text, and the profile picture
                and bio if set.
            </CseaChecklistItem>
            <CseaChecklistItem id="user-closure" {ticks} onToggle={toggle}>
                <strong>Account closure:</strong> whether we have suspended or closed the account, when,
                and whether the user was notified. Note any suspicion the account is compromised, with
                reasons.
            </CseaChecklistItem>
            <CseaChecklistItem id="user-additional" {ticks} onToggle={toggle}>
                <strong>Additional information:</strong> admin or moderator status in the group where
                the content appeared, ledger principals or on-chain identifiers if relevant, and anything
                else identifying — unverified framing as always.
            </CseaChecklistItem>
            <CseaChecklistItem id="user-dnh" {ticks} onToggle={toggle}>
                <strong>Tick "data not held" without agonising</strong> for everything OpenChat deliberately
                does not collect: real names, date of birth, email address, phone number, postal and billing
                addresses, bank accounts, cards, payment platforms, identity documents, National Insurance
                numbers, driving licences, IP history, recovery email and phone, device identifiers, biometrics,
                and voice recordings. These declarations are standing statements to the NCA and Ofcom
                about what we do not collect — they are deliberate policy.
            </CseaChecklistItem>
        </section>

        <section>
            <h2><span class="num">8</span> Review, submit, record</h2>
            <CseaChecklistItem id="submit-declaration" {ticks} onToggle={toggle}>
                Read the <strong>Declaration</strong> and confirm it. It affirms that any empty mandatory
                field means the data was not held at the time of submission — only tick it if that is
                true.
            </CseaChecklistItem>
            <CseaChecklistItem id="submit-review" {ticks} onToggle={toggle}>
                On the review page, check accuracy and check the unverified framing is intact
                everywhere. You cannot re-open a report once submitted.
            </CseaChecklistItem>
            <CseaChecklistItem id="submit-reference" {ticks} onToggle={toggle}>
                Submit, and note the <strong>report reference number</strong> immediately (it also appears
                under "Previously submitted reports" on the portal homepage).
            </CseaChecklistItem>
            {#if callRequired}
                <CseaChecklistItem id="submit-call" {ticks} onToggle={toggle}>
                    <strong>Make the phone call now:</strong> NCA control centre,
                    <a href="tel:01925663355">01925 663355</a>, with the organisation reference
                    number (section 4).
                </CseaChecklistItem>
            {/if}
            <CseaChecklistItem id="submit-register" {ticks} onToggle={toggle}>
                Record the filing in OpenChat: back in the report card, use <strong
                    >"Record NCA filing"</strong
                > and enter the portal reference. This is the filed-report register.
            </CseaChecklistItem>
            <CseaChecklistItem id="submit-silence" {ticks} onToggle={toggle}>
                Say <strong>nothing case-specific to the sender</strong>. Sanction notices state the
                grounds and how to contest — never that an agency report was filed.
            </CseaChecklistItem>
            <CseaChecklistItem id="submit-supplementary" {ticks} onToggle={toggle}>
                Anything you could not provide today: gather it and file a
                <strong>supplementary report</strong> ("relates to a previous report" = Yes, quote
                the reference). New material found later — even from the same sender — is a
                <em>new</em> report, not a supplementary one.
            </CseaChecklistItem>
        </section>

        <p class="sources">
            Sources: NCA "How to use the CSEA-IRP" v2.0 (May 2026), the Priority 1 &amp; 2
            Contingency Reporting Template v1.0, and the OpenChat Labs Authorized Assessment
            Procedure.
        </p>
    {/if}
</div>

<style lang="scss">
    .csea {
        text-align: left;
        @include lp-content-padding();
        margin-top: toRem(80);
        margin-bottom: toRem(80);
        max-width: toRem(900);

        @include mobile() {
            margin-top: 0;
        }
    }

    .restricted,
    .intro {
        margin-top: toRem(24);
    }

    section {
        margin-top: toRem(40);

        h2 {
            @include font(bold, normal, fs-160);
            margin-bottom: toRem(16);

            .num {
                display: inline-block;
                opacity: 0.5;
                margin-right: toRem(8);
            }
        }

        h3 {
            @include font(bold, normal, fs-120);
            margin: toRem(24) 0 toRem(12) 0;
        }

        p {
            margin-bottom: toRem(12);
        }
    }

    .toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: toRem(24);
        gap: toRem(12);

        .progress {
            opacity: 0.7;
        }

        .reset {
            background: none;
            border: 1px solid var(--landing-txt);
            color: var(--landing-txt);
            border-radius: toRem(6);
            padding: toRem(6) toRem(12);
            cursor: pointer;
        }
    }

    .choice {
        display: flex;
        gap: toRem(12);
        margin-top: toRem(12);

        &.vertical {
            flex-direction: column;
        }

        @include mobile() {
            flex-direction: column;
        }

        button {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: toRem(6);
            text-align: left;
            background: none;
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: toRem(8);
            padding: toRem(12) toRem(16);
            color: var(--landing-txt);
            cursor: pointer;

            &.selected {
                border-color: var(--landing-txt);
                background-color: rgba(255, 255, 255, 0.08);
            }

            span {
                opacity: 0.8;
            }
        }
    }

    .warn {
        border: 1px solid #d64141;
        border-left-width: toRem(6);
        border-radius: toRem(8);
        padding: toRem(12) toRem(16);
        margin: toRem(12) 0;
    }

    .note {
        opacity: 0.8;
        font-style: italic;
    }

    .phonebox {
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: toRem(8);
        padding: toRem(12) toRem(16);
        margin-bottom: toRem(12);

        &.active {
            border-color: #d64141;
            border-left-width: toRem(6);
        }

        p {
            margin: 0;
        }
    }

    .handling {
        margin-top: toRem(8);
    }

    .sources {
        margin-top: toRem(48);
        opacity: 0.6;
        @include font(book, normal, fs-80);
    }
</style>
