use chat_events::deep_message_links;
use constants::{DAY_IN_MS, HOUR_IN_MS};
use local_user_index_canister::{OpenChatBotMessageV2, UserIndexEvent};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{
    BlobReference, Chat, MessageContent, MessageContentInitial, MessageId, MessageIndex, ModerationReportResolution,
    ModerationReportStatus, TextContent, TimestampMillis, UserId,
};
use user_index_canister::resolve_moderation_report::ModerationVerdict;

// Generous cap on how many not-yet-reported messages a single user can report per hour, so that
// one user cannot mass-report to trigger unbounded OpenAI calls and flood the moderation channel
const MAX_NEW_REPORTS_PER_HOUR: usize = 10;

#[derive(Serialize, Deserialize, Default)]
pub struct ReportedMessages {
    messages: Vec<ReportedMessage>,
    lookup: HashMap<(Chat, Option<MessageIndex>, MessageIndex), usize>,
    #[serde(default)]
    recent_reports_per_reporter: HashMap<UserId, Vec<TimestampMillis>>,
    // Reports awaiting classification by the OpenAI moderation API, keyed by report index.
    // Persisted so that classification survives an upgrade and failed API calls can be retried.
    #[serde(default)]
    pending_classifications: HashMap<u64, PendingClassification>,
}

impl ReportedMessages {
    pub fn add_report(&mut self, args: AddReportArgs) -> AddReportResult {
        let key = (args.chat_id, args.thread_root_message_index, args.message_index);

        if let Some(&index) = self.lookup.get(&key) {
            let message = self.messages.get_mut(index).unwrap();

            if args.already_deleted {
                message.already_deleted = true;
            }

            let new_reporter = message.reports.insert(args.reporter, args.timestamp).is_none();
            let new_assertion = args.csam && !message.csam_asserted_by.contains(&args.reporter);

            if !new_reporter && !new_assertion {
                AddReportResult::AlreadyReportedByUser
            } else if message.outcome.is_some() {
                // The assertion is NOT registered here: whether it is acted on (and therefore
                // whether the asserter is on the hook for a false report) is decided by the
                // caller, which knows whether a human verdict already stands
                AddReportResult::ExistingOutcome(index as u64)
            } else {
                // An assertion on a pending report is always acted on, so register it: the
                // asserter carries the consequences of a false allegation
                if new_assertion {
                    message.csam_asserted_by.push(args.reporter);
                }
                AddReportResult::ExistingPending(index as u64)
            }
        } else if self.reporter_rate_limited(args.reporter, args.timestamp) {
            AddReportResult::RateLimited
        } else {
            let new_index = self.messages.len();
            self.lookup.insert(key, new_index);
            self.messages.push(ReportedMessage {
                chat_id: args.chat_id,
                thread_root_message_index: args.thread_root_message_index,
                message_index: args.message_index,
                message_id: args.message_id,
                sender: args.sender,
                already_deleted: args.already_deleted,
                reports: HashMap::from([(args.reporter, args.timestamp)]),
                outcome: None,
                moderation_channel_message_id: None,
                blob_references: Vec::new(),
                detection: DetectionSource::UserReport,
                media_matches: Vec::new(),
                contested: None,
                unverified_report_filed: None,
                legal_hold: false,
                release_pending: false,
                csam_asserted_by: if args.csam { vec![args.reporter] } else { Vec::new() },
            });
            AddReportResult::New(new_index as u64)
        }
    }

    // Only reports of not-yet-reported messages count towards the limit since only those trigger
    // downstream processing (an OpenAI call and possibly an escalation)
    fn reporter_rate_limited(&mut self, reporter: UserId, now: TimestampMillis) -> bool {
        // Drop expired timestamps, and any reporters left with none, so the map doesn't grow forever
        self.recent_reports_per_reporter.retain(|_, timestamps| {
            timestamps.retain(|&t| now.saturating_sub(t) < HOUR_IN_MS);
            !timestamps.is_empty()
        });

        let timestamps = self.recent_reports_per_reporter.entry(reporter).or_default();
        if timestamps.len() >= MAX_NEW_REPORTS_PER_HOUR {
            true
        } else {
            timestamps.push(now);
            false
        }
    }

    pub fn record_outcome(&mut self, report_index: u64, outcome: AutomatedOutcome) -> RecordOutcomeResult {
        if let Some(message) = self.messages.get_mut(report_index as usize) {
            if message.outcome.is_some() {
                RecordOutcomeResult::OutcomeExists(report_index)
            } else {
                message.outcome = Some(ReportOutcome::Automated(outcome));
                self.pending_classifications.remove(&report_index);
                RecordOutcomeResult::Success(Box::new(message.clone()))
            }
        } else {
            RecordOutcomeResult::ReportNotFound(report_index)
        }
    }

    pub fn add_pending_classification(&mut self, report_index: u64, content: MessageContent, is_public: bool) {
        self.pending_classifications.insert(
            report_index,
            PendingClassification {
                content,
                is_public,
                attempts: 0,
            },
        );
    }

    pub fn pending_classification(&self, report_index: u64) -> Option<&PendingClassification> {
        self.pending_classifications.get(&report_index)
    }

    // Records a failed classification attempt and returns the total number of failed attempts,
    // or None if the report has already been classified
    pub fn record_classification_failure(&mut self, report_index: u64) -> Option<u32> {
        self.pending_classifications.get_mut(&report_index).map(|pending| {
            pending.attempts += 1;
            pending.attempts
        })
    }

