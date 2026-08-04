use crate::{
    RuntimeState,
    guards::caller_is_user_canister_or_group_index,
    model::moderation::{self, ModerationAlert},
    model::reported_messages::{
        AddReportArgs, AddReportResult, AutomatedOutcome, ModerationAction, RecordOutcomeResult, build_message_to_reporter,
        build_message_to_sender,
    },
    mutate_state, read_state,
    timer_job_types::{ProcessReportClassification, TimerJob},
};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::MINUTE_IN_MS;
use group_community_common::openai_moderation;
use tracing::{error, warn};
use types::ModerationCategories;
use user_index_canister::c2c_report_message::{Response::*, *};

// How many times classification is attempted before the failure is recorded on the outcome and
// the report is escalated for human review regardless
const MAX_CLASSIFICATION_ATTEMPTS: u32 = 5;

enum ReportAction {
    Classify(u64),
    CsamAssertion(u64),
    // A CSAM assertion on a report that already has an automated outcome (but no verdict):
    // apply the protective quarantine only, leaving the recorded outcome untouched
    CsamProtectionOnly(u64),
}

#[update(guard = "caller_is_user_canister_or_group_index", msgpack = true)]
#[trace]
fn c2c_report_message(args: Args) -> Response {
    match mutate_state(|state| add_report(&args, state)) {
        Ok(ReportAction::CsamAssertion(report_index)) => {
            // The reporter asserts the content is CSAM: quarantine the media in the vault
            // and delete the message immediately - nobody views the material outside the
            // quarantine framework - but the SUSPENSION waits for the human verdict. A
            // reporter is not a trusted classifier: an immediate suspension would let any
            // account grind others offline with false assertions. The moderation flags are
            // set even for private group chats so the deleted content is locked behind the
            // read-gate (both are applied in one message by handle_moderation_result).
            mutate_state(|state| {
                handle_moderation_result(report_index, ModerationCategories::SEXUAL_MINORS, false, false, state);
            });
            Success
        }
        Ok(ReportAction::CsamProtectionOnly(report_index)) => {
            mutate_state(|state| apply_csam_assertion_protection(report_index, state));
            Success
        }
        Ok(ReportAction::Classify(report_index)) => {
            if args.message.moderation_flags != 0
                && let Some(categories) = ModerationCategories::from_bits(args.message.moderation_flags)
            {
                // The message has already been classified by the active moderation pipeline
                // (only public messages are, and only flagged categories are stored): reuse
                // that judgement rather than calling the OpenAI API again
                mutate_state(|state| handle_moderation_result(report_index, categories, false, true, state));
            } else {
                // The classification inputs were persisted in `add_report`, so if this call is
                // lost to an upgrade the classification is resumed in post_upgrade
                ic_cdk::futures::spawn(process_report(report_index));
            }
            Success
        }
        Err(response) => response,
    }
}

