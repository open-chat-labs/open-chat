use chat_events::deep_message_links;
use local_user_index_canister::{Event as LocalUserIndexEvent, OpenChatBotMessage};
use modclub_canister::{getProviderRules::Rule, subscribe::ContentResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{Chat, MessageContent, MessageId, MessageIndex, TextContent, TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct ReportedMessages {
    messages: Vec<ReportedMessage>,
    lookup: HashMap<(Chat, Option<MessageIndex>, MessageIndex), usize>,
    #[serde(default)]
    rules: Vec<Rule>,
}

impl ReportedMessages {
    pub fn set_rules(&mut self, rules: Vec<Rule>) {
        self.rules = rules;
    }

    pub fn add_report(&mut self, args: AddReportArgs) -> AddReportResult {
        if let Some(index) = self
            .lookup
            .get(&(args.chat_id, args.thread_root_message_index, args.message_index))
            .copied()
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
            AddReportResult::New((self.messages.len() - 1) as u64)
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

    pub fn rules(&self) -> &Vec<Rule> {
        &self.rules
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

pub fn build_message_to_reporter(reported_message: &ReportedMessage, reporter: UserId) -> LocalUserIndexEvent {
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

pub fn build_message_to_sender(reported_message: &ReportedMessage) -> LocalUserIndexEvent {
    let outcome = reported_message.outcome.as_ref().unwrap();

    let text = format!(
        "Your [message]({}) was reported by another user for breaking [the platform rules](https://oc.app/guidelines?section=3) and it was referred to [Modclub](https://modclub.ai/) for external moderation. A group of {} moderators decided your message broke the platform rules {} - {}.", 
        build_message_link(reported_message),
        outcome.rejected + outcome.approved,
        outcome.rejected,
        outcome.approved);

    build_oc_bot_message(text, reported_message.sender)
}

fn build_oc_bot_message(text: String, user_id: UserId) -> LocalUserIndexEvent {
    LocalUserIndexEvent::OpenChatBotMessage(Box::new(OpenChatBotMessage {
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