    pub fn get(&self, index: u64) -> Option<&ReportedMessage> {
        self.messages.get(index as usize)
    }

    // Registers a CSAM assertion against a report that already has an automated outcome,
    // provided no human verdict stands yet (a verdict is final: a late assertion neither
    // reopens the case nor exposes the asserter to false-report consequences). Returns true
    // if the assertion was acted on and the caller should apply the protective quarantine.
    pub fn assert_csam_if_unverdicted(&mut self, report_index: u64, reporter: UserId) -> bool {
        let Some(message) = self.messages.get_mut(report_index as usize) else {
            return false;
        };
        if let Some(ReportOutcome::Automated(a)) = &mut message.outcome
            && a.human_verdict.is_none()
        {
            // A FlaggedOnly outcome never alerted the moderators and cannot receive a
            // verdict, so the assertion escalates it for human review - otherwise the
            // protective takedown would be invisible, uncontestable and irreversible
            if matches!(a.action, ModerationAction::FlaggedOnly) {
                a.action = ModerationAction::EscalatedForHumanReview;
            }
            if !message.csam_asserted_by.contains(&reporter) {
                message.csam_asserted_by.push(reporter);
            }
            true
        } else {
            false
        }
    }

    pub fn metrics(&self) -> ReportingMetrics {
        // With reporter-asserted suspensions deferred to the verdict, review latency is what
        // bounds the remaining harm in this system: surface the contest backlog and how fast
        // contests actually get resolved
        let resolved_contest_latencies: Vec<u64> = self
            .messages
            .iter()
            .filter_map(|m| {
                let contested = m.contested?;
                match &m.outcome {
                    Some(ReportOutcome::Automated(a)) => {
                        let verdict = a.human_verdict.as_ref()?;
                        Some(verdict.timestamp.saturating_sub(contested))
                    }
                    _ => None,
                }
            })
            .collect();
        ReportingMetrics {
            messages_reported: self.messages.len(),
            messages_pending_outcome: self.messages.iter().filter(|m| m.outcome.is_none()).count(),
            pending_contests: self
                .messages
                .iter()
                .filter(|m| {
                    m.contested.is_some()
                        && matches!(&m.outcome, Some(ReportOutcome::Automated(a)) if a.human_verdict.is_none())
                })
                .count(),
            oldest_pending_contested_at: self
                .messages
                .iter()
                .filter(|m| matches!(&m.outcome, Some(ReportOutcome::Automated(a)) if a.human_verdict.is_none()))
                .filter_map(|m| m.contested)
                .min(),
            mean_contest_resolution_ms: if resolved_contest_latencies.is_empty() {
                None
            } else {
                Some(resolved_contest_latencies.iter().sum::<u64>() / resolved_contest_latencies.len() as u64)
            },
        }
    }

    pub fn iter(&self) -> impl Iterator<Item = &ReportedMessage> {
        self.messages.iter()
    }

    pub fn set_moderation_channel_message_id(&mut self, report_index: u64, message_id: MessageId) {
        if let Some(message) = self.messages.get_mut(report_index as usize) {
            message.moderation_channel_message_id = Some(message_id);
        }
    }

    pub fn record_human_verdict(&mut self, report_index: u64, human_verdict: HumanVerdict) -> RecordVerdictResult {
        let Some(message) = self.messages.get_mut(report_index as usize) else {
            return RecordVerdictResult::ReportNotFound;
        };

        match &mut message.outcome {
            Some(ReportOutcome::Automated(outcome)) => {
                if outcome.human_verdict.is_some() {
                    RecordVerdictResult::AlreadyResolved
                } else if !matches!(
                    outcome.action,
                    ModerationAction::EscalatedForHumanReview | ModerationAction::AutoSanctioned
                ) {
                    RecordVerdictResult::NotEscalated
                } else {
                    outcome.human_verdict = Some(human_verdict);
                    RecordVerdictResult::Success(Box::new(message.clone()))
                }
            }
            _ => RecordVerdictResult::NotEscalated,
        }
    }

    // Records a proactive (pipeline) CSAM detection. Returns the report index and whether a
    // new report was created (vs filling in an unresolved user report - already recorded
    // against the sender), or None if an outcome already exists (duplicate event - the
    // sanction must not re-apply).
    pub fn add_proactive_detection(&mut self, args: AddProactiveDetectionArgs) -> Option<(u64, bool)> {
        let key = (args.chat_id, args.thread_root_message_index, args.message_index);
        let outcome = ReportOutcome::Automated(AutomatedOutcome {
            timestamp: args.timestamp,
            flagged_categories: args.flags,
            action: args.action,
            // Pipeline CSAM detections suspend at detection time; referrals never do
            sanctioned: matches!(args.action, ModerationAction::AutoSanctioned),
            classification_failed: false,
            human_verdict: None,
        });

        if let Some(&index) = self.lookup.get(&key) {
            let message = self.messages.get_mut(index).unwrap();
            if message.outcome.is_some() {
                // The sanction must not re-apply, but hash-match provenance arriving after a
                // classifier-first detection still belongs on the report's audit trail
                if !args.media_matches.is_empty() && message.media_matches.is_empty() {
                    message.media_matches = args.media_matches;
                }
                None
            } else {
                message.outcome = Some(outcome);
                message.blob_references = args.blob_references;
                message.media_matches = args.media_matches;
                self.pending_classifications.remove(&(index as u64));
                Some((index as u64, false))
            }
        } else {
            let new_index = self.messages.len();
            self.lookup.insert(key, new_index);
            self.messages.push(ReportedMessage {
                chat_id: args.chat_id,
                thread_root_message_index: args.thread_root_message_index,
                message_index: args.message_index,
                message_id: args.message_id,
                sender: args.sender,
                already_deleted: false,
                reports: HashMap::new(),
                outcome: Some(outcome),
                moderation_channel_message_id: None,
                blob_references: args.blob_references,
                detection: DetectionSource::Proactive,
                media_matches: args.media_matches,
                contested: None,
                unverified_report_filed: None,
                legal_hold: false,
                release_pending: false,
                csam_asserted_by: Vec::new(),
            });
            Some((new_index as u64, true))
        }
    }

