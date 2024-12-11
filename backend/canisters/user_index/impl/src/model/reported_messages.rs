use chat_events::deep_message_links;
use local_user_index_canister::{OpenChatBotMessage, UserIndexEvent};
use modclub_canister::{getProviderRules::Rule, subscribe::ContentResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{Chat, MessageContent, MessageId, MessageIndex, TextContent, TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct ReportedMessages {
    messages: Vec<ReportedMessage>,
    lookup: HashMap<(Chat, Option<MessageIndex>, MessageIndex), usize>,
    rules: Vec<Rule>,
}

impl ReportedMessages {
    #[allow(dead_code)]
    pub fn set_rules(&mut self, rules: Vec<Rule>) {
        self.rules = rules;
    }

    pub fn add_report(&mut self, args: AddReportArgs) -> AddReportResult {
        let new_index = self.messages.len();

        if let Some(index) = self
            .lookup
            .insert((args.chat_id, args.thread_root_message_index, args.message_index), new_index)
        {
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
        } else {
            self.messages.push(ReportedMessage {
                chat_id: args.chat_id,
                thread_root_message_index: args.thread_root_message_index,
                message_index: args.message_index,
                message_id: args.message_id,
                sender: args.sender,
                already_deleted: args.already_deleted,
                reports: HashMap::from([(args.reporter, args.timestamp)]),
                outcome: None,
            });
            AddReportResult::New(new_index as u64)
        }
    }

    pub fn record_outcome(&mut self, result: ContentResult, now: TimestampMillis) -> RecordOutcomeResult {
        let approved = result.approvedCount.0.try_into().unwrap();
        let rejected = result.rejectedCount.0.try_into().unwrap();
        let report_index: u64 = result.sourceId.parse().unwrap();

        let outcome = ReportOutcome {
            timestamp: now,
            approved,
            rejected,
            violated_rules: result
                .violatedRules
                .into_iter()
                .map(|v| ViolatedRules {
                    rule_index: self.index_from_rule_id(v.id),
                    rejected,
                })
                .collect(),
        };

        if let Some(message) = self.messages.get_mut(report_index as usize) {
            if message.outcome.is_some() {
                RecordOutcomeResult::OutcomeExists(report_index)
            } else {
                message.outcome = Some(outcome);
                RecordOutcomeResult::Success(message.clone())
            }
        } else {
            RecordOutcomeResult::ReportNotFound(report_index)
        }
    }

    pub fn get(&self, index: u64) -> Option<&ReportedMessage> {
        self.messages.get(index as usize)
    }

    pub fn metrics(&self) -> ReportingMetrics {
        ReportingMetrics {
            messages_reported: self.messages.len(),
            messages_pending_outcome: self.messages.iter().filter(|m| m.outcome.is_none()).count(),
            rules: self.rules.clone(),
        }
    }

    pub fn iter(&self) -> impl Iterator<Item = &ReportedMessage> {
        self.messages.iter()
    }

    fn index_from_rule_id(&self, rule_id: String) -> usize {
        self.rules.iter().position(|r| r.id == rule_id).unwrap()
    }
}

#[derive(Serialize, Debug)]
pub struct ReportingMetrics {
    pub messages_reported: usize,
    pub messages_pending_outcome: usize,
    pub rules: Vec<Rule>,
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

#[derive(PartialEq, Debug)]
pub enum AddReportResult {
    New(u64),
    ExistingPending,
    ExistingOutcome(u64),
    AlreadyReportedByUser,
}

pub enum RecordOutcomeResult {
    Success(ReportedMessage),
    OutcomeExists(u64),
    ReportNotFound(u64),
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
}

impl ReportedMessage {
    pub fn rejected(&self) -> bool {
        self.outcome.as_ref().map(|o| o.approved < o.rejected).unwrap_or_default()
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ReportOutcome {
    pub timestamp: TimestampMillis,
    pub approved: u32,
    pub rejected: u32,
    pub violated_rules: Vec<ViolatedRules>,
}

impl ReportOutcome {
    pub fn unanimous_rejection_decision(&self, rule_index: Option<usize>) -> bool {
        if self.approved > 0 {
            false
        } else if let Some(i) = rule_index {
            let rejected_given_rule = self
                .violated_rules
                .iter()
                .find(|r| r.rule_index == i)
                .map(|r| r.rejected)
                .unwrap_or_default();

            self.rejected == rejected_given_rule
        } else {
            true
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ViolatedRules {
    #[serde(alias = "rule_id")]
    pub rule_index: usize,
    pub rejected: u32,
}

pub fn build_message_to_reporter(reported_message: &ReportedMessage, reporter: UserId) -> UserIndexEvent {
    let outcome = reported_message.outcome.as_ref().unwrap();
    let rejected = reported_message.rejected();

    let text = format!("You reported [this message]({}) for breaking [the platform rules](https://oc.app/guidelines?section=3) and it was referred to [Modclub](https://modclub.ai/) for external moderation. A group of {} moderators decided the message {} the platform rules {} - {}.",
        build_message_link(reported_message),
        outcome.rejected + outcome.approved,
        if rejected {"broke"} else {"didn't break"},
        if rejected {outcome.rejected} else {outcome.approved},
        if rejected {outcome.approved} else {outcome.rejected},
    );

    build_oc_bot_message(text, reporter)
}

pub fn build_message_to_sender(reported_message: &ReportedMessage) -> UserIndexEvent {
    let outcome = reported_message.outcome.as_ref().unwrap();

    let text = format!(
        "Your [message]({}) was reported by another user for breaking [the platform rules](https://oc.app/guidelines?section=3) and it was referred to [Modclub](https://modclub.ai/) for external moderation. A group of {} moderators decided your message broke the platform rules {} - {}.", 
        build_message_link(reported_message),
        outcome.rejected + outcome.approved,
        outcome.rejected,
        outcome.approved);

    build_oc_bot_message(text, reported_message.sender)
}

fn build_oc_bot_message(text: String, user_id: UserId) -> UserIndexEvent {
    UserIndexEvent::OpenChatBotMessage(Box::new(OpenChatBotMessage {
        user_id,
        message: MessageContent::Text(TextContent { text }),
    }))
}

fn build_message_link(reported_message: &ReportedMessage) -> String {
    deep_message_links::build_message_link(
        reported_message.chat_id,
        reported_message.thread_root_message_index,
        reported_message.message_index,
    )
}

#[cfg(test)]
mod tests {
    use candid::Principal;
    use modclub_canister::subscribe::ContentStatus;

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
        reported_messages.set_rules(vec![Rule {
            description: "Thou shalt not kill".to_string(),
            id: "4bkt6-4aaaa-aaaaf-aaaiq-cai-rule-1".to_string(),
        }]);
        let mut args = dummy_report_args();

        reported_messages.add_report(args.clone());
        reported_messages.record_outcome(dummy_outcome(), 1706107419000);

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

    fn dummy_outcome() -> ContentResult {
        ContentResult {
            approvedCount: 0u32.into(),
            rejectedCount: 3u32.into(),
            sourceId: "0".to_string(),
            status: ContentStatus::rejected,
            violatedRules: vec![modclub_canister::subscribe::ViolatedRules {
                id: "4bkt6-4aaaa-aaaaf-aaaiq-cai-rule-1".to_string(),
                rejectionCount: 3u32.into(),
            }],
        }
    }
}