fn add_report(args: &Args, state: &mut RuntimeState) -> Result<ReportAction, Response> {
    // A CSAM assertion is NEVER ignored or downgraded, whatever the reporter's history: the
    // cost of suppressing a true report is unbounded while the takedown is fully reversible,
    // rate-limited, and never suspends before a verdict. Repeat false assertions are recorded
    // as evidence (and logged here) so that a moderator can sanction the REPORTER - crying
    // wolf is a rules violation with a human consequence, not a reason to stop listening.
    let csam = args.csam;
    if csam
        && let Some(user) = state.data.users.get_by_user_id(&args.reporter)
        && user.false_csam_reports > 0
    {
        warn!(
            reporter = %args.reporter,
            false_csam_reports = user.false_csam_reports,
            "CSAM assertion from a reporter with previously dismissed assertions"
        );
    }

    let add_report_args = AddReportArgs {
        chat_id: args.chat_id,
        thread_root_message_index: args.thread_root_message_index,
        message_index: args.message.message_index,
        message_id: args.message.message_id,
        sender: args.message.sender,
        already_deleted: args.already_deleted,
        reporter: args.reporter,
        csam,
        timestamp: state.env.now(),
    };
    match state.data.reported_messages.add_report(add_report_args) {
        AddReportResult::New(report_index) => {
            // Record the reported message against the sender's user record
            state.data.users.push_reported_message(args.message.sender, report_index);
            // Persist everything needed to classify the message so that classification survives
            // an upgrade and failed API calls can be retried
            state
                .data
                .reported_messages
                .add_pending_classification(report_index, args.message.content.clone(), args.is_public);
            Ok(if csam { ReportAction::CsamAssertion(report_index) } else { ReportAction::Classify(report_index) })
        }
        AddReportResult::ExistingOutcome(report_index) => {
            // A CSAM assertion on an already-classified (but unverdicted) report still takes
            // the protective action: the earlier classification did not quarantine anything
            // and the asserted media would otherwise stay publicly served until the verdict.
            // (Deliberate: an assertion against a report with a HUMAN verdict - or a legacy
            // Modclub outcome, which likewise cannot be re-verdicted - is refused; the
            // reporter gets the outcome description and can report the content to the
            // authorities directly if they disagree.)
            if csam
                && state
                    .data
                    .reported_messages
                    .assert_csam_if_unverdicted(report_index, args.reporter)
            {
                return Ok(ReportAction::CsamProtectionOnly(report_index));
            }
            // Queue a message from the OC bot to the reporter describing what happened
            let reported_message = state.data.reported_messages.get(report_index).unwrap();
            state.push_event_to_local_user_index(args.reporter, build_message_to_reporter(reported_message, args.reporter));
            Err(Success)
        }
        // A CSAM assertion on an already-pending report must still take the CSAM path: the
        // earlier reporter's plain report did not quarantine anything
        AddReportResult::ExistingPending(report_index) if csam => Ok(ReportAction::CsamAssertion(report_index)),
        AddReportResult::ExistingPending(_) => Err(Success),
        AddReportResult::AlreadyReportedByUser => Err(AlreadyReported),
        AddReportResult::RateLimited => {
            // Silently dropped: only the flooding reporter's own excess reports are affected and
            // the message can still be reported by anyone else
            warn!(reporter = %args.reporter, "Report rate limit exceeded, dropping report");
            Err(Success)
        }
    }
}

// The protective half of the CSAM path for a report whose automated outcome already exists:
// quarantine the media, delete the message and set the read-gate flag, without touching the
// recorded outcome (the moderator alert already exists and the verdict decides the rest).
// Every step is idempotent, so re-assertion by a second reporter is harmless.
fn apply_csam_assertion_protection(report_index: u64, state: &mut RuntimeState) {
    let Some(report) = state.data.reported_messages.get(report_index) else {
        return;
    };
    let report = report.clone();
    moderation::quarantine_blobs(report_index, &report, ModerationCategories::SEXUAL_MINORS.bits(), state);
    moderation::delete_and_flag_message(
        report.chat_id,
        report.thread_root_message_index,
        report.message_id,
        ModerationCategories::SEXUAL_MINORS.bits(),
        report.already_deleted,
        &mut state.data.fire_and_forget_handler,
    );
    if report.moderation_channel_message_id.is_some() {
        // The alert card was posted before the media was vaulted: flip it to the quarantined
        // review path, or the moderator's direct blob fetch dead-ends on the vault pin
        moderation::update_moderation_alert_quarantined(&report, state);
    } else {
        // A FlaggedOnly outcome never posted an alert; the assertion escalated it (see
        // assert_csam_if_unverdicted) and the alert is posted now so a verdict can happen
        moderation::post_moderation_alert(
            ModerationAlert {
                report_index: Some(report_index),
                chat_id: report.chat_id,
                thread_root_message_index: report.thread_root_message_index,
                message_index: report.message_index,
                message_id: report.message_id,
                sender: report.sender,
                reporters: report.reports.keys().copied().collect(),
                categories: ModerationCategories::SEXUAL_MINORS,
                classification_failed: false,
                auto_sanctioned: true,
                content_excerpt: None,
                blob_references: report.blob_references.clone(),
                timestamp: state.env.now(),
            },
            state,
        );
    }
}