    // The current status as shown on the alert card, derived from the report state
    pub fn report_status(reported_message: &ReportedMessage) -> ModerationReportStatus {
        let human_verdict = reported_message.outcome.as_ref().and_then(|o| match o {
            ReportOutcome::Automated(a) => a.human_verdict.as_ref(),
            ReportOutcome::Modclub(_) => None,
        });
        if let Some(verdict) = human_verdict {
            let resolution = ModerationReportResolution {
                moderator: verdict.moderator,
                timestamp: verdict.timestamp,
            };
            match verdict.verdict {
                ModerationVerdict::Upheld => ModerationReportStatus::Upheld(resolution),
                ModerationVerdict::UpheldAsCsam => ModerationReportStatus::UpheldAsCsam(resolution),
                ModerationVerdict::Dismissed => ModerationReportStatus::Dismissed(resolution),
            }
        } else if reported_message.contested.is_some() {
            ModerationReportStatus::Contested
        } else {
            ModerationReportStatus::Pending
        }
    }

    pub fn set_blob_references(&mut self, report_index: u64, blob_references: Vec<BlobReference>) {
        if let Some(message) = self.messages.get_mut(report_index as usize) {
            message.blob_references = blob_references;
        }
    }

    pub fn mark_contested(&mut self, report_index: u64, caller: UserId, now: TimestampMillis) -> ContestResult {
        let Some(message) = self.messages.get_mut(report_index as usize) else {
            return ContestResult::NotFound;
        };
        if message.sender != caller {
            return ContestResult::NotFound;
        }
        let Some(ReportOutcome::Automated(outcome)) = &message.outcome else {
            return ContestResult::NotContestable;
        };
        if outcome.human_verdict.is_some() {
            return ContestResult::AlreadyResolved;
        }
        if !matches!(outcome.action, ModerationAction::AutoSanctioned) {
            return ContestResult::NotContestable;
        }
        if message.contested.is_some() {
            return ContestResult::AlreadyContested;
        }
        message.contested = Some(now);
        ContestResult::Success(Box::new(message.clone()))
    }

    pub fn set_legal_hold(&mut self, report_index: u64, legal_hold: bool) {
        if let Some(message) = self.messages.get_mut(report_index as usize) {
            message.legal_hold = legal_hold;
            // Clearing the hold performs any deferred release, so nothing stays pending
            if !legal_hold {
                message.release_pending = false;
            }
        }
    }

    pub fn set_release_pending(&mut self, report_index: u64, release_pending: bool) {
        if let Some(message) = self.messages.get_mut(report_index as usize) {
            message.release_pending = release_pending;
        }
    }

    // Every held report which shares one of these blobs. Holds are per-report here but
    // per-record in the bucket, and a blob can be evidence in several reports, so a hold
    // placed via one report also protects the same blob wherever else it appears - any check
    // scoped to a single report misses that
    pub fn reports_with_hold_intersecting(&self, blob_references: &[BlobReference]) -> Vec<u64> {
        self.messages
            .iter()
            .enumerate()
            .filter(|(_, m)| m.legal_hold && m.blob_references.iter().any(|b| blob_references.contains(b)))
            .map(|(i, _)| i as u64)
            .collect()
    }

    pub fn mark_unverified_report_filed(&mut self, report_index: u64, now: TimestampMillis) -> bool {
        if let Some(message) = self.messages.get_mut(report_index as usize)
            && message.unverified_report_filed.is_none()
        {
            message.unverified_report_filed = Some(now);
            return true;
        }
        false
    }
}

pub enum ContestResult {
    Success(Box<ReportedMessage>),
    NotFound,
    NotContestable,
    AlreadyContested,
    AlreadyResolved,
}

pub enum RecordVerdictResult {
    Success(Box<ReportedMessage>),
    ReportNotFound,
    AlreadyResolved,
    NotEscalated,
}

#[derive(Serialize, Debug)]
pub struct ReportingMetrics {
    pub messages_reported: usize,
    pub messages_pending_outcome: usize,
    pub pending_contests: usize,
    pub oldest_pending_contested_at: Option<TimestampMillis>,
    pub mean_contest_resolution_ms: Option<u64>,
}

#[derive(Clone)]
pub struct AddReportArgs {
    pub chat_id: Chat,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub sender: UserId,
    pub reporter: UserId,
    pub already_deleted: bool,
    pub csam: bool,
    pub timestamp: TimestampMillis,
}

#[derive(Clone)]
pub struct AddProactiveDetectionArgs {
    // AutoSanctioned for CSAM detections, EscalatedForHumanReview for moderation referrals
    pub action: ModerationAction,
    pub chat_id: Chat,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub sender: UserId,
    pub flags: u32,
    pub blob_references: Vec<BlobReference>,
    pub media_matches: Vec<types::MediaScanMatch>,
    pub timestamp: TimestampMillis,
}

