use crate::{
    Achievement, BotCaller, BotCommand, CanisterId, Chat, EventIndex, MessageContent, MessageId, MessageIndex, Reaction,
    ThreadSummary, UserId,
};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::ops::{Deref, DerefMut};
use ts_export::{ts_export, TSBytes};

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Message {
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub sender: UserId,
    pub content: MessageContent,
    pub bot_context: Option<BotMessageContext>,
    pub replies_to: Option<ReplyContext>,
    pub reactions: Vec<(Reaction, Vec<UserId>)>,
    pub tips: Tips,
    pub thread_summary: Option<ThreadSummary>,
    pub edited: bool,
    pub forwarded: bool,
    pub block_level_markdown: bool,
}

impl Message {
    pub fn achievements(&self, direct: bool, is_thread: bool) -> Vec<Achievement> {
        let mut achievements = Vec::new();

        if let Some(achievement) = self.content.content_type().achievement() {
            achievements.push(achievement);
        }

        if direct {
            achievements.push(Achievement::SentDirectMessage);
        }

        if self.forwarded {
            achievements.push(Achievement::ForwardedMessage);
        }

        if self.replies_to.is_some() {
            achievements.push(Achievement::QuoteReplied);
        } else if is_thread && self.message_index == MessageIndex::from(0) {
            achievements.push(Achievement::RepliedInThread);
        }

        achievements
    }
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ReplyContext {
    pub chat_if_other: Option<(Chat, Option<MessageIndex>)>,
    pub event_index: EventIndex,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupReplyContext {
    pub event_index: EventIndex,
}

#[derive(Serialize)]
pub struct MessageEventPayload {
    pub message_type: String,
    pub chat_type: String,
    pub chat_id: String,
    pub thread: bool,
    pub sender_is_bot: bool,
    #[serde(flatten)]
    pub content_specific_payload: MessageContentEventPayload,
}

#[derive(Serialize)]
pub struct MessageTippedEventPayload {
    pub message_type: String,
    pub chat_type: String,
    pub chat_id: String,
    pub thread: bool,
    pub token: String,
    pub amount: u128,
}

#[derive(Serialize)]
pub struct MessageEditedEventPayload {
    pub message_type: String,
    pub chat_type: String,
    pub chat_id: String,
    pub thread: bool,
    pub already_edited: bool,
    pub old_length: u32,
    pub new_length: u32,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default)]
#[ts(as = "TipsTS")]
pub struct Tips(Vec<(CanisterId, Vec<(UserId, u128)>)>);

impl Deref for Tips {
    type Target = Vec<(CanisterId, Vec<(UserId, u128)>)>;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for Tips {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

impl Tips {
    pub fn new(tips: Vec<(CanisterId, Vec<(UserId, u128)>)>) -> Tips {
        Tips(tips)
    }

    pub fn push(&mut self, ledger: CanisterId, user_id: UserId, amount: u128) {
        if let Some((_, tips)) = self.iter_mut().find(|(c, _)| *c == ledger) {
            if let Some((_, total)) = tips.iter_mut().find(|(u, _)| *u == user_id) {
                *total += amount;
            } else {
                tips.push((user_id, amount));
            }
        } else {
            self.0.push((ledger, vec![(user_id, amount)]));
        }
    }
}

#[allow(dead_code)]
#[ts_export]
#[derive(Serialize, Deserialize)]
pub struct TipsTS(Vec<(TSBytes, Vec<(UserId, u128)>)>);

#[derive(Serialize)]
#[serde(untagged)]
pub enum MessageContentEventPayload {
    Text(TextContentEventPayload),
    Image(ImageOrVideoContentEventPayload),
    Video(ImageOrVideoContentEventPayload),
    Audio(ContentWithCaptionEventPayload),
    File(FileContentEventPayload),
    Poll(PollContentEventPayload),
    Crypto(CryptoContentEventPayload),
    Deleted(DeletedContentEventPayload),
    Giphy(ContentWithCaptionEventPayload),
    GovernanceProposal(GovernanceProposalContentEventPayload),
    PrizeWinner(PrizeWinnerContentEventPayload),
    Prize(PrizeContentEventPayload),
    MessageReminderCreated(MessageReminderContentEventPayload),
    MessageReminder(MessageReminderContentEventPayload),
    ReportedMessage(ReportedMessageContentEventPayload),
    P2PSwap(P2PSwapContentEventPayload),
    Empty,
}

#[derive(Serialize)]
pub struct TextContentEventPayload {
    pub length: u32,
}

#[derive(Serialize)]
pub struct ImageOrVideoContentEventPayload {
    pub caption_length: u32,
    pub height: u32,
    pub width: u32,
}

#[derive(Serialize)]
pub struct ContentWithCaptionEventPayload {
    pub caption_length: u32,
}

#[derive(Serialize)]
pub struct FileContentEventPayload {
    pub caption_length: u32,
    pub file_size: u32,
}

#[derive(Serialize)]
pub struct PollContentEventPayload {
    pub text_length: u32,
    pub options: u32,
    pub anonymous: bool,
    pub show_votes_before_end_date: bool,
    pub allow_multiple_votes_per_user: bool,
    pub allow_user_to_change_vote: bool,
}

#[derive(Serialize)]
pub struct CryptoContentEventPayload {
    pub caption_length: u32,
    pub token: String,
    pub amount: u128,
}

#[derive(Serialize)]
pub struct GovernanceProposalContentEventPayload {
    pub governance_canister_id: String,
}

#[derive(Serialize)]
pub struct PrizeContentEventPayload {
    pub caption_length: u32,
    pub prizes: u32,
    pub token: String,
    pub amount: u128,
    pub diamond_only: bool,
    pub lifetime_diamond_only: bool,
    pub unique_person_only: bool,
    pub streak_only: u16,
}

#[derive(Serialize)]
pub struct PrizeWinnerContentEventPayload {
    pub token: String,
    pub amount: u128,
}

#[derive(Serialize)]
pub struct MessageReminderContentEventPayload {
    pub notes_length: u32,
}

#[derive(Serialize)]
pub struct ReportedMessageContentEventPayload {
    pub reason: u32,
    pub notes_length: u32,
}

#[derive(Serialize)]
pub struct P2PSwapContentEventPayload {
    pub token0: String,
    pub token0_amount: u128,
    pub token1: String,
    pub token1_amount: u128,
    pub caption_length: u32,
}

pub type DeletedContentEventPayload = ();
pub type VideoCallContentEventPayload = ();
pub type CustomContentEventPayload = ();

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct BotMessageContext {
    pub command: Option<BotCommand>,
    pub finalised: bool,
}

impl BotMessageContext {
    pub fn from(caller: &BotCaller, finalised: bool) -> Self {
        BotMessageContext {
            command: caller.initiator.command().cloned(),
            finalised,
        }
    }
}
