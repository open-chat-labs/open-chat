<!-- The moderators' manual NCA report checklist under /csea-reporting's doc (Learn's belowDoc), for a
     platform moderator or operator (MarketingScreen decides, showsCseaChecklist). `?report=` names
     the report, whose progress this browser keeps (logic/moderation/cseaChecklist), and
     `?urgent=true` adds the urgent note. Whether a call to the NCA is needed is checked against the
     time in the UK as it passes. In English only, as the old desktop page
     (components/landingpages/CseaReportingPage.svelte), whose words these are: a change to them
     goes in both until the old page goes. TODO(design): no design for it; Learn's doc styles. -->
<script lang="ts">
    import { querystringStore } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import {
        CseaChecklist,
        type CseaOrigin,
        type CseaPriority,
        ukTime,
    } from "@src/logic/moderation/cseaChecklist.svelte";
    import { now } from "@src/stores/time";
    import type { Snippet } from "svelte";

    const report = $derived($querystringStore.get("report") ?? undefined);
    const urgent = $derived($querystringStore.get("urgent") === "true");

    // a report's own checklist: another ?report= restores its own progress, never this one's
    const checklist = $derived(new CseaChecklist(report));
    const at = $derived(new Date($now));
    const callRequired = $derived(checklist.callRequired(at));
    const ticked = $derived(checklist.tickedCount);

    const ORIGINS: { value: CseaOrigin; title: string; body: string }[] = [
        {
            value: "hash",
            title: "Hash match",
            body: "PhotoDNA match or a blocked re-upload of denylisted material. The report carries the original hash and metadata — the NCA matches the hash on their side, so nobody needs to view or handle the material.",
        },
        {
            value: "manual",
            title: "Manual assertion",
            body: "A user report, a third-party report, or moderator discovery. The portal requires the material itself to be uploaded, so the controlled-handling steps in section 6 apply.",
        },
    ];

    const PRIORITIES: { value: CseaPriority; title: string; body: string }[] = [
        {
            value: 1,
            title: "Priority 1 — current or immediate risk to an individual",
            body: "A real and immediate threat to life or of serious harm or injury, including serious sexual assault and rape; or a child needs immediate safeguarding because abuse is taking place now or is imminent.",
        },
        {
            value: 2,
            title: "Priority 2 — possible risk in the near future, or time-sensitive",
            body: "Safeguarding action is needed urgently but there is no immediate threat: suspected contact offending, content indicating recently generated images, or a child who has produced self-generated material or has sent or received child sexual abuse material. Most credible manual reports of fresh, non-hash-matched material belong here.",
        },
        {
            value: 3,
            title: "Priority 3 — other",
            body: "No impending danger to a child: hash-list matches, problematic chat with no material shared, or material shared among known adults where ages are indeterminate and there is no threat to life.",
        },
    ];
</script>

{#snippet item(id: string, text: Snippet)}
    {@const checked = checklist.isTicked(id)}
    <label class="item" class:checked>
        <input type="checkbox" {checked} onchange={() => checklist.toggle(id)} />
        <span class="item-text">{@render text()}</span>
    </label>
{/snippet}

{#snippet heading(num: number, title: string)}
    <h2 class="step-title"><span class="num">{String(num).padStart(2, "0")}</span>{title}</h2>
{/snippet}

<div class="checklist">
    <div class="toolbar">
        <span class="progress">
            {#if report !== undefined}Report #{report} &middot;{/if}
            {ticked} item{ticked === 1 ? "" : "s"} checked
        </span>
        <Button variant="secondary" label="Reset checklist" onClick={() => checklist.reset()} />
    </div>

    <section class="step">
        {@render heading(1, "Before you start")}
        {#snippet reviewer()}
            You are a <strong>designated vault reviewer</strong>. If you are not, stop here and hand
            the case to one immediately. Do not view, download, or copy anything — the incident
            protocol's absolute rules (never view, never copy, never visit reported URLs) bind
            everyone who is not a designated reviewer.
        {/snippet}
        {@render item("prep-reviewer", reviewer)}
        {#snippet creds()}
            You have the CSEA-IRP portal credentials and the <strong
                >organisation reference number</strong> to hand (password manager). The reference number
            is needed if you have to phone the NCA.
        {/snippet}
        {@render item("prep-creds", creds)}
    </section>

    <section class="step">
        {@render heading(2, "How was this detected?")}
        <p class="para">
            This changes how the material itself is handled in step 6 — everything else is the same.
        </p>
        <div class="choices">
            {#each ORIGINS as o}
                <button
                    class="choice"
                    class:selected={checklist.origin === o.value}
                    aria-pressed={checklist.origin === o.value}
                    onclick={() => checklist.setOrigin(o.value)}>
                    <strong class="choice-title">{o.title}</strong>
                    <span class="choice-body">{o.body}</span>
                </button>
            {/each}
        </div>
    </section>

    <section class="step">
        {@render heading(3, "Priority level")}
        {#if urgent}
            <p class="note">
                This report was marked <strong>urgent</strong> in OpenChat, which usually means Priority
                1 or 2 — but make the call against the definitions below, not the flag.
            </p>
        {/if}
        <div class="choices vertical">
            {#each PRIORITIES as p}
                <button
                    class="choice"
                    class:selected={checklist.priority === p.value}
                    aria-pressed={checklist.priority === p.value}
                    onclick={() => checklist.setPriority(p.value)}>
                    <strong class="choice-title">{p.title}</strong>
                    <span class="choice-body">{p.body}</span>
                </button>
            {/each}
        </div>
        {#if checklist.priority === 1}
            <div class="warn">
                <strong>Priority 1 fast path:</strong> submit <em>immediately</em> with whatever information
                you have to hand. You may select "Data not held" for any mandatory field you do not have
                <em>yet</em> — getting the report to law enforcement is the priority. File a supplementary
                report with the rest afterwards, quoting the reference number.
            </div>
        {/if}
    </section>

    <section class="step">
        {@render heading(4, "Phone rules — know these before you submit")}
        <div class="phonebox" class:active={callRequired} aria-live="polite">
            {#if checklist.priority === undefined}
                <p class="para">Select a priority above to see whether a call is needed.</p>
            {:else if callRequired}
                <p class="para">
                    <strong>A call is required after you submit.</strong> It is {ukTime(at)} in the UK —
                    outside 07:00&ndash;17:00. After submitting a Priority
                    {checklist.priority} report, call the NCA control centre on
                    <strong><a href="tel:01925663355">01925 663355</a></strong> and give the organisation
                    reference number, so they know a priority report has arrived. That number is for this
                    purpose only.
                </p>
            {:else if checklist.priority === 3}
                <p class="para">
                    <strong>No call needed.</strong> Priority 3 reports never require a phone call.
                </p>
            {:else}
                <p class="para">
                    <strong>No call needed right now.</strong> It is {ukTime(at)} in the UK — inside 07:00&ndash;17:00,
                    so a Priority {checklist.priority} report needs no follow-up call. If you end up submitting
                    after 17:00, call the NCA control centre on
                    <strong><a href="tel:01925663355">01925 663355</a></strong> after submitting.
                </p>
            {/if}
        </div>
        <p class="para">
            <strong>If the portal is unavailable</strong> and this is Priority 1 or 2: download and fill
            in the
            <a href="/assets/nca/nca-p1-p2-contingency-reporting-template-v1.0.pdf" download>
                Priority 1 &amp; 2 Contingency Reporting Template</a
            >, email it to
            <strong><a href="mailto:DRB@nca.gov.uk">DRB@nca.gov.uk</a></strong>, then call
            <strong><a href="tel:01925663355">01925 663355</a></strong>. Priority 3 waits for the portal to
            come back. Either way, submit the full report through the portal once it is restored.
        </p>
        <p class="para">
            Portal <em>technical</em> problems (sign-in, uploads failing) go to the Service and Support
            desk: <a href="tel:03301115047">0330 111 5047</a> (UK),
            <a href="tel:+441615218753">+44 161 521 8753</a> (international), or
            <a href="mailto:support@csea-irp.atlassian.net">support@csea-irp.atlassian.net</a>. They
            cannot discuss the contents of a report.
        </p>
    </section>

    <section class="step">
        {@render heading(5, "Portal — general report information")}
        <p class="para">
            Sign in to the portal at
            <a
                href="https://www.uk-child-sexual-abuse-industry-reporting.gov.uk/home"
                target="_blank"
                rel="noopener noreferrer">uk-child-sexual-abuse-industry-reporting.gov.uk</a
            >, start a new report, and read the Declaration. The report has five sections; this
            checklist follows them in order. Fields marked * on the portal are mandatory — where we
            genuinely do not hold the data, tick the "data not held" box rather than delaying or
            guessing.
        </p>
        {#snippet prev()}
            <strong>Related to a previous report?</strong> Answer Yes for supplementary reports and for
            blocked re-uploads of material we have reported before, and quote the earlier reference from
            the filed-report register. Otherwise No.
        {/snippet}
        {@render item("gen-prev", prev)}
        {#snippet contact()}
            <strong>Point of contact:</strong> give <em>your own</em> name, phone number, and email — law
            enforcement must be able to reach a person, not just the portal account.
        {/snippet}
        {@render item("gen-contact", contact)}
        {#snippet detected()}
            <strong>Date and time incident detected.</strong> When <em>we</em> detected it — the hash-match
            timestamp or when the user report arrived — not when the content was posted. HH:MM:SS, in UTC.
        {/snippet}
        {@render item("gen-detected-when", detected)}
        {#snippet reviewed()}
            <strong>Has someone in your organisation reviewed the content?</strong> Answer truthfully.
            "No" is a lawful and expected answer — <em>never</em> view material just to change this answer.
            If a designated reviewer has viewed it in the vault, answer Yes.
        {/snippet}
        {@render item("gen-reviewed", reviewed)}
        {#snippet format()}
            <strong>Is the content in the original format?</strong> Yes — we never alter stored media.
        {/snippet}
        {@render item("gen-format", format)}
        {#snippet framing()}
            <strong>Unverified framing, everywhere free text allows it.</strong> State plainly what has
            and has not been verified, e.g. "User-reported; not viewed or verified by us" or "Automated
            PhotoDNA hash match; not human-verified at the time of this report". Never overstate confidence
            to make a report look stronger — a truthful unverified report is protected; an overstated one
            is not.
        {/snippet}
        {@render item("gen-framing", framing)}
    </section>

    <section class="step">
        {@render heading(6, "The content detected — and handling the material")}
        <p class="para">
            <strong>One sender per report.</strong> If several users posted material in the same chat, that
            is one report per sender, each listing the other participants as recipients. Run this checklist
            once per sender.
        </p>
        {#snippet uploaded()}
            <strong>Date and time uploaded:</strong> from the message metadata, in UTC. "File 1" is the
            file we detected first; the sender's other offending files follow in any order.
        {/snippet}
        {@render item("content-date", uploaded)}
        {#snippet ip()}
            <strong>IP address and port of the uploading device:</strong> tick
            <em>data not held</em>. OpenChat does not record IP addresses — this is a deliberate,
            standing declaration, not an oversight. Same for the IP date and time fields.
        {/snippet}
        {@render item("content-ip", ip)}
        {#snippet hash()}
            <strong>Original hash of the file:</strong> use "Copy hashes" on the report card — it copies
            our sha256 for each file and, for hash matches, the PhotoDNA hash that matched.
            {#if checklist.origin === "hash"}
                Give the PhotoDNA hash here: it is what lets the NCA match the content without the file.
                The provider's own record id and corpus details go in the additional-information field.
            {:else}
                Give the sha256.
            {/if}
        {/snippet}
        {@render item("content-hash", hash)}
        {#snippet url()}
            <strong>URL of the reported content at the point of upload:</strong> the blob URL the media
            was served from when it was uploaded, pasted as text. This is a historical fact — the URL no
            longer resolves once the media is quarantined, and that is the expected answer. Say so in the
            additional-information field: "URL no longer resolves — media was quarantined by the platform
            on detection." Do not open it to check it.
        {/snippet}
        {@render item("content-url", url)}
        {#snippet chat()}
            <strong>Illegal chat with no media:</strong> if the report is about messages rather than media,
            upload a copy of the entire chat between the sender and the recipient(s) — the text excerpt we
            hold, plus context.
        {/snippet}
        {@render item("content-chat", chat)}

        <h3 class="sub-title">Uploading the material itself</h3>
        {#if checklist.origin === "hash"}
            <p class="para">
                <strong>Nothing to handle.</strong> Do not view the material, do not download it, do not
                open the blob URL. The original hash from the matched list plus the metadata above is the
                payload — the NCA matches the hash on their side.
            </p>
            <p class="note">
                If the portal will not accept the report without a file attached, stop and contact the NCA
                (support desk for portal mechanics, DRB for report content) rather than improvising a
                download.
            </p>
        {:else if checklist.origin === "manual"}
            <p class="para">
                The portal requires the material in its original, unedited format. Only a designated
                reviewer may handle it, only for as long as the submission takes, and the NCA portal (or
                NCMEC's CyberTipline) is the only destination it may ever be sent to.
            </p>
            {#snippet device()}
                Use a machine with <strong>no file-sync or backup agent running</strong> — no iCloud Drive,
                Dropbox, Google Drive, OneDrive, or cloud backup covering the download location. Sync tools
                copy files off the machine without asking; deleting later does not undo a copy already
                taken.
            {/snippet}
            {@render item("media-device", device)}
            {#snippet portalFirst()}
                Sign in to the portal and get the report to the upload field
                <strong>before</strong> touching the file, so the handling window is as short as possible.
            {/snippet}
            {@render item("media-portal-first", portalFirst)}
            {#snippet download()}
                Obtain the file by the approved vault export route, without opening or previewing it.
                Viewing happens only in the vault viewer under the assessment procedure — it is a separate
                act with its own rules, not part of filing. If no approved export route is available to you,
                <strong>stop and escalate</strong> — do not improvise a way to copy the material.
            {/snippet}
            {@render item("media-download", download)}
            {#snippet purge()}
                <strong>Immediately after submitting, purge every local copy:</strong>
                the downloads folder, the browser's download history and cache, the bin/trash, and any
                preview caches. The submission is complete when no copy remains on the machine.
            {/snippet}
            {@render item("media-purge", purge)}
            <div class="warn">
                <strong>Never</strong> email the material, screenshot it, print it, put it in any third-party
                tool, keep a "backup", or send it to anyone other than the NCA portal or NCMEC — including
                police forces, other agencies, or colleagues. Everyone else gets a report and a reference number,
                never the file.
            </div>
        {:else}
            <p class="note">Select how this was detected in section 2 to see the handling steps.</p>
        {/if}
    </section>

    <section class="step">
        {@render heading(7, "The user (sender / recipients)")}
        <p class="para">
            Status is <strong>sender</strong> for the account that uploaded or sent the material,
            <strong>recipient</strong> for each account that received it. One sender per report; recipients
            can be many.
        </p>
        {#snippet username()}
            <strong>What OpenChat holds — provide it all:</strong> the username at the time of the incident
            (plus previous usernames if known), the user's principal as the unique identification number,
            the profile URL as text, profile picture and bio if set, admin or moderator status in the group
            where the content appeared, and ledger principals if relevant.
        {/snippet}
        {@render item("user-username", username)}
        {#snippet notHeld()}
            <strong>Tick "data not held" without agonising</strong> for everything OpenChat deliberately does
            not collect: real names, date of birth, email address, phone number, postal and billing addresses,
            bank accounts, cards, payment platforms, identity documents, National Insurance numbers, driving
            licences, IP history, recovery email and phone, device identifiers, biometrics, and voice
            recordings. These declarations are standing statements to the NCA and Ofcom about what we do not
            collect — they are deliberate policy.
        {/snippet}
        {@render item("user-dnh", notHeld)}
    </section>

    <section class="step">
        {@render heading(8, "Review, submit, record")}
        {#snippet declaration()}
            Read the <strong>Declaration</strong> and confirm it. It affirms that any empty mandatory field
            means the data was not held at the time of submission — only tick it if that is true.
        {/snippet}
        {@render item("submit-declaration", declaration)}
        {#snippet review()}
            You <strong>cannot re-open a report once submitted</strong> — on the review page, check accuracy
            and the unverified framing before confirming.
        {/snippet}
        {@render item("submit-review", review)}
        {#snippet reference()}
            Submit, and note the <strong>report reference number</strong> immediately (it also appears under
            "Previously submitted reports" on the portal homepage).
        {/snippet}
        {@render item("submit-reference", reference)}
        {#if callRequired}
            {#snippet call()}
                <strong>Make the phone call now:</strong> NCA control centre,
                <a href="tel:01925663355">01925 663355</a>, with the organisation reference number (section
                4).
            {/snippet}
            {@render item("submit-call", call)}
        {/if}
        {#snippet register()}
            Record the filing in OpenChat: back in the report card, use <strong>"Record NCA filing"</strong>
            and enter the portal reference. This is the filed-report register.
        {/snippet}
        {@render item("submit-register", register)}
        {#snippet silence()}
            Say <strong>nothing case-specific to the sender</strong>. Sanction notices state the grounds and
            how to contest — never that an agency report was filed.
        {/snippet}
        {@render item("submit-silence", silence)}
        {#snippet supplementary()}
            Anything you could not provide today: gather it and file a
            <strong>supplementary report</strong> ("relates to a previous report" = Yes, quote the reference).
            New material found later — even from the same sender — is a <em>new</em> report, not a
            supplementary one.
        {/snippet}
        {@render item("submit-supplementary", supplementary)}
    </section>

    <p class="sources">
        Sources: NCA "How to use the CSEA-IRP" v2.0 (May 2026), the Priority 1 &amp; 2 Contingency
        Reporting Template v1.0, and the OpenChat Labs Authorized Assessment Procedure.
    </p>
</div>

<style lang="scss">
    .checklist {
        display: flex;
        flex-direction: column;
        gap: 48px;
        color: var(--ink-2);
        font: var(--weight-regular) var(--text-base) / 1.75 var(--font-sans);

        a {
            color: var(--accent);
            text-decoration: underline;
            text-underline-offset: 2px;
        }

        strong {
            font-weight: var(--weight-semibold);
            color: var(--ink);
        }
    }

    .toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-12);
        padding: var(--space-12) var(--space-16);
        border-radius: var(--radius-lg);
        background: var(--surface-1);
        box-shadow: inset 0 0 0 1px var(--line-1);
    }

    .progress {
        font: var(--weight-medium) var(--text-md) / 1.4 var(--font-sans);
        color: var(--ink-3);
    }

    .step {
        display: flex;
        flex-direction: column;
        gap: var(--space-14);
        scroll-margin-top: 140px;
    }

    .step-title {
        margin: 0;
        display: flex;
        align-items: baseline;
        gap: var(--space-14);
        font: var(--weight-bold) clamp(22px, 2.4vw, 28px) / 1.2 var(--font-sans);
        letter-spacing: -0.02em;
        color: var(--ink);
    }

    .num {
        font: var(--weight-medium) var(--text-md) / 1 var(--font-mono);
        color: var(--accent);
    }

    .sub-title {
        margin: var(--space-12) 0 0;
        font: var(--weight-semibold) var(--text-lg) / 1.4 var(--font-sans);
        color: var(--ink);
    }

    .para {
        margin: 0;
        text-wrap: pretty;
    }

    .note {
        margin: 0;
        font-style: italic;
        color: var(--ink-3);
    }

    .item {
        display: flex;
        align-items: flex-start;
        gap: var(--space-12);
        padding: var(--space-10) var(--space-12);
        border-radius: var(--radius-md);
        cursor: pointer;

        &:hover {
            background: var(--overlay-1);
        }

        input {
            flex: none;
            width: 18px;
            height: 18px;
            margin: 5px 0 0;
            accent-color: var(--accent);
            cursor: pointer;
        }

        &.checked .item-text {
            opacity: 0.6;
        }
    }

    .item-text {
        flex: 1;
        min-width: 0;
    }

    .choices {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
        gap: var(--space-12);

        &.vertical {
            grid-template-columns: minmax(0, 1fr);
        }
    }

    .choice {
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
        padding: var(--space-14) var(--space-16);
        border: 0;
        border-radius: var(--radius-lg);
        background: var(--surface-1);
        box-shadow: inset 0 0 0 1px var(--line-2);
        text-align: start;
        font: inherit;
        color: var(--ink-2);
        cursor: pointer;

        &:hover {
            box-shadow: inset 0 0 0 1px var(--line-3);
        }

        &.selected {
            background: var(--accent-soft);
            box-shadow: inset 0 0 0 2px var(--accent);
        }
    }

    .choice-title {
        font: var(--weight-semibold) var(--text-base) / 1.4 var(--font-sans);
        color: var(--ink);
    }

    .choice-body {
        font: var(--weight-regular) var(--text-md) / 1.55 var(--font-sans);
    }

    .warn,
    .phonebox {
        padding: var(--space-12) var(--space-16);
        border-radius: var(--radius-lg);
        background: var(--surface-1);
        box-shadow: inset 0 0 0 1px var(--line-2);
    }

    .warn,
    .phonebox.active {
        background: var(--status-danger-soft);
        box-shadow: inset 0 0 0 1px var(--status-danger-line);
        border-inline-start: 4px solid var(--status-danger);
    }

    .sources {
        margin: 0;
        font: var(--weight-regular) var(--text-sm) / 1.5 var(--font-sans);
        color: var(--ink-4);
    }
</style>
