use crate::polls::{InvalidPollReason, PollConfig, PollVotes};
use crate::{
    CanisterId, CompletedCryptoTransaction, CryptoTransaction, CryptoTransferDetails, Cryptocurrency, MessageIndex,
    ProposalContent, TimestampMillis, TotalVotes, User, UserId, VoteOperation,
};
use candid::{CandidType, Principal};
use ic_ledger_types::Tokens;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fmt::{Debug, Formatter};

pub const MAX_TEXT_LENGTH: u32 = 5_000;
pub const MAX_TEXT_LENGTH_USIZE: usize = MAX_TEXT_LENGTH as usize;
const OPENCHAT_BOT_USER_ID: UserId = UserId::new(Principal::from_slice(&[228, 104, 142, 9, 133, 211, 135, 217, 129, 1]));

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum MessageContentInitial {
    Text(TextContent),
    Image(ImageContent),
    Video(VideoContent),
    Audio(AudioContent),
    File(FileContent),
    Poll(PollContent),
    Crypto(CryptoContent),
    Deleted(DeletedBy),
    Giphy(GiphyContent),
    GovernanceProposal(ProposalContent),
    Prize(PrizeContentInitial),
    MessageReminderCreated(MessageReminderCreatedContent),
    MessageReminder(MessageReminderContent),
    Custom(CustomContent),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum MessageContent {
    Text(TextContent),
    Image(ImageContent),
    Video(VideoContent),
    Audio(AudioContent),
    File(FileContent),
    Poll(PollContent),
    Crypto(CryptoContent),
    Deleted(DeletedBy),
    Giphy(GiphyContent),
    GovernanceProposal(ProposalContent),
    Prize(PrizeContent),
    PrizeWinner(PrizeWinnerContent),
    MessageReminderCreated(MessageReminderCreatedContent),
    MessageReminder(MessageReminderContent),
    ReportedMessage(ReportedMessage),
    Custom(CustomContent),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ContentValidationError {
    Empty,
    TextTooLong(u32),
    InvalidPoll(InvalidPollReason),
    TransferCannotBeZero,
    InvalidTypeForForwarding,
    PrizeEndDateInThePast,
    UnauthorizedToSendProposalMessages,
    Unauthorized,
}

impl MessageContent {
    pub fn blob_references(&self) -> Vec<BlobReference> {
        let mut references = Vec::new();

        match self {
            MessageContent::Image(i) => {
                if let Some(br) = i.blob_reference.clone() {
                    references.push(br);
                }
            }
            MessageContent::Video(v) => {
                if let Some(br) = v.video_blob_reference.clone() {
                    references.push(br);
                }
                if let Some(br) = v.image_blob_reference.clone() {
                    references.push(br);
                }
            }
            MessageContent::Audio(a) => {
                if let Some(br) = a.blob_reference.clone() {
                    references.push(br)
                }
            }
            MessageContent::File(f) => {
                if let Some(br) = f.blob_reference.clone() {
                    references.push(br);
                }
            }
            MessageContent::Text(_)
            | MessageContent::Poll(_)
            | MessageContent::Crypto(_)
            | MessageContent::Deleted(_)
            | MessageContent::Giphy(_)
            | MessageContent::GovernanceProposal(_)
            | MessageContent::Prize(_)
            | MessageContent::PrizeWinner(_)
            | MessageContent::MessageReminderCreated(_)
            | MessageContent::MessageReminder(_)
            | MessageContent::ReportedMessage(_)
            | MessageContent::Custom(_) => {}
        }

        references
    }

    pub fn message_type(&self) -> &'static str {
        match self {
            MessageContent::Text(_) => "Text",
            MessageContent::Image(_) => "Image",
            MessageContent::Video(_) => "Video",
            MessageContent::Audio(_) => "Audio",
            MessageContent::File(_) => "File",
            MessageContent::Poll(_) => "Poll",
            MessageContent::Crypto(_) => "Crypto",
            MessageContent::Deleted(_) => "Deleted",
            MessageContent::Giphy(_) => "Giphy",
            MessageContent::GovernanceProposal(_) => "GovernanceProposal",
            MessageContent::Prize(_) => "Prize",
            MessageContent::PrizeWinner(_) => "PrizeWinner",
            MessageContent::MessageReminderCreated(_) => "MessageReminderCreated",
            MessageContent::MessageReminder(_) => "MessageReminder",
            MessageContent::ReportedMessage(_) => "ReportedMessage",
            MessageContent::Custom(_) => "Custom",
        }
    }

    pub fn notification_text(&self, mentioned: &[User]) -> Option<String> {
        let mut text = match self {
            MessageContent::Text(t) => Some(t.text.clone()),
            MessageContent::Image(i) => i.caption.clone(),
            MessageContent::Video(v) => v.caption.clone(),
            MessageContent::Audio(a) => a.caption.clone(),
            MessageContent::File(f) => f.caption.clone(),
            MessageContent::Poll(p) => p.config.text.clone(),
            MessageContent::Crypto(c) => c.caption.clone(),
            MessageContent::Giphy(g) => g.caption.clone(),
            MessageContent::GovernanceProposal(gp) => Some(gp.proposal.title().to_string()),
            MessageContent::Prize(p) => p.caption.clone(),
            MessageContent::Deleted(_)
            | MessageContent::PrizeWinner(_)
            | MessageContent::MessageReminderCreated(_)
            | MessageContent::MessageReminder(_)
            | MessageContent::ReportedMessage(_)
            | MessageContent::Custom(_) => None,
        }?;

        // Populate usernames for mentioned users
        for User { user_id, username } in mentioned {
            text = text.replace(&format!("@UserId({user_id})"), &format!("@{username}"));
        }

        const MAX_CHARS: usize = 200;
        Some(text.chars().take(MAX_CHARS).collect())
    }

    pub fn notification_image_url(&self) -> Option<String> {
        match self {
            MessageContent::Image(i) => i.blob_reference.as_ref().map(|b| b.url()),
            MessageContent::Video(v) => v.image_blob_reference.as_ref().map(|b| b.url()),
            MessageContent::Text(_)
            | MessageContent::Audio(_)
            | MessageContent::File(_)
            | MessageContent::Poll(_)
            | MessageContent::Crypto(_)
            | MessageContent::Deleted(_)
            | MessageContent::Giphy(_)
            | MessageContent::GovernanceProposal(_)
            | MessageContent::Prize(_)
            | MessageContent::PrizeWinner(_)
            | MessageContent::MessageReminderCreated(_)
            | MessageContent::MessageReminder(_)
            | MessageContent::ReportedMessage(_)
            | MessageContent::Custom(_) => None,
        }
    }

    pub fn notification_crypto_transfer_details(&self, mentioned: &[User]) -> Option<CryptoTransferDetails> {
        if let MessageContent::Crypto(c) = self {
            Some(CryptoTransferDetails {
                recipient: c.recipient,
                recipient_username: mentioned
                    .iter()
                    .find(|u| u.user_id == c.recipient)
                    .map(|u| u.username.clone()),
                ledger: c.transfer.ledger(),
                symbol: c.transfer.token().token_symbol().to_string(),
                amount: c.transfer.units(),
            })
        } else {
            None
        }
    }
}

impl MessageContentInitial {
    pub fn validate_for_new_direct_message(
        &self,
        sender: UserId,
        forwarding: bool,
        now: TimestampMillis,
    ) -> Result<(), ContentValidationError> {
        self.validate_for_new_message(sender, true, forwarding, None, now)
    }

    pub fn validate_for_new_group_message(
        &self,
        sender: UserId,
        forwarding: bool,
        proposals_bot_user_id: UserId,
        now: TimestampMillis,
    ) -> Result<(), ContentValidationError> {
        self.validate_for_new_message(sender, false, forwarding, Some(proposals_bot_user_id), now)
    }

    // Determines if the content is valid for a new message, this should not be called on existing
    // messages
    fn validate_for_new_message(
        &self,
        sender: UserId,
        is_direct_chat: bool,
        forwarding: bool,
        proposals_bot_user_id: Option<UserId>,
        now: TimestampMillis,
    ) -> Result<(), ContentValidationError> {
        if forwarding {
            match self {
                MessageContentInitial::Poll(_) | MessageContentInitial::Crypto(_) | MessageContentInitial::Deleted(_) => {
                    return Err(ContentValidationError::InvalidTypeForForwarding);
                }
                _ => {}
            };
        }

        match self {
            MessageContentInitial::Poll(p) => {
                if let Err(reason) = p.config.validate(is_direct_chat, now) {
                    return Err(ContentValidationError::InvalidPoll(reason));
                }
            }
            MessageContentInitial::Crypto(c) => {
                if c.transfer.is_zero() {
                    return Err(ContentValidationError::TransferCannotBeZero);
                }
            }
            MessageContentInitial::Prize(p) => {
                if p.end_date <= now {
                    return Err(ContentValidationError::PrizeEndDateInThePast);
                }
            }
            MessageContentInitial::GovernanceProposal(_) => {
                if proposals_bot_user_id.map_or(true, |u| u != sender) {
                    return Err(ContentValidationError::UnauthorizedToSendProposalMessages);
                }
            }
            MessageContentInitial::MessageReminderCreated(_) => {
                if sender != OPENCHAT_BOT_USER_ID {
                    return Err(ContentValidationError::Unauthorized);
                }
            }
            MessageContentInitial::MessageReminder(_) => {
                if sender != OPENCHAT_BOT_USER_ID {
                    return Err(ContentValidationError::Unauthorized);
                }
            }
            _ => {}
        };

        let is_empty = match self {
            MessageContentInitial::Text(t) => t.text.is_empty(),
            MessageContentInitial::Image(i) => i.blob_reference.is_none(),
            MessageContentInitial::Video(v) => v.video_blob_reference.is_none(),
            MessageContentInitial::Audio(a) => a.blob_reference.is_none(),
            MessageContentInitial::File(f) => f.blob_reference.is_none(),
            MessageContentInitial::Poll(p) => p.config.options.is_empty(),
            MessageContentInitial::Prize(p) => p.prizes.is_empty(),
            MessageContentInitial::Deleted(_) => true,
            MessageContentInitial::Crypto(_)
            | MessageContentInitial::Giphy(_)
            | MessageContentInitial::GovernanceProposal(_)
            | MessageContentInitial::MessageReminderCreated(_)
            | MessageContentInitial::MessageReminder(_)
            | MessageContentInitial::Custom(_) => false,
        };

        if is_empty {
            Err(ContentValidationError::Empty)
        // Allow GovernanceProposal messages to exceed the max length since they are collapsed on the UI
        } else if self.text_length() > MAX_TEXT_LENGTH_USIZE && !matches!(self, MessageContentInitial::GovernanceProposal(_)) {
            Err(ContentValidationError::TextTooLong(MAX_TEXT_LENGTH))
        } else {
            Ok(())
        }
    }

    pub fn text_length(&self) -> usize {
        self.text().map_or(0, |t| t.chars().count())
    }

    pub fn text(&self) -> Option<&str> {
        match self {
            MessageContentInitial::Text(t) => Some(t.text.as_str()),
            MessageContentInitial::Image(i) => i.caption.as_deref(),
            MessageContentInitial::Video(v) => v.caption.as_deref(),
            MessageContentInitial::Audio(a) => a.caption.as_deref(),
            MessageContentInitial::File(f) => f.caption.as_deref(),
            MessageContentInitial::Poll(p) => p.config.text.as_deref(),
            MessageContentInitial::Crypto(c) => c.caption.as_deref(),
            MessageContentInitial::Giphy(g) => g.caption.as_deref(),
            MessageContentInitial::GovernanceProposal(p) => Some(p.proposal.summary()),
            MessageContentInitial::Prize(p) => p.caption.as_deref(),
            MessageContentInitial::MessageReminderCreated(r) => r.notes.as_deref(),
            MessageContentInitial::MessageReminder(r) => r.notes.as_deref(),
            MessageContentInitial::Deleted(_) | MessageContentInitial::Custom(_) => None,
        }
    }
}

impl From<MessageContent> for MessageContentInitial {
    fn from(content: MessageContent) -> Self {
        match content {
            MessageContent::Audio(c) => MessageContentInitial::Audio(c),
            MessageContent::Crypto(c) => MessageContentInitial::Crypto(c),
            MessageContent::Deleted(c) => MessageContentInitial::Deleted(c),
            MessageContent::File(c) => MessageContentInitial::File(c),
            MessageContent::Giphy(c) => MessageContentInitial::Giphy(c),
            MessageContent::GovernanceProposal(c) => MessageContentInitial::GovernanceProposal(c),
            MessageContent::Image(c) => MessageContentInitial::Image(c),
            MessageContent::Poll(c) => MessageContentInitial::Poll(c),
            MessageContent::Text(c) => MessageContentInitial::Text(c),
            MessageContent::Video(c) => MessageContentInitial::Video(c),
            MessageContent::Prize(_) => panic!("Cannot convert output prize to initial prize"),
            MessageContent::PrizeWinner(_) => panic!("Cannot send a prize winner message"),
            MessageContent::MessageReminderCreated(r) => MessageContentInitial::MessageReminderCreated(r),
            MessageContent::MessageReminder(r) => MessageContentInitial::MessageReminder(r),
            MessageContent::ReportedMessage(_) => panic!("Cannot send a 'reported message' message"),
            MessageContent::Custom(c) => MessageContentInitial::Custom(c),
        }
    }
}

impl From<MessageContentInitial> for MessageContent {
    fn from(content: MessageContentInitial) -> Self {
        match content {
            MessageContentInitial::Audio(c) => MessageContent::Audio(c),
            MessageContentInitial::Crypto(c) => MessageContent::Crypto(c),
            MessageContentInitial::Deleted(c) => MessageContent::Deleted(c),
            MessageContentInitial::File(c) => MessageContent::File(c),
            MessageContentInitial::Giphy(c) => MessageContent::Giphy(c),
            MessageContentInitial::GovernanceProposal(c) => MessageContent::GovernanceProposal(c),
            MessageContentInitial::Image(c) => MessageContent::Image(c),
            MessageContentInitial::Poll(c) => MessageContent::Poll(c),
            MessageContentInitial::Text(c) => MessageContent::Text(c),
            MessageContentInitial::Video(c) => MessageContent::Video(c),
            MessageContentInitial::Prize(c) => MessageContent::Prize(PrizeContent {
                prizes_remaining: c.prizes.len() as u32,
                winners: Vec::new(),
                token: c.transfer.token(),
                end_date: c.end_date,
                caption: c.caption,
                prizes_pending: 0,
            }),
            MessageContentInitial::MessageReminderCreated(r) => MessageContent::MessageReminderCreated(r),
            MessageContentInitial::MessageReminder(r) => MessageContent::MessageReminder(r),
            MessageContentInitial::Custom(c) => MessageContent::Custom(c),
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct TextContent {
    pub text: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ImageContent {
    pub width: u32,
    pub height: u32,
    pub thumbnail_data: ThumbnailData,
    pub caption: Option<String>,
    pub mime_type: String,
    pub blob_reference: Option<BlobReference>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GiphyImageVariant {
    pub width: u32,
    pub height: u32,
    pub url: String,
    pub mime_type: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GiphyContent {
    pub caption: Option<String>,
    pub title: String,
    pub desktop: GiphyImageVariant,
    pub mobile: GiphyImageVariant,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct VideoContent {
    pub width: u32,
    pub height: u32,
    pub thumbnail_data: ThumbnailData,
    pub caption: Option<String>,
    pub mime_type: String,
    pub image_blob_reference: Option<BlobReference>,
    pub video_blob_reference: Option<BlobReference>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct AudioContent {
    pub caption: Option<String>,
    pub mime_type: String,
    pub blob_reference: Option<BlobReference>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct FileContent {
    pub name: String,
    pub caption: Option<String>,
    pub mime_type: String,
    pub file_size: u32,
    pub blob_reference: Option<BlobReference>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PollContent {
    pub config: PollConfig,
    pub votes: PollVotes,
    pub ended: bool,
}

impl PollContent {
    pub fn initialize_votes(&mut self) {
        let total_votes: TotalVotes;
        if self.config.end_date.is_some() && !self.config.show_votes_before_end_date {
            total_votes = TotalVotes::Hidden(0);
        } else if self.config.anonymous {
            total_votes = TotalVotes::Anonymous(HashMap::new());
        } else {
            total_votes = TotalVotes::Visible(HashMap::new());
        }

        self.votes = PollVotes {
            total: total_votes,
            user: Vec::new(),
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PollContentInternal {
    pub config: PollConfig,
    pub votes: HashMap<u32, Vec<UserId>>,
    pub ended: bool,
}

impl PollContentInternal {
    pub fn hydrate(&self, my_user_id: Option<UserId>) -> PollContent {
        let user_votes = if let Some(user_id) = my_user_id {
            self.votes
                .iter()
                .filter(|(_, v)| v.contains(&user_id))
                .map(|(k, _)| *k)
                .collect()
        } else {
            Vec::new()
        };

        let total_votes: TotalVotes;
        let hide_votes = self.config.end_date.is_some() && !self.ended && !self.config.show_votes_before_end_date;
        if hide_votes {
            total_votes = TotalVotes::Hidden(self.votes.values().map(|v| v.len() as u32).sum());
        } else if self.config.anonymous {
            total_votes = TotalVotes::Anonymous(self.votes.iter().map(|(k, v)| (*k, v.len() as u32)).collect());
        } else {
            total_votes = TotalVotes::Visible(self.votes.clone());
        }

        PollContent {
            config: self.config.clone(),
            votes: PollVotes {
                total: total_votes,
                user: user_votes,
            },
            ended: self.ended,
        }
    }

    pub fn register_vote(&mut self, user_id: UserId, option_index: u32, operation: VoteOperation) -> RegisterVoteResult {
        if self.ended {
            RegisterVoteResult::PollEnded
        } else if option_index > (self.config.options.len() as u32) + 1 {
            RegisterVoteResult::OptionIndexOutOfRange
        } else {
            match operation {
                VoteOperation::RegisterVote => {
                    let votes = self.votes.entry(option_index).or_default();
                    if votes.contains(&user_id) {
                        return RegisterVoteResult::SuccessNoChange;
                    }
                    votes.push(user_id);
                    let mut existing_vote_removed = false;
                    if !self.config.allow_multiple_votes_per_user {
                        // If the user has already left a vote, remove it
                        for (_, votes) in self.votes.iter_mut().filter(|(&o, _)| o != option_index) {
                            if let Some((index, _)) = votes.iter().enumerate().find(|(_, &u)| u == user_id) {
                                votes.remove(index);
                                existing_vote_removed = true;
                                break;
                            }
                        }
                    }
                    RegisterVoteResult::Success(existing_vote_removed)
                }
                VoteOperation::DeleteVote => {
                    if let Some(votes) = self.votes.get_mut(&option_index) {
                        if let Some((index, _)) = votes.iter().enumerate().find(|(_, &u)| u == user_id) {
                            votes.remove(index);
                            return RegisterVoteResult::Success(true);
                        }
                    }
                    RegisterVoteResult::SuccessNoChange
                }
            }
        }
    }
}

pub enum RegisterVoteResult {
    Success(bool), // The bool specifies if an existing vote was removed or not
    SuccessNoChange,
    PollEnded,
    OptionIndexOutOfRange,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CryptoContent {
    pub recipient: UserId,
    pub transfer: CryptoTransaction,
    pub caption: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PrizeContentInitial {
    pub prizes: Vec<Tokens>,
    pub transfer: CryptoTransaction,
    pub end_date: TimestampMillis,
    pub caption: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PrizeContentInternal {
    pub prizes_remaining: Vec<Tokens>,
    pub reservations: HashSet<UserId>,
    pub winners: HashSet<UserId>,
    pub transaction: CryptoTransaction,
    pub end_date: TimestampMillis,
    pub caption: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PrizeContent {
    pub prizes_remaining: u32,
    pub prizes_pending: u32,
    pub winners: Vec<UserId>,
    pub token: Cryptocurrency,
    pub end_date: TimestampMillis,
    pub caption: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PrizeWinnerContent {
    pub winner: UserId,
    pub transaction: CompletedCryptoTransaction,
    pub prize_message: MessageIndex,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MessageReminderCreatedContent {
    pub reminder_id: u64,
    pub remind_at: TimestampMillis,
    pub notes: Option<String>,
    pub hidden: bool,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MessageReminderContent {
    pub reminder_id: u64,
    pub notes: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ReportedMessage {
    pub reports: Vec<MessageReport>,
    pub count: u32,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ReportedMessageInternal {
    pub reports: Vec<MessageReport>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MessageReport {
    pub reported_by: UserId,
    pub timestamp: TimestampMillis,
    pub reason_code: u32,
    pub notes: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CustomContent {
    pub kind: String,
    #[serde(with = "serde_bytes")]
    pub data: Vec<u8>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct DeletedBy {
    pub deleted_by: UserId,
    pub timestamp: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct BlobReference {
    pub canister_id: CanisterId,
    pub blob_id: u128,
}

impl BlobReference {
    pub fn url(&self) -> String {
        format!("https://{}.raw.icp0.io/files/{}", self.canister_id, self.blob_id)
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct ThumbnailData(pub String);

impl Debug for ThumbnailData {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ThumbnailData").field("byte_length", &self.0.len()).finish()
    }
}
