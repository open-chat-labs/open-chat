use crate::polls::{InvalidPollReason, PollConfig, PollVotes};
use crate::{
    Achievement, CanisterId, Chat, CompletedCryptoTransaction, CryptoTransaction, CryptoTransferDetails, EncryptionKey,
    MessageId, MessageIndex, MessagePermission, Milliseconds, ModerationInput, P2PSwapStatus, PendingCryptoTransaction,
    ProposalContent, TimestampMillis, TokenInfo, TotalVotes, User, UserId, VideoCallType,
};
use candid::CandidType;
use oc_error_codes::{OCError, OCErrorCode};
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use serde_bytes::ByteBuf;
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
    Encrypted(EncryptedContent),
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
    ModerationReport(ModerationReportContent),
    P2PSwap(P2PSwapContent),
    VideoCall(VideoCallContent),
    Encrypted(EncryptedContent),
    Custom(CustomContent),
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
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
    ModerationReport,
    P2PSwap,
    VideoCall,
    Custom(String),
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum EncryptedMessageContentType {
    Text,
    Image,
    Video,
    Audio,
    File,
    Crypto,
    Giphy,
    Custom(String),
}

impl From<EncryptedMessageContentType> for MessageContentType {
    fn from(value: EncryptedMessageContentType) -> Self {
        match value {
            EncryptedMessageContentType::Text => MessageContentType::Text,
            EncryptedMessageContentType::Image => MessageContentType::Image,
            EncryptedMessageContentType::Video => MessageContentType::Video,
            EncryptedMessageContentType::Audio => MessageContentType::Audio,
            EncryptedMessageContentType::File => MessageContentType::File,
            EncryptedMessageContentType::Crypto => MessageContentType::Crypto,
            EncryptedMessageContentType::Giphy => MessageContentType::Giphy,
            EncryptedMessageContentType::Custom(c) => MessageContentType::Custom(c),
        }
    }
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ContentValidationError {
    Empty,
    TextTooLong(u32),
    InvalidPoll(InvalidPollReason),
    TransferCannotBeZero,
    TransferMustBePending,
    InvalidTypeForForwarding,
    PrizeEndDateInThePast,
    Unauthorized,
}

impl From<ContentValidationError> for OCError {
    fn from(value: ContentValidationError) -> Self {
        OCErrorCode::InvalidMessageContent.with_json(&value)
    }
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
            | MessageContent::ModerationReport(_)
            | MessageContent::P2PSwap(_)
            | MessageContent::VideoCall(_)
            | MessageContent::Encrypted(_)
            | MessageContent::Custom(_) => {}
        }

        references
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
            | MessageContent::ModerationReport(_)
            | MessageContent::VideoCall(_)
            | MessageContent::Encrypted(_)
            | MessageContent::Custom(_) => None,
        }
    }

    pub fn moderation_input(&self) -> ModerationInput {
        let mut input = ModerationInput {
            text: self.text().map(|t| t.to_string()),
            image_urls: Vec::new(),
        };

        match self {
            MessageContent::Image(i) => {
                if let Some(br) = &i.blob_reference {
                    input.image_urls.push(br.url());
                }
            }
            MessageContent::Video(v) => {
                if let Some(br) = &v.image_blob_reference {
                    input.image_urls.push(br.url());
                }
            }
            MessageContent::Giphy(g) => {
                if let Some(variant) = [&g.desktop, &g.mobile]
                    .into_iter()
                    .find(|v| v.mime_type.starts_with("image/"))
                {
                    input.image_urls.push(variant.url.clone());
                }
            }
            MessageContent::Poll(p) => {
                let mut text = input.text.unwrap_or_default();
                for option in p.config.options.iter() {
                    text.push_str(&format!("\n- {option}"));
                }
                input.text = Some(text);
            }
            _ => {}
        }

        input
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
            | MessageContent::ModerationReport(_)
            | MessageContent::P2PSwap(_)
            | MessageContent::VideoCall(_)
            | MessageContent::Encrypted(_)
            | MessageContent::Custom(_) => None,
        }
    }

    pub fn notification_file_name(&self) -> Option<String> {
        match self {
            MessageContent::File(f) => Some(f.name.clone()),
            MessageContent::Image(_)
            | MessageContent::Video(_)
            | MessageContent::Text(_)
            | MessageContent::Audio(_)
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
            | MessageContent::ModerationReport(_)
            | MessageContent::P2PSwap(_)
            | MessageContent::VideoCall(_)
            | MessageContent::Encrypted(_)
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
                symbol: c.transfer.token_symbol().to_string(),
                amount: c.transfer.units(),
            })
        } else {
            None
        }
    }
}

impl MessageContentInitial {
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
            MessageContentInitial::Encrypted(_) | MessageContentInitial::Deleted(_) | MessageContentInitial::Custom(_) => None,
        }
    }

    pub fn contains_crypto_transfer(&self) -> bool {
        matches!(
            self,
            MessageContentInitial::Crypto(_) | MessageContentInitial::Prize(_) | MessageContentInitial::P2PSwap(_)
        )
    }

    pub fn pending_crypto_transfer(&self) -> Option<&PendingCryptoTransaction> {
        let transfer = match self {
            MessageContentInitial::Crypto(c) => &c.transfer,
            MessageContentInitial::Prize(c) => &c.transfer,
            _ => return None,
        };

        if let CryptoTransaction::Pending(pending) = transfer { Some(pending) } else { None }
    }
}

