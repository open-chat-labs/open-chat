use crate::polls::{InvalidPollReason, PollConfig, PollVotes};
use crate::{
    Achievement, CanisterId, CompletedCryptoTransaction, CryptoTransaction, CryptoTransferDetails, Cryptocurrency,
    MessageIndex, Milliseconds, P2PSwapStatus, ProposalContent, TimestampMillis, TokenInfo, TotalVotes, User, UserId, UserType,
    VideoCallType,
};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt::{Debug, Display, Formatter};
use ts_export::ts_export;

pub const MAX_TEXT_LENGTH: u32 = 10_000;
pub const MAX_TEXT_LENGTH_USIZE: usize = MAX_TEXT_LENGTH as usize;

#[ts_export]
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
    P2PSwap(P2PSwapContentInitial),
    Custom(CustomContent),
}

#[ts_export]
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
    P2PSwap(P2PSwapContent),
    VideoCall(VideoCallContent),
    Custom(CustomContent),
}

#[derive(Clone)]
pub enum MessageContentType {
    Text,
    Image,
    Video,
    Audio,
    File,
    Poll,
    Crypto,
    Deleted,
    Giphy,
    GovernanceProposal,
    Prize,
    PrizeWinner,
    MessageReminderCreated,
    MessageReminder,
    ReportedMessage,
    P2PSwap,
    VideoCall,
    Custom(String),
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ContentValidationError {
    Empty,
    TextTooLong(u32),
    InvalidPoll(InvalidPollReason),
    TransferCannotBeZero,
    InvalidTypeForForwarding,
    PrizeEndDateInThePast,
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
            | MessageContent::P2PSwap(_)
            | MessageContent::VideoCall(_)
            | MessageContent::Custom(_) => {}
        }

        references
    }

    pub fn message_type(&self) -> String {
        let message_type = match self {
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
            MessageContent::P2PSwap(_) => "P2PSwap",
            MessageContent::VideoCall(_) => "VideoCall",
            MessageContent::Custom(c) => &c.kind,
        };

        message_type.to_string()
    }

    pub fn text(&self) -> Option<&str> {
        match self {
            MessageContent::Text(t) => Some(t.text.as_str()),
            MessageContent::Image(i) => i.caption.as_deref(),
            MessageContent::Video(v) => v.caption.as_deref(),
            MessageContent::Audio(a) => a.caption.as_deref(),
            MessageContent::File(f) => f.caption.as_deref(),
            MessageContent::Poll(p) => p.config.text.as_deref(),
            MessageContent::Crypto(c) => c.caption.as_deref(),
            MessageContent::Giphy(g) => g.caption.as_deref(),
            MessageContent::GovernanceProposal(gp) => Some(gp.proposal.title()),
            MessageContent::Prize(p) => p.caption.as_deref(),
            MessageContent::P2PSwap(p) => p.caption.as_deref(),
            MessageContent::Deleted(_)
            | MessageContent::PrizeWinner(_)
            | MessageContent::MessageReminderCreated(_)
            | MessageContent::MessageReminder(_)
            | MessageContent::ReportedMessage(_)
            | MessageContent::VideoCall(_)
            | MessageContent::Custom(_) => None,
        }
    }

    pub fn notification_text(&self, mentioned: &[User], user_groups_mentioned: &[(u32, String)]) -> Option<String> {
        let mut text = self.text()?.to_string();

        // Populate usernames for mentioned users
        for User { user_id, username } in mentioned {
            text = text.replace(&format!("@UserId({user_id})"), &format!("@{username}"));
        }

        // Populate names for mentioned user groups
        for (id, name) in user_groups_mentioned {
            text = text.replace(&format!("@UserGroup({id})"), &format!("@{name}"));
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
            | MessageContent::P2PSwap(_)
            | MessageContent::VideoCall(_)
            | MessageContent::Custom(_) => None,
        }
    }

    pub fn content_type(&self) -> MessageContentType {
        self.into()
    }

    pub fn notification_crypto_transfer_details(&self, mentioned: &[User]) -> Option<CryptoTransferDetails> {
        if let MessageContent::Crypto(c) = self {
            Some(CryptoTransferDetails {
                recipient: c.recipient,
                recipient_username: mentioned
                    .iter()
                    .find(|u| u.user_id == c.recipient)
                    .map(|u| u.username.clone()),
                ledger: c.transfer.ledger_canister_id(),
                symbol: c.transfer.token().token_symbol().to_string(),
                amount: c.transfer.units(),
            })
        } else {
            None
        }
    }
}

