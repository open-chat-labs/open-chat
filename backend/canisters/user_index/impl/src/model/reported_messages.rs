use chat_events::deep_message_links;
use constants::HOUR_IN_MS;
use local_user_index_canister::{OpenChatBotMessageV2, UserIndexEvent};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{
    BlobReference, Chat, MessageContent, MessageContentInitial, MessageId, MessageIndex, TextContent, TimestampMillis, UserId,
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

            if message.reports.insert(args.reporter, args.timestamp).is_some() {
                AddReportResult::AlreadyReportedByUser
            } else if message.outcome.is_some() {
                AddReportResult::ExistingOutcome(index as u64)
            } else {
                AddReportResult::ExistingPending
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
                contested: None,
                unverified_report_filed: None,
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

    pub fn pending_classification_report_indexes(&self) -> Vec<u64> {
        self.pending_classifications.keys().copied().collect()
    }

    pub fn get(&self, index: u64) -> Option<&ReportedMessage> {
        self.messages.get(index as usize)
    }

    pub fn metrics(&self) -> ReportingMetrics {
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
            classification_failed: false,
            human_verdict: None,
        });

        if let Some(&index) = self.lookup.get(&key) {
            let message = self.messages.get_mut(index).unwrap();
            if message.outcome.is_some() {
                None
            } else {
                message.outcome = Some(outcome);
                message.blob_references = args.blob_references;
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
                contested: None,
                unverified_report_filed: None,
            });
            Some((new_index as u64, true))
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
    pub timestamp: TimestampMillis,
}

#[derive(PartialEq, Debug)]
pub enum AddReportResult {
    New(u64),
    ExistingPending,
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
    // Set when the sanctioned sender contests the automated decision (GDPR Art 22 safeguard);
    // a contested report jumps the review queue
    #[serde(default)]
    pub contested: Option<TimestampMillis>,
    // Set when an honest-unverified authority report was filed before any verdict (the urgency
    // valve); the verdict remains open and is resolved by a reviewer
    #[serde(default)]
    pub unverified_report_filed: Option<TimestampMillis>,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum DetectionSource {
    #[default]
    UserReport,
    Proactive,
}

impl ReportedMessage {
    pub fn has_human_verdict(&self) -> bool {
        matches!(&self.outcome, Some(ReportOutcome::Automated(a)) if a.human_verdict.is_some())
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
                None => matches!(a.action, ModerationAction::AutoSanctioned),
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
                ModerationAction::FlaggedOnly => format!(
                    "You reported [this message]({link}) for breaking [the platform rules](https://oc.app/guidelines?section=3). Automated moderation classified it as adult content which does not break the platform rules, but it has been flagged accordingly."
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
        removal_and_suspension_text(reported_message),
    );

    build_oc_bot_message(text, reported_message.sender)
}

// Sent when a Dismissed verdict reverses an automated sanction: the statement of reasons for
// the restoration. Deliberately does not disclose whether any agency report was filed.
pub fn build_restoration_message_to_sender(reported_message: &ReportedMessage) -> UserIndexEvent {
    let text = format!(
        "The OpenChat moderation team reviewed your [message]({}) which had been removed by automated moderation, and determined that it does not break [the platform rules](https://oc.app/guidelines?section=3). The message has been restored and your account unsuspended. We apologise for the disruption.",
        build_message_link(reported_message),
    );

    build_oc_bot_message(text, reported_message.sender)
}

pub fn build_message_to_sender(reported_message: &ReportedMessage) -> UserIndexEvent {
    let text = format!(
        "Your [message]({}) was reported by another user and automated moderation determined that it contained content which breaks [the platform rules](https://oc.app/guidelines?section=3). {}",
        build_message_link(reported_message),
        removal_and_suspension_text(reported_message),
    );

    build_oc_bot_message(text, reported_message.sender)
}

// Direct chat messages are never deleted by moderation, so only claim removal for group/channel
// messages
fn removal_and_suspension_text(reported_message: &ReportedMessage) -> &'static str {
    if matches!(reported_message.chat_id, Chat::Direct(_)) {
        "Your account has been suspended."
    } else {
        "The message has been removed and your account has been suspended."
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

        assert_eq!(result, AddReportResult::ExistingPending);
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
            timestamp: 1706107415000,
        }
    }

    fn dummy_outcome() -> AutomatedOutcome {
        AutomatedOutcome {
            timestamp: 1706107419000,
            flagged_categories: 0,
            action: ModerationAction::EscalatedForHumanReview,
            classification_failed: false,
            human_verdict: None,
        }
    }
}