impl From<&MessageContentInitial> for MessagePermission {
    fn from(value: &MessageContentInitial) -> Self {
        match value {
            MessageContentInitial::Text(_) => MessagePermission::Text,
            MessageContentInitial::Image(_) => MessagePermission::Image,
            MessageContentInitial::Video(_) => MessagePermission::Video,
            MessageContentInitial::Audio(_) => MessagePermission::Audio,
            MessageContentInitial::File(_) => MessagePermission::File,
            MessageContentInitial::Poll(_) => MessagePermission::Poll,
            MessageContentInitial::Crypto(_) => MessagePermission::Crypto,
            MessageContentInitial::Giphy(_) => MessagePermission::Giphy,
            MessageContentInitial::Prize(_) => MessagePermission::Prize,
            MessageContentInitial::P2PSwap(_) => MessagePermission::P2pSwap,
            _ => unreachable!(),
        }
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
            MessageContent::ModerationReport(_) => panic!("Cannot send a 'moderation report' message"),
            MessageContent::Encrypted(e) => MessageContentInitial::Encrypted(e),
            MessageContent::Custom(c) => MessageContentInitial::Custom(c),
            MessageContent::P2PSwap(_) | MessageContent::VideoCall(_) => unimplemented!(),
        }
    }
}

// TODO: We shouldn't need this
impl From<MessageContentInitial> for MessageContent {
    fn from(content: MessageContentInitial) -> Self {
        #[expect(deprecated)]
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
                token_symbol: c.transfer.token_symbol().to_string(),
                ledger: c.transfer.ledger_canister_id(),
                end_date: c.end_date,
                caption: c.caption,
                prizes_pending: 0,
                diamond_only: c.diamond_only,
                lifetime_diamond_only: c.lifetime_diamond_only,
                unique_person_only: c.unique_person_only,
                streak_only: c.streak_only,
                requires_captcha: c.requires_captcha,
                min_chit_earned: c.min_chit_earned,
            }),
            MessageContentInitial::MessageReminderCreated(r) => MessageContent::MessageReminderCreated(r),
            MessageContentInitial::MessageReminder(r) => MessageContent::MessageReminder(r),
            MessageContentInitial::Encrypted(e) => MessageContent::Encrypted(e),
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
            MessageContentType::ModerationReport => None,
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
            MessageContentType::ModerationReport => "ModerationReport",
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
            MessageContent::ModerationReport(_) => MessageContentType::ModerationReport,
            MessageContent::P2PSwap(_) => MessageContentType::P2PSwap,
            MessageContent::VideoCall(_) => MessageContentType::VideoCall,
            MessageContent::Encrypted(e) => e.content_type.clone().into(),
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
    // TODO remove the `Option` wrapper here and on `samples` once everything is released
    pub duration_ms: Option<Milliseconds>,
    #[serde(serialize_with = "serialize_samples", deserialize_with = "deserialize_samples", default)]
    #[ts(as = "Option::<ts_export::TSBytes>")]
    pub samples: Option<Vec<u8>>,
}

fn serialize_samples<S: Serializer>(value: &Option<Vec<u8>>, serializer: S) -> Result<S::Ok, S::Error> {
    // Let's not worry about the clone here as this code is only temporary
    value.clone().map(ByteBuf::from).serialize(serializer)
}

fn deserialize_samples<'de, D: Deserializer<'de>>(deserializer: D) -> Result<Option<Vec<u8>>, D::Error> {
    let deserialized: Option<ByteBuf> = Deserialize::deserialize(deserializer)?;
    Ok(deserialized.map(|b| b.into_vec()))
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
    pub requires_captcha: bool,
    pub min_chit_earned: u32,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PrizeContent {
    pub prizes_remaining: u32,
    pub prizes_pending: u32,
    #[deprecated]
    #[ts(skip)]
    pub winners: Vec<UserId>,
    pub winner_count: u32,
    pub user_is_winner: bool,
    pub token_symbol: String,
    pub ledger: CanisterId,
    pub end_date: TimestampMillis,
    pub caption: Option<String>,
    pub diamond_only: bool,
    pub lifetime_diamond_only: bool,
    pub unique_person_only: bool,
    pub streak_only: u16,
    pub requires_captcha: bool,
    pub min_chit_earned: u32,
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

// A moderation alert posted by the user_index into the internal moderation channel
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ModerationReportContent {
    // The index of the report on the user_index, used to resolve the report with a verdict
    pub report_index: Option<u64>,
    pub chat_id: Chat,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub sender: UserId,
    // Empty if the alert was triggered by the automated moderation pipeline
    pub reporters: Vec<UserId>,
    pub flagged_categories: u32,
    // True if the CSAM auto-sanction has already been applied
    pub auto_sanctioned: bool,
    pub content_excerpt: Option<String>,
    // The message's media attachments, held in the evidence vault; viewable only by designated
    // vault reviewers via the explicit Review affordance (no media is ever embedded in alerts)
    #[serde(default)]
    pub blob_references: Vec<BlobReference>,
    pub reported_at: TimestampMillis,
    pub status: ModerationReportStatus,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum ModerationReportStatus {
    Pending,
    // The sanctioned sender has contested the automated decision - prioritise review
    Contested,
    Upheld(ModerationReportResolution),
    UpheldAsCsam(ModerationReportResolution),
    Dismissed(ModerationReportResolution),
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct ModerationReportResolution {
    pub moderator: UserId,
    pub timestamp: TimestampMillis,
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
pub struct EncryptedContent {
    pub content_type: EncryptedMessageContentType,
    pub version: u32,
    pub encrypted_message_key: EncryptionKey,
    pub public_key: EncryptionKey,
    #[serde(with = "serde_bytes")]
    pub encrypted_data: Vec<u8>,
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

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct OgPreviewImage {
    pub url: String,
    pub width: u32,
    pub height: u32,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct OgPreview {
    pub url: String,
    pub title: String,
    pub description: String,
    pub image: Option<OgPreviewImage>,
}