impl MessageContentInitial {
    pub fn validate_for_new_message(
        &self,
        is_direct_chat: bool,
        sender_user_type: UserType,
        forwarding: bool,
        now: TimestampMillis,
    ) -> Result<(), ContentValidationError> {
        if forwarding {
            if self.contains_crypto_transfer()
                || matches!(
                    self,
                    MessageContentInitial::Poll(_) | MessageContentInitial::GovernanceProposal(_)
                )
            {
                return Err(ContentValidationError::InvalidTypeForForwarding);
            }
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
            MessageContentInitial::GovernanceProposal(_)
            | MessageContentInitial::MessageReminderCreated(_)
            | MessageContentInitial::MessageReminder(_) => {
                return Err(ContentValidationError::Unauthorized);
            }
            _ => {}
        };

        if self.contains_crypto_transfer() && sender_user_type.is_bot() && !sender_user_type.is_oc_controlled_bot() {
            return Err(ContentValidationError::Unauthorized);
        }

        let is_empty = match self {
            MessageContentInitial::Text(t) => t.text.is_empty(),
            MessageContentInitial::Image(i) => i.blob_reference.is_none(),
            MessageContentInitial::Video(v) => v.video_blob_reference.is_none(),
            MessageContentInitial::Audio(a) => a.blob_reference.is_none(),
            MessageContentInitial::File(f) => f.blob_reference.is_none(),
            MessageContentInitial::Poll(p) => p.config.options.is_empty(),
            MessageContentInitial::Prize(p) => p.prizes_v2.is_empty(),
            MessageContentInitial::Deleted(_) => true,
            MessageContentInitial::Crypto(_)
            | MessageContentInitial::Giphy(_)
            | MessageContentInitial::GovernanceProposal(_)
            | MessageContentInitial::MessageReminderCreated(_)
            | MessageContentInitial::MessageReminder(_)
            | MessageContentInitial::P2PSwap(_)
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
            MessageContentInitial::P2PSwap(p) => p.caption.as_deref(),
            MessageContentInitial::Deleted(_) | MessageContentInitial::Custom(_) => None,
        }
    }

    pub fn contains_crypto_transfer(&self) -> bool {
        matches!(
            self,
            MessageContentInitial::Crypto(_) | MessageContentInitial::Prize(_) | MessageContentInitial::P2PSwap(_)
        )
    }
}

// TODO: We shouldn't need this
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
            MessageContent::P2PSwap(_) | MessageContent::VideoCall(_) => unimplemented!(),
        }
    }
}

// TODO: We shouldn't need this
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
                prizes_remaining: c.prizes_v2.len() as u32,
                winners: Vec::new(),
                winner_count: 0,
                user_is_winner: false,
                token: c.transfer.token(),
                end_date: c.end_date,
                caption: c.caption,
                prizes_pending: 0,
                diamond_only: c.diamond_only,
                lifetime_diamond_only: c.lifetime_diamond_only,
                unique_person_only: c.unique_person_only,
                streak_only: c.streak_only,
            }),
            MessageContentInitial::MessageReminderCreated(r) => MessageContent::MessageReminderCreated(r),
            MessageContentInitial::MessageReminder(r) => MessageContent::MessageReminder(r),
            MessageContentInitial::Custom(c) => MessageContent::Custom(c),
            MessageContentInitial::P2PSwap(_) => unimplemented!(),
        }
    }
}