#[derive(PartialEq, Debug)]
pub enum AddReportResult {
    New(u64),
    ExistingPending(u64),
    ExistingOutcome(u64),
    AlreadyReportedByUser,
    RateLimited,
}

pub enum RecordOutcomeResult {
    Success(Box<ReportedMessage>),
    OutcomeExists(u64),
    ReportNotFound(u64),
}

// A report awaiting classification by the OpenAI moderation API. Persisted so that an upgrade
// or a failed API call cannot strand the report without an outcome.
#[derive(Serialize, Deserialize)]
pub struct PendingClassification {
    pub content: MessageContent,
    pub is_public: bool,
    pub attempts: u32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ReportedMessage {
    pub chat_id: Chat,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub sender: UserId,
    pub already_deleted: bool,
    pub reports: HashMap<UserId, TimestampMillis>,
    pub outcome: Option<ReportOutcome>,
    // The id of the alert message posted into the internal moderation channel
    #[serde(default)]
    pub moderation_channel_message_id: Option<MessageId>,
    // The message's media attachments, quarantined in the evidence vault while unresolved
    #[serde(default)]
    pub blob_references: Vec<BlobReference>,
    #[serde(default)]
    pub detection: DetectionSource,
    // Present when the detection was a media hash match: the provider's record details,
    // retained as the audit trail and referenced by the authority report
    #[serde(default)]
    pub media_matches: Vec<types::MediaScanMatch>,
    // The reporters who asserted CSAM (triggering immediate quarantine + deletion): if the
    // report is later dismissed those assertions were false, and are recorded against exactly
    // the users who made them
    #[serde(default)]
    pub csam_asserted_by: Vec<UserId>,
    // Set when the sanctioned sender contests the automated decision (GDPR Art 22 safeguard);
    // a contested report jumps the review queue
    #[serde(default)]
    pub contested: Option<TimestampMillis>,
    // Set when an honest-unverified authority report was filed before any verdict (the urgency
    // valve); the verdict remains open and is resolved by a reviewer
    #[serde(default)]
    pub unverified_report_filed: Option<TimestampMillis>,
    // Mirrors the legal hold held bucket-side, so destruction can be refused here rather than
    // silently refused at the bucket after moderators were told the evidence was destroyed
    #[serde(default)]
    pub legal_hold: bool,
    // Mirrors the bucket's release_pending: a release was refused because of the hold, so
    // clearing the hold would perform it and destroy the evidence
    #[serde(default)]
    pub release_pending: bool,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum DetectionSource {
    #[default]
    UserReport,
    Proactive,
}

impl ReportedMessage {
    // True if this report justifies keeping its sender suspended at `now`: an unresolved
    // automated sanction, an upheld-as-CSAM verdict (indefinite suspension), or an upheld
    // violation whose one-day suspension is still running
    pub fn keeps_sender_sanctioned(&self, now: TimestampMillis) -> bool {
        match &self.outcome {
            Some(ReportOutcome::Automated(a)) => match &a.human_verdict {
                // Only sanctions that actually suspended count: an unverified reporter
                // assertion must not block a legitimate unsuspension
                None => self.suspension_applied_without_verdict(),
                Some(v) => match v.verdict {
                    ModerationVerdict::UpheldAsCsam => true,
                    ModerationVerdict::Upheld => v.timestamp.saturating_add(DAY_IN_MS) > now,
                    ModerationVerdict::Dismissed => false,
                },
            },
            _ => false,
        }
    }

    // True if this report requires the sender to stay suspended INDEFINITELY: an auto-sanction
    // still awaiting its verdict, or an upheld-as-CSAM verdict. An upheld non-CSAM violation is
    // not included - it asks for the standard severity, so it must not block another report's
    // verdict from downgrading to that same severity, which would strand the sender on the
    // indefinite suspension after every report had been judged not to be CSAM.
    pub fn requires_indefinite_suspension(&self) -> bool {
        match &self.outcome {
            Some(ReportOutcome::Automated(a)) => match &a.human_verdict {
                None => self.suspension_applied_without_verdict(),
                Some(v) => matches!(v.verdict, ModerationVerdict::UpheldAsCsam),
            },
            _ => false,
        }
    }

    // True while a without-verdict suspension is outstanding on this report
    pub fn suspension_applied_without_verdict(&self) -> bool {
        matches!(&self.outcome, Some(ReportOutcome::Automated(a)) if a.sanctioned && a.human_verdict.is_none())
    }

    pub fn automated_action(&self) -> Option<ModerationAction> {
        match &self.outcome {
            Some(ReportOutcome::Automated(a)) => Some(a.action),
            _ => None,
        }
    }

    // True if this message was judged to have broken the platform rules
    pub fn in_breach(&self) -> bool {
        match &self.outcome {
            Some(ReportOutcome::Modclub(o)) => o.approved < o.rejected,
            // A human verdict always overrides the automated action, so a Dismissed false
            // positive does not count towards the sender's strikes
            Some(ReportOutcome::Automated(a)) => match &a.human_verdict {
                Some(v) => matches!(v.verdict, ModerationVerdict::Upheld | ModerationVerdict::UpheldAsCsam),
                None => a.sanctioned,
            },
            None => false,
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(untagged)]
pub enum ReportOutcome {
    Automated(AutomatedOutcome),
    // Legacy outcomes recorded when reports were reviewed by Modclub
    Modclub(ModclubOutcome),
}

// The outcome of classifying a reported message with the OpenAI Moderation API
#[derive(Serialize, Deserialize, Clone)]
pub struct AutomatedOutcome {
    pub timestamp: TimestampMillis,
    pub flagged_categories: u32,
    pub action: ModerationAction,
    // True only when a suspension was actually applied without a verdict (classifier
    // detections). A reporter-asserted quarantine sets AutoSanctioned action but NOT this:
    // an unverified assertion must never count as a strike nor block an unsuspension.
    #[serde(default)]
    pub sanctioned: bool,
    // True if the OpenAI classification could not be completed (even after retries), in which
    // case flagged_categories being 0 means "unknown" rather than "classified clean"
    #[serde(default)]
    pub classification_failed: bool,
    // Set once a platform moderator has resolved an escalated report
    #[serde(default)]
    pub human_verdict: Option<HumanVerdict>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct HumanVerdict {
    pub verdict: ModerationVerdict,
    pub moderator: UserId,
    pub timestamp: TimestampMillis,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum ModerationAction {
    // CSAM: the message was deleted and the sender suspended, then escalated to the moderators
    AutoSanctioned,
    // Escalated to the internal moderation channel for human review
    EscalatedForHumanReview,
    // Flagged (eg. as adult content) so it can be hidden in the app store build, but no sanction
    FlaggedOnly,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ModclubOutcome {
    pub timestamp: TimestampMillis,
    pub approved: u32,
    pub rejected: u32,
    pub violated_rules: Vec<ViolatedRules>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ViolatedRules {
    pub rule_index: usize,
    pub rejected: u32,
}

pub fn build_message_to_reporter(reported_message: &ReportedMessage, reporter: UserId) -> UserIndexEvent {
    let text = match reported_message.outcome.as_ref().unwrap() {
        ReportOutcome::Automated(outcome) => {
            // If a platform moderator has already resolved this report, give the reporter the
            // verdict rather than telling them it is pending review
            if let Some(verdict) = &outcome.human_verdict {
                return build_verdict_message_to_reporter(reported_message, verdict.verdict, reporter);
            }
            let link = build_message_link(reported_message);
            match outcome.action {
                ModerationAction::AutoSanctioned => format!(
                    "You reported [this message]({link}) for breaking [the platform rules](https://oc.app/guidelines?section=3). Automated moderation determined that it contained prohibited content, so the message has been removed and the sender suspended."
                ),
                ModerationAction::EscalatedForHumanReview => format!(
                    "You reported [this message]({link}) for breaking [the platform rules](https://oc.app/guidelines?section=3). It has been referred to the OpenChat moderation team for review."
                ),
                // Reachable only for legacy outcomes recorded before adult content was
                // prohibited: reported sexual content now escalates for human review
                ModerationAction::FlaggedOnly => format!(
                    "You reported [this message]({link}) for breaking [the platform rules](https://oc.app/guidelines?section=3). Automated moderation classified it as adult content, which at the time did not break the platform rules; it was flagged accordingly."
                ),
            }
        }
        ReportOutcome::Modclub(outcome) => {
            let rejected = outcome.approved < outcome.rejected;
            format!(
                "You reported [this message]({}) for breaking [the platform rules](https://oc.app/guidelines?section=3) and it was referred to [Modclub](https://modclub.ai/) for external moderation. A group of {} moderators decided the message {} the platform rules {} - {}.",
                build_message_link(reported_message),
                outcome.rejected + outcome.approved,
                if rejected { "broke" } else { "didn't break" },
                if rejected { outcome.rejected } else { outcome.approved },
                if rejected { outcome.approved } else { outcome.rejected },
            )
        }
    };

    build_oc_bot_message(text, reporter)
}

pub fn build_verdict_message_to_reporter(
    reported_message: &ReportedMessage,
    verdict: ModerationVerdict,
    reporter: UserId,
) -> UserIndexEvent {
    let link = build_message_link(reported_message);
    let text = match verdict {
        ModerationVerdict::Upheld | ModerationVerdict::UpheldAsCsam => format!(
            "The OpenChat moderation team reviewed [the message you reported]({link}) and confirmed that it broke [the platform rules](https://oc.app/guidelines?section=3). The message has been removed and the sender sanctioned. Thank you for helping to keep OpenChat safe."
        ),
        ModerationVerdict::Dismissed => format!(
            "The OpenChat moderation team reviewed [the message you reported]({link}) and decided that it did not break [the platform rules](https://oc.app/guidelines?section=3)."
        ),
    };

    build_oc_bot_message(text, reporter)
}

pub fn build_verdict_message_to_sender(reported_message: &ReportedMessage) -> UserIndexEvent {
    let text = format!(
        "Your [message]({}) was reported by another user and the OpenChat moderation team confirmed that it broke [the platform rules](https://oc.app/guidelines?section=3). {}",
        build_message_link(reported_message),
        removal_and_suspension_text(reported_message, true),
    );

    build_oc_bot_message(text, reported_message.sender)
}

// Sent when a Dismissed verdict reverses an automated sanction: the statement of reasons for
// the restoration. Deliberately does not disclose whether any agency report was filed.
pub fn build_restoration_message_to_sender(reported_message: &ReportedMessage, unsuspended: bool) -> UserIndexEvent {
    // Only claim an unsuspension when one actually happened: a reporter-asserted takedown
    // never suspended in the first place
    let outcome_text = if unsuspended {
        "The message has been restored and your account unsuspended."
    } else {
        "The message has been restored."
    };
    let text = format!(
        "The OpenChat moderation team reviewed your [message]({}), which had been removed, and determined that it does not break [the platform rules](https://oc.app/guidelines?section=3). {outcome_text} We apologise for the disruption.",
        build_message_link(reported_message),
    );

    build_oc_bot_message(text, reported_message.sender)
}

// The statement of reasons for a hash-match suspension: there is no message and so no report,
// but the user must still be told why and how to require human review. Deliberately does not
// disclose whether any agency report was filed.
pub fn build_upload_sanction_message_to_uploader(user_id: UserId) -> UserIndexEvent {
    let text = "Your account has been suspended. Content you tried to upload matches content which the OpenChat moderation team has confirmed to be child sexual abuse material, which is prohibited by [the platform rules](https://oc.app/guidelines?section=3). \
        If you believe this is wrong you can request that a person reviews the decision, using the button on the suspension notice."
        .to_string();

    build_oc_bot_message(text, user_id)
}

pub fn build_message_to_sender(reported_message: &ReportedMessage, suspended: bool) -> UserIndexEvent {
    let text = format!(
        "Your [message]({}) was reported by another user and automated moderation determined that it contained content which breaks [the platform rules](https://oc.app/guidelines?section=3). {}",
        build_message_link(reported_message),
        removal_and_suspension_text(reported_message, suspended),
    );

    build_oc_bot_message(text, reported_message.sender)
}

// Direct chat messages are never deleted by moderation, so only claim removal for group/channel
// messages
fn removal_and_suspension_text(reported_message: &ReportedMessage, suspended: bool) -> &'static str {
    match (matches!(reported_message.chat_id, Chat::Direct(_)), suspended) {
        (true, true) => "Your account has been suspended.",
        (true, false) => "The report is awaiting review by a moderator.",
        (false, true) => "The message has been removed and your account has been suspended.",
        (false, false) => "The message has been removed pending review by a moderator.",
    }
}

fn build_oc_bot_message(text: String, user_id: UserId) -> UserIndexEvent {
    UserIndexEvent::OpenChatBotMessageV2(Box::new(OpenChatBotMessageV2 {
        user_id,
        thread_root_message_id: None,
        content: MessageContentInitial::Text(TextContent { text }),
        mentioned: Vec::new(),
    }))
}

pub fn build_message_link(reported_message: &ReportedMessage) -> String {
    deep_message_links::build_message_link(
        reported_message.chat_id,
        reported_message.thread_root_message_index,
        reported_message.message_index,
    )
}

#[cfg(test)]
mod tests {
    use candid::Principal;

    use super::*;

    #[test]
    fn reporting_message_returns_expected() {
        let mut reported_messages = ReportedMessages::default();
        let args = dummy_report_args();

        if let AddReportResult::New(index) = reported_messages.add_report(args) {
            assert_eq!(index, 0)
        } else {
            panic!("Expected AddReportResult::New");
        }
    }

    #[test]
    fn reporting_same_message_and_reporter_returns_expected() {
        let mut reported_messages = ReportedMessages::default();
        let args = dummy_report_args();

        reported_messages.add_report(args.clone());

        let result = reported_messages.add_report(args);

        assert_eq!(result, AddReportResult::AlreadyReportedByUser);
    }

    #[test]
    fn reporting_same_message_and_different_reporter_returns_expected() {
        let mut reported_messages = ReportedMessages::default();
        let mut args = dummy_report_args();

        reported_messages.add_report(args.clone());

        args.reporter = Principal::from_text("2yfsq-kaaaa-aaaaf-aaa4q-cai").unwrap().into();
        let result = reported_messages.add_report(args);

        assert!(matches!(result, AddReportResult::ExistingPending(_)));
    }

    #[test]
    fn reporting_same_message_and_different_reporter_with_outcome_returns_expected() {
        let mut reported_messages = ReportedMessages::default();
        let mut args = dummy_report_args();

        reported_messages.add_report(args.clone());
        reported_messages.record_outcome(0, dummy_outcome());

        args.reporter = Principal::from_text("2yfsq-kaaaa-aaaaf-aaa4q-cai").unwrap().into();
        let result = reported_messages.add_report(args);

        assert_eq!(result, AddReportResult::ExistingOutcome(0));
    }

    #[test]
    fn reporting_new_message_and_reporter_returns_expected() {
        let mut reported_messages = ReportedMessages::default();
        let mut args = dummy_report_args();

        reported_messages.add_report(args.clone());
        args.message_index = 2.into();
        args.message_id = 123729212795234236487236419860990447789u128.into();

        if let AddReportResult::New(index) = reported_messages.add_report(args) {
            assert_eq!(index, 1)
        } else {
            panic!("Expected AddReportResult::New");
        }
    }

    #[test]
    fn csam_escalation_of_own_earlier_report_is_acted_on_once() {
        let mut reported_messages = ReportedMessages::default();
        let mut args = dummy_report_args();
        reported_messages.add_report(args.clone());

        // Escalating your own earlier plain report to a CSAM assertion is acted on
        // (ExistingPending routes to the protective path) and registers the asserter
        args.csam = true;
        assert!(matches!(
            reported_messages.add_report(args.clone()),
            AddReportResult::ExistingPending(0)
        ));
        assert_eq!(reported_messages.get(0).unwrap().csam_asserted_by, vec![args.reporter]);

        // Re-asserting is a no-op
        assert!(matches!(
            reported_messages.add_report(args.clone()),
            AddReportResult::AlreadyReportedByUser
        ));
        assert_eq!(reported_messages.get(0).unwrap().csam_asserted_by.len(), 1);
    }

    #[test]
    fn csam_assertion_after_outcome_defers_registration_to_the_caller() {
        let mut reported_messages = ReportedMessages::default();
        let args = dummy_report_args();
        reported_messages.add_report(args.clone());
        reported_messages.record_outcome(0, dummy_outcome());

        let mut second = dummy_report_args();
        second.reporter = Principal::from_text("wowos-hyaaa-aaaar-ar4ca-cai").unwrap().into();
        second.csam = true;
        assert!(matches!(
            reported_messages.add_report(second.clone()),
            AddReportResult::ExistingOutcome(0)
        ));
        // add_report must NOT register the asserter: whether the assertion is acted on (and so
        // whether the asserter carries false-report consequences) is the caller's decision
        assert!(reported_messages.get(0).unwrap().csam_asserted_by.is_empty());
    }

    #[test]
    fn legacy_modclub_outcome_deserializes() {
        let outcome = ReportOutcome::Modclub(ModclubOutcome {
            timestamp: 1706107419000,
            approved: 0,
            rejected: 3,
            violated_rules: vec![ViolatedRules {
                rule_index: 0,
                rejected: 3,
            }],
        });

        let bytes = msgpack::serialize_then_unwrap(&outcome);
        let deserialized: ReportOutcome = msgpack::deserialize_then_unwrap(&bytes);
        assert!(matches!(deserialized, ReportOutcome::Modclub(_)));

        let automated = ReportOutcome::Automated(AutomatedOutcome {
            timestamp: 1706107419000,
            flagged_categories: 2,
            action: ModerationAction::AutoSanctioned,
            sanctioned: true,
            classification_failed: false,
            human_verdict: None,
        });

        let bytes = msgpack::serialize_then_unwrap(&automated);
        let deserialized: ReportOutcome = msgpack::deserialize_then_unwrap(&bytes);
        assert!(matches!(deserialized, ReportOutcome::Automated(_)));
    }

    fn dummy_report_args() -> AddReportArgs {
        AddReportArgs {
            chat_id: Chat::Group(Principal::from_text("wowos-hyaaa-aaaar-ar4ca-cai").unwrap().into()),
            thread_root_message_index: None,
            message_index: 87884.into(),
            message_id: 87672921279501061003607611986099044352u128.into(),
            sender: Principal::from_text("3skqk-iqaaa-aaaaf-aaa3q-cai").unwrap().into(),
            reporter: Principal::from_text("27eue-hyaaa-aaaaf-aaa4a-cai").unwrap().into(),
            already_deleted: false,
            csam: false,
            timestamp: 1706107415000,
        }
    }

    fn dummy_outcome() -> AutomatedOutcome {
        AutomatedOutcome {
            timestamp: 1706107419000,
            flagged_categories: 0,
            action: ModerationAction::EscalatedForHumanReview,
            sanctioned: false,
            classification_failed: false,
            human_verdict: None,
        }
    }
}

#[cfg(test)]
mod report_status_tests {
    use super::*;
    use candid::Principal;

    fn base_report() -> ReportedMessage {
        ReportedMessage {
            chat_id: Chat::Group(Principal::anonymous().into()),
            thread_root_message_index: None,
            message_index: 0.into(),
            message_id: 1u64.into(),
            sender: Principal::anonymous().into(),
            already_deleted: false,
            reports: HashMap::new(),
            outcome: None,
            moderation_channel_message_id: None,
            blob_references: Vec::new(),
            detection: DetectionSource::Proactive,
            media_matches: Vec::new(),
            contested: None,
            unverified_report_filed: None,
            legal_hold: false,
            release_pending: false,
            csam_asserted_by: Vec::new(),
        }
    }

    fn with_verdict(verdict: ModerationVerdict) -> ReportedMessage {
        let mut report = base_report();
        report.outcome = Some(ReportOutcome::Automated(AutomatedOutcome {
            timestamp: 1,
            flagged_categories: 2,
            action: ModerationAction::AutoSanctioned,
            sanctioned: true,
            classification_failed: false,
            human_verdict: Some(HumanVerdict {
                verdict,
                moderator: Principal::anonymous().into(),
                timestamp: 2,
            }),
        }));
        report
    }

    #[test]
    fn status_reflects_report_state() {
        assert!(matches!(
            ReportedMessages::report_status(&base_report()),
            ModerationReportStatus::Pending
        ));

        let mut contested = base_report();
        contested.contested = Some(1);
        assert!(matches!(
            ReportedMessages::report_status(&contested),
            ModerationReportStatus::Contested
        ));

        assert!(matches!(
            ReportedMessages::report_status(&with_verdict(ModerationVerdict::Upheld)),
            ModerationReportStatus::Upheld(_)
        ));
        assert!(matches!(
            ReportedMessages::report_status(&with_verdict(ModerationVerdict::UpheldAsCsam)),
            ModerationReportStatus::UpheldAsCsam(_)
        ));
        assert!(matches!(
            ReportedMessages::report_status(&with_verdict(ModerationVerdict::Dismissed)),
            ModerationReportStatus::Dismissed(_)
        ));
    }

    #[test]
    fn a_verdict_takes_precedence_over_contested() {
        let mut report = with_verdict(ModerationVerdict::Dismissed);
        report.contested = Some(1);
        assert!(matches!(
            ReportedMessages::report_status(&report),
            ModerationReportStatus::Dismissed(_)
        ));
    }

    fn with_unverdicted_outcome(sanctioned: bool) -> ReportedMessage {
        let mut report = base_report();
        report.outcome = Some(ReportOutcome::Automated(AutomatedOutcome {
            timestamp: 1,
            flagged_categories: 2,
            action: ModerationAction::AutoSanctioned,
            sanctioned,
            classification_failed: false,
            human_verdict: None,
        }));
        report
    }

    #[test]
    fn reporter_asserted_csam_is_not_a_strike_until_upheld() {
        // A reporter-asserted CSAM report quarantines without suspending (sanctioned: false);
        // it must not count towards the sender's strikes until a moderator upholds it
        let report = with_unverdicted_outcome(false);
        assert!(!report.in_breach());
        assert!(!report.suspension_applied_without_verdict());

        let classifier_detection = with_unverdicted_outcome(true);
        assert!(classifier_detection.in_breach());
        assert!(classifier_detection.suspension_applied_without_verdict());

        // Once a verdict lands, it overrides the automated action in both directions
        assert!(with_verdict(ModerationVerdict::UpheldAsCsam).in_breach());
        assert!(!with_verdict(ModerationVerdict::Dismissed).in_breach());
    }

    #[test]
    fn keeps_sender_sanctioned_matches_suspension_semantics() {
        // Unverdicted: only an actually-applied suspension counts
        assert!(with_unverdicted_outcome(true).keeps_sender_sanctioned(1000));
        assert!(!with_unverdicted_outcome(false).keeps_sender_sanctioned(1000));
        // An upheld-as-CSAM verdict means an indefinite suspension: always counts
        assert!(with_verdict(ModerationVerdict::UpheldAsCsam).keeps_sender_sanctioned(u64::MAX));
        // An upheld violation counts only while its one-day suspension is still running
        // (verdict fixtures are timestamped 2)
        assert!(with_verdict(ModerationVerdict::Upheld).keeps_sender_sanctioned(2 + DAY_IN_MS - 1));
        assert!(!with_verdict(ModerationVerdict::Upheld).keeps_sender_sanctioned(2 + DAY_IN_MS));
        assert!(!with_verdict(ModerationVerdict::Dismissed).keeps_sender_sanctioned(3));
        assert!(!base_report().keeps_sender_sanctioned(3));
    }

    #[test]
    fn only_indefinite_sanctions_block_a_downgrade() {
        // An unresolved auto-sanction and an upheld-as-CSAM verdict both mean an indefinite
        // suspension, which a downgrade to the standard severity must not undo
        assert!(with_unverdicted_outcome(true).requires_indefinite_suspension());
        assert!(with_verdict(ModerationVerdict::UpheldAsCsam).requires_indefinite_suspension());

        // An upheld non-CSAM violation asks for the same severity the downgrade applies, so it
        // must NOT block it - otherwise resolving the last report leaves the sender stranded on
        // the indefinite suspension even though nothing was judged to be CSAM
        assert!(!with_verdict(ModerationVerdict::Upheld).requires_indefinite_suspension());
        assert!(!with_verdict(ModerationVerdict::Dismissed).requires_indefinite_suspension());
        // A reporter assertion never suspended, so it holds nothing indefinite either
        assert!(!with_unverdicted_outcome(false).requires_indefinite_suspension());
        assert!(!base_report().requires_indefinite_suspension());
    }

    #[test]
    fn late_csam_assertion_is_refused_once_a_verdict_stands() {
        let mut reported_messages = ReportedMessages {
            messages: vec![with_verdict(ModerationVerdict::Dismissed)],
            ..Default::default()
        };
        assert!(!reported_messages.assert_csam_if_unverdicted(0, Principal::anonymous().into()));
        assert!(reported_messages.messages[0].csam_asserted_by.is_empty());

        let mut reported_messages = ReportedMessages {
            messages: vec![with_unverdicted_outcome(true)],
            ..Default::default()
        };
        assert!(reported_messages.assert_csam_if_unverdicted(0, Principal::anonymous().into()));
        assert_eq!(reported_messages.messages[0].csam_asserted_by.len(), 1);
        // Idempotent for the same reporter
        assert!(reported_messages.assert_csam_if_unverdicted(0, Principal::anonymous().into()));
        assert_eq!(reported_messages.messages[0].csam_asserted_by.len(), 1);
    }

    #[test]
    fn contest_metrics_reflect_pending_and_resolved_contests() {
        let mut reported_messages = ReportedMessages::default();

        let mut pending = with_unverdicted_outcome(true);
        pending.contested = Some(100);
        let mut older_pending = with_unverdicted_outcome(true);
        older_pending.message_id = 2u64.into();
        older_pending.contested = Some(50);
        let mut resolved = with_verdict(ModerationVerdict::Dismissed);
        resolved.message_id = 3u64.into();
        resolved.contested = Some(1); // verdict timestamp is 2 => latency 1ms

        reported_messages.messages = vec![pending, older_pending, resolved];

        let metrics = reported_messages.metrics();
        assert_eq!(metrics.pending_contests, 2);
        assert_eq!(metrics.oldest_pending_contested_at, Some(50));
        assert_eq!(metrics.mean_contest_resolution_ms, Some(1));
    }
}