pub(crate) async fn process_report(report_index: u64) {
    let Some((api_key, input)) = read_state(|state| {
        state
            .data
            .reported_messages
            .pending_classification(report_index)
            .map(|pending| (state.data.openai_api_key.clone(), pending.content.moderation_input()))
    }) else {
        // The outcome has already been recorded
        return;
    };

    let result = if input.is_empty() {
        // There is nothing the API can classify, but the report may still be valid for a reason
        // the API cannot evaluate, so it continues with no flagged categories
        Ok(ModerationCategories::default())
    } else if let Some(api_key) = api_key {
        openai_moderation::moderate_input(&api_key, &input).await
    } else {
        Err("OpenAI API key has not been set".to_string())
    };

    mutate_state(|state| match result {
        Ok(categories) => handle_moderation_result(report_index, categories, false, true, state),
        Err(error) => {
            error!(?error, report_index, "Failed to classify reported message");
            let Some(attempts) = state.data.reported_messages.record_classification_failure(report_index) else {
                return;
            };
            // A 4xx response is permanent (eg. an image URL the API cannot fetch because the
            // blob was deleted): retrying cannot succeed, so hand straight to the moderators.
            // 429 is rate limiting, which is transient and worth the backoff.
            let permanent = error.contains("status 4") && !error.contains("status 429");
            if !permanent && attempts < MAX_CLASSIFICATION_ATTEMPTS {
                let now = state.env.now();
                state.data.timer_jobs.enqueue_job(
                    TimerJob::ProcessReportClassification(ProcessReportClassification { report_index }),
                    now + (1u64 << attempts) * MINUTE_IN_MS,
                    now,
                );
            } else {
                // Retries exhausted: record the failure on the outcome, so that it cannot be
                // mistaken for a clean classification, and hand the report to the moderators
                handle_moderation_result(report_index, ModerationCategories::default(), true, true, state);
            }
        }
    });
}