impl MessageContentType {
    pub fn achievement(&self) -> Option<Achievement> {
        match self {
            MessageContentType::Text => Some(Achievement::SentText),
            MessageContentType::Image => Some(Achievement::SentImage),
            MessageContentType::Video => Some(Achievement::SentVideo),
            MessageContentType::Audio => Some(Achievement::SentAudio),
            MessageContentType::File => Some(Achievement::SentFile),
            MessageContentType::Poll => Some(Achievement::SentPoll),
            MessageContentType::Crypto => Some(Achievement::SentCrypto),
            MessageContentType::Deleted => Some(Achievement::DeletedMessage),
            MessageContentType::Giphy => Some(Achievement::SentGiphy),
            MessageContentType::GovernanceProposal => None,
            MessageContentType::Prize => Some(Achievement::SentPrize),
            MessageContentType::PrizeWinner => None,
            MessageContentType::MessageReminderCreated => Some(Achievement::SentReminder),
            MessageContentType::MessageReminder => Some(Achievement::SentReminder),
            MessageContentType::ReportedMessage => None,
            MessageContentType::P2PSwap => Some(Achievement::SentP2PSwapOffer),
            MessageContentType::VideoCall => Some(Achievement::StartedCall),
            MessageContentType::Custom(c) => {
                if c == "meme_fighter" {
                    Some(Achievement::SentMeme)
                } else {
                    None
                }
            }
        }
    }
}

impl Display for MessageContentType {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            MessageContentType::Text => "Text",
            MessageContentType::Image => "Image",
            MessageContentType::Video => "Video",
            MessageContentType::Audio => "Audio",
            MessageContentType::File => "File",
            MessageContentType::Poll => "Poll",
            MessageContentType::Crypto => "Crypto",
            MessageContentType::Deleted => "Deleted",
            MessageContentType::Giphy => "Giphy",
            MessageContentType::GovernanceProposal => "GovernanceProposal",
            MessageContentType::Prize => "Prize",
            MessageContentType::PrizeWinner => "PrizeWinner",
            MessageContentType::MessageReminderCreated => "MessageReminderCreated",
            MessageContentType::MessageReminder => "MessageReminder",
            MessageContentType::ReportedMessage => "ReportedMessage",
            MessageContentType::P2PSwap => "P2PSwap",
            MessageContentType::VideoCall => "VideoCall",
            MessageContentType::Custom(c) => c,
        };

        f.write_str(s)
    }
}

impl From<&MessageContent> for MessageContentType {
    fn from(value: &MessageContent) -> Self {
        match value {
            MessageContent::Text(_) => MessageContentType::Text,
            MessageContent::Image(_) => MessageContentType::Image,
            MessageContent::Video(_) => MessageContentType::Video,
            MessageContent::Audio(_) => MessageContentType::Audio,
            MessageContent::File(_) => MessageContentType::File,
            MessageContent::Poll(_) => MessageContentType::Poll,
            MessageContent::Crypto(_) => MessageContentType::Crypto,
            MessageContent::Deleted(_) => MessageContentType::Deleted,
            MessageContent::Giphy(_) => MessageContentType::Giphy,
            MessageContent::GovernanceProposal(_) => MessageContentType::GovernanceProposal,
            MessageContent::Prize(_) => MessageContentType::Prize,
            MessageContent::PrizeWinner(_) => MessageContentType::PrizeWinner,
            MessageContent::MessageReminderCreated(_) => MessageContentType::MessageReminderCreated,
            MessageContent::MessageReminder(_) => MessageContentType::MessageReminder,
            MessageContent::ReportedMessage(_) => MessageContentType::ReportedMessage,
            MessageContent::P2PSwap(_) => MessageContentType::P2PSwap,
            MessageContent::VideoCall(_) => MessageContentType::VideoCall,
            MessageContent::Custom(c) => MessageContentType::Custom(c.kind.clone()),
        }
    }
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct TextContent {
    pub text: String,
}

impl From<String> for TextContent {
    fn from(value: String) -> Self {
        TextContent { text: value }
    }
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ImageContent {
    pub width: u32,
    pub height: u32,
    pub thumbnail_data: ThumbnailData,
    pub caption: Option<String>,
    pub mime_type: String,
    pub blob_reference: Option<BlobReference>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GiphyImageVariant {
    pub width: u32,
    pub height: u32,
    pub url: String,
    pub mime_type: String,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GiphyContent {
    pub caption: Option<String>,
    pub title: String,
    pub desktop: GiphyImageVariant,
    pub mobile: GiphyImageVariant,
}

#[ts_export]
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

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct AudioContent {
    pub caption: Option<String>,
    pub mime_type: String,
    pub blob_reference: Option<BlobReference>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct FileContent {
    pub name: String,
    pub caption: Option<String>,
    pub mime_type: String,
    pub file_size: u32,
    pub blob_reference: Option<BlobReference>,
}

#[ts_export]
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

pub enum RegisterVoteResult {
    Success(bool), // The bool specifies if an existing vote was removed or not
    SuccessNoChange,
    PollEnded,
    UserCannotChangeVote,
    OptionIndexOutOfRange,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CryptoContent {
    pub recipient: UserId,
    pub transfer: CryptoTransaction,
    pub caption: Option<String>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PrizeContentInitial {
    pub prizes_v2: Vec<u128>,
    pub transfer: CryptoTransaction,
    pub end_date: TimestampMillis,
    pub caption: Option<String>,
    pub diamond_only: bool,
    pub lifetime_diamond_only: bool,
    pub unique_person_only: bool,
    pub streak_only: u16,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PrizeContent {
    pub prizes_remaining: u32,
    pub prizes_pending: u32,
    pub winners: Vec<UserId>,
    pub winner_count: u32,
    pub user_is_winner: bool,
    pub token: Cryptocurrency,
    pub end_date: TimestampMillis,
    pub caption: Option<String>,
    pub diamond_only: bool,
    pub lifetime_diamond_only: bool,
    pub unique_person_only: bool,
    pub streak_only: u16,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PrizeWinnerContent {
    pub winner: UserId,
    pub transaction: CompletedCryptoTransaction,
    pub prize_message: MessageIndex,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MessageReminderCreatedContent {
    pub reminder_id: u64,
    pub remind_at: TimestampMillis,
    pub notes: Option<String>,
    pub hidden: bool,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MessageReminderContent {
    pub reminder_id: u64,
    pub notes: Option<String>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ReportedMessage {
    pub reports: Vec<MessageReport>,
    pub count: u32,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MessageReport {
    pub reported_by: UserId,
    pub timestamp: TimestampMillis,
    pub reason_code: u32,
    pub notes: Option<String>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct P2PSwapContentInitial {
    pub token0: TokenInfo,
    pub token0_amount: u128,
    pub token1: TokenInfo,
    pub token1_amount: u128,
    pub expires_in: Milliseconds,
    pub caption: Option<String>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct P2PSwapContent {
    pub swap_id: u32,
    pub token0: TokenInfo,
    pub token0_amount: u128,
    pub token1: TokenInfo,
    pub token1_amount: u128,
    pub expires_at: TimestampMillis,
    pub caption: Option<String>,
    pub token0_txn_in: u64,
    pub status: P2PSwapStatus,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct VideoCallContentInitial {
    pub initiator: UserId,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct VideoCallContent {
    pub call_type: VideoCallType,
    pub ended: Option<TimestampMillis>,
    pub participants: Vec<CallParticipant>,
    pub hidden_participants: u32,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CallParticipant {
    pub user_id: UserId,
    pub joined: TimestampMillis,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CustomContent {
    pub kind: String,
    #[serde(with = "serde_bytes")]
    pub data: Vec<u8>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct DeletedBy {
    pub deleted_by: UserId,
    pub timestamp: TimestampMillis,
}

#[ts_export]
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

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct ThumbnailData(pub String);

impl Debug for ThumbnailData {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ThumbnailData").field("byte_length", &self.0.len()).finish()
    }
}