fn handle_moderation_result(
    report_index: u64,
    categories: ModerationCategories,
    classification_failed: bool,
    suspend_sender: bool,
    state: &mut RuntimeState,
) {
    // The pending classification is removed when the outcome is recorded, so if it is missing
    // the report has already been handled
    let Some((content_excerpt, is_public, blob_references)) = state
        .data
        .reported_messages
        .pending_classification(report_index)
        .map(|pending| {
            (
                pending.content.moderation_input().text,
                pending.is_public,
                pending.content.blob_references(),
            )
        })
    else {
        error!(report_index, "Report outcome already recorded");
        return;
    };
    let Some((chat_id, thread_root_message_index, message_id, sender, already_deleted)) =
        state.data.reported_messages.get(report_index).map(|r| {
            (
                r.chat_id,
                r.thread_root_message_index,
                r.message_id,
                r.sender,
                r.already_deleted,
            )
        })
    else {
        error!(report_index, "Report not found");
        return;
    };

    let now = state.env.now();
    let is_csam = categories.contains(ModerationCategories::SEXUAL_MINORS);

    let action = if is_csam {
        ModerationAction::AutoSanctioned
    } else if categories.is_empty() || categories.intersects(human_review_categories()) {
        // If the message wasn't flagged, the report may still be valid for a reason the API
        // cannot evaluate (eg. scam, spam), so it goes for human review either way
        ModerationAction::EscalatedForHumanReview
    } else {
        // Flagged as adult content only - hidden in the app store build but not a violation
        ModerationAction::FlaggedOnly
    };

    // Store the flags on the originating canister so the message can be hidden in the app store
    // build (public chats only - private messages are classified but not flagged). CSAM is
    // flagged whatever the chat's visibility, in the same message as the deletion below.
    if !categories.is_empty() && is_public && !is_csam {
        moderation::set_message_moderation_flags(
            chat_id,
            thread_root_message_index,
            message_id,
            categories.bits(),
            &mut state.data.fire_and_forget_handler,
        );
    }

    // Store the media references on the report: verdicts may need them for quarantine even
    // when the classifier did not flag CSAM (a moderator can still uphold as CSAM)
    state
        .data
        .reported_messages
        .set_blob_references(report_index, blob_references.clone());

    if is_csam {
        // Preserve evidence ahead of the sanction: quarantine the blobs in the vault
        // (blocks public serving, pins against deletion)
        if let Some(report) = state.data.reported_messages.get(report_index) {
            let report = report.clone();
            moderation::quarantine_blobs(report_index, &report, categories.bits(), state);
        }
        // The read-gate flag and the deletion travel together: separately sent, a deletion
        // landing first leaves the content readable by its sender and undeletable by anyone
        moderation::delete_and_flag_message(
            chat_id,
            thread_root_message_index,
            message_id,
            categories.bits(),
            already_deleted,
            &mut state.data.fire_and_forget_handler,
        );
        if suspend_sender {
            moderation::suspend_sender(sender, now, state);
        }
    }

    let outcome = AutomatedOutcome {
        timestamp: now,
        flagged_categories: categories.bits(),
        action,
        sanctioned: is_csam && suspend_sender,
        classification_failed,
        human_verdict: None,
    };
    let reported_message = match state.data.reported_messages.record_outcome(report_index, outcome) {
        RecordOutcomeResult::Success(m) => m,
        RecordOutcomeResult::OutcomeExists(index) => {
            error!(?index, "Report outcome already recorded");
            return;
        }
        RecordOutcomeResult::ReportNotFound(index) => {
            error!(?index, "Report not found");
            return;
        }
    };

    if matches!(
        action,
        ModerationAction::AutoSanctioned | ModerationAction::EscalatedForHumanReview
    ) {
        moderation::post_moderation_alert(
            ModerationAlert {
                report_index: Some(report_index),
                chat_id: reported_message.chat_id,
                thread_root_message_index: reported_message.thread_root_message_index,
                message_index: reported_message.message_index,
                message_id: reported_message.message_id,
                sender: reported_message.sender,
                reporters: reported_message.reports.keys().copied().collect(),
                categories,
                classification_failed,
                auto_sanctioned: is_csam,
                content_excerpt,
                // Included even for escalated reports: private-chat media cannot be reviewed
                // in place (the moderator is not a member), so the alert's Review affordance
                // fetches it - via the vault when quarantined, else from its ordinary blob url
                blob_references,
                timestamp: now,
            },
            state,
        );
    }

    if is_csam {
        // Inform the sender that their message has violated the platform rules
        state.push_event_to_local_user_index(
            reported_message.sender,
            build_message_to_sender(&reported_message, suspend_sender),
        );
    }

    // Inform each reporter of the outcome of their report
    for reporter in reported_message.reports.keys() {
        state.push_event_to_local_user_index(*reporter, build_message_to_reporter(&reported_message, *reporter));
    }
}

// Categories which map to OpenChat T&C violations requiring human review
fn human_review_categories() -> ModerationCategories {
    // Every category except sexual/minors (which auto-sanctions above): under the updated
    // terms adult content is prohibited too, so a reported message classified as sexual is a
    // potential violation needing a human decision - the old "flagged only, not a violation"
    // handling predates the prohibition. FlaggedOnly therefore remains only on legacy
    // outcomes recorded before this change.
    ModerationCategories::SEXUAL
        | ModerationCategories::HARASSMENT
        | ModerationCategories::HARASSMENT_THREATENING
        | ModerationCategories::VIOLENCE
        | ModerationCategories::VIOLENCE_GRAPHIC
        | ModerationCategories::SELF_HARM
        | ModerationCategories::ILLICIT
}
