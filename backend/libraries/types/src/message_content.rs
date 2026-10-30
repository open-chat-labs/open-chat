use crate::polls::{InvalidPollReason, PollConfig, PollVotes};
use crate::{
    Achievement, CanisterId, Chat, CompletedCryptoTransaction, CryptoTransaction, CryptoTransferDetails, EncryptionKey,
    MessageId, MessageIndex, MessagePermission, Milliseconds, MiniAppDefinition, ModerationInput, P2PSwapStatus,
    PendingCryptoTransaction, ProposalContent, TimestampMillis, TokenInfo, TotalVotes, User, UserId, VideoCallType, icrc1,
};
use candid::CandidType;
use oc_error_codes::{OCError, OCErrorCode};
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use serde_bytes::ByteBuf;
use std::collections::{HashMap, HashSet};
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
    PriceChart(PriceChartContent),
    MiniApp(MiniAppContent),
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
    PriceChart(PriceChartContent),
    MiniApp(MiniAppContent),
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
    PriceChart,
    MiniApp,
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
    InvalidPriceChart(String),
    InvalidMiniApp(String),
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
            | MessageContent::MiniApp(_)
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
            | MessageContent::Custom(_)
            | MessageContent::PriceChart(_) => {}
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
            MessageContent::PriceChart(c) => Some(c.title.as_str()),
            MessageContent::MiniApp(c) => Some(c.text.as_str()),
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
            MessageContent::MiniApp(m) => {
                if let Some(result) = m.status.result() {
                    input.text = Some(format!("{}\n{result}", input.text.unwrap_or_default()));
                }
            }
            _ => {}
        }

        input
    }

    // The media which the scanning pipeline hashes: still images only. Image content always;
    // File content regardless of its declared mime type (the declaration is client-supplied
    // and must not gate the scan - the worker's decoder decides what is actually an image,
    // reporting everything else Unscannable); the Video inline thumbnail, which is itself a
    // still image rendered in the chat (keyframes of the video stream await extraction in v2).
    // Giphy variants are third-party URLs, not OpenChat blobs.
    pub fn scannable_blobs(&self) -> Vec<crate::MediaScanBlob> {
        match self {
            MessageContent::Image(i) => i
                .blob_reference
                .clone()
                .map(|blob_reference| crate::MediaScanBlob {
                    blob_reference,
                    mime_type: i.mime_type.clone(),
                    frame_index: None,
                })
                .into_iter()
                .collect(),
            MessageContent::File(f) => f
                .blob_reference
                .clone()
                .map(|blob_reference| crate::MediaScanBlob {
                    blob_reference,
                    mime_type: f.mime_type.clone(),
                    frame_index: None,
                })
                .into_iter()
                .collect(),
            MessageContent::Video(v) => v
                .image_blob_reference
                .clone()
                .map(|blob_reference| crate::MediaScanBlob {
                    blob_reference,
                    mime_type: "image/*".to_string(),
                    frame_index: None,
                })
                .into_iter()
                .collect(),
            _ => Vec::new(),
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
            | MessageContent::ModerationReport(_)
            | MessageContent::P2PSwap(_)
            | MessageContent::VideoCall(_)
            | MessageContent::Encrypted(_)
            | MessageContent::Custom(_)
            | MessageContent::PriceChart(_)
            | MessageContent::MiniApp(_) => None,
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
            | MessageContent::Custom(_)
            | MessageContent::PriceChart(_)
            | MessageContent::MiniApp(_) => None,
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
            MessageContentInitial::PriceChart(c) => Some(c.title.as_str()),
            MessageContentInitial::MiniApp(c) => Some(c.text.as_str()),
            MessageContentInitial::Encrypted(_) | MessageContentInitial::Deleted(_) | MessageContentInitial::Custom(_) => None,
        }
    }

    pub fn contains_crypto_transfer(&self) -> bool {
        matches!(
            self,
            MessageContentInitial::Crypto(_) | MessageContentInitial::Prize(_) | MessageContentInitial::P2PSwap(_)
        )
    }

    // Whether the message holds a transfer which is still to be made. An OpenChat bot's message may
    // hold a transfer the bot has made already.
    pub fn has_transfer_to_make(&self) -> bool {
        self.pending_crypto_transfer().is_some() || matches!(self, MessageContentInitial::P2PSwap(_))
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
            // a chart is a picture
            MessageContentInitial::PriceChart(_) => MessagePermission::Image,
            MessageContentInitial::MiniApp(_) => MessagePermission::MiniApp,
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
            MessageContent::PriceChart(c) => MessageContentInitial::PriceChart(c),
            MessageContent::MiniApp(c) => MessageContentInitial::MiniApp(c),
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
            MessageContentInitial::PriceChart(c) => MessageContent::PriceChart(c),
            MessageContentInitial::MiniApp(c) => MessageContent::MiniApp(c),
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
            MessageContentType::PriceChart | MessageContentType::MiniApp => None,
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
            MessageContentType::PriceChart => "PriceChart",
            MessageContentType::MiniApp => "MiniApp",
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
            MessageContent::PriceChart(_) => MessageContentType::PriceChart,
            MessageContent::MiniApp(_) => MessageContentType::MiniApp,
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
        let total_votes = if self.config.end_date.is_some() && !self.config.show_votes_before_end_date {
            TotalVotes::Hidden(0)
        } else if self.config.anonymous {
            TotalVotes::Anonymous(HashMap::new())
        } else {
            TotalVotes::Visible(HashMap::new())
        };

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
    // Distinguishes "the classifier found nothing" (false, no flagged categories) from "the
    // classifier could not check this content" (true - API failure after retries): a failed
    // classification must never present as a clean one
    #[serde(default)]
    #[ts(as = "Option<bool>", optional)]
    pub classification_failed: bool,
    // True if the CSAM auto-sanction has already been applied
    pub auto_sanctioned: bool,
    pub content_excerpt: Option<String>,
    // The message's media attachments, held in the evidence vault; viewable only by designated
    // vault reviewers via the explicit Review affordance (no media is ever embedded in alerts)
    #[serde(default)]
    pub blob_references: Vec<BlobReference>,
    // Present when the detection was a media hash match rather than the text classifier: the
    // provider's record details, retained as the audit trail and for the authority report
    #[serde(default)]
    pub media_matches: Vec<crate::MediaScanMatch>,
    // True for a report of a blocked re-post attempt: no message of its own exists and it is
    // never resolved directly (it mirrors its original report), so the card must not offer
    // verdict actions
    #[serde(default)]
    #[ts(as = "Option<bool>", optional)]
    pub is_blocked_attempt: bool,
    pub reported_at: TimestampMillis,
    pub status: ModerationReportStatus,
    // Present on UpheldAsCsam reports: whether the authority (NCA) report is still due or has
    // been filed, so the filing workflow lives on the report card itself
    #[serde(default)]
    #[ts(optional)]
    pub authority_report: Option<AuthorityReportState>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum AuthorityReportState {
    Due {
        urgent: bool,
    },
    Filed {
        portal_reference: String,
    },
    // An automated filing is in flight (an attempt marker is open). A marker much older than
    // a filing takes means the service crashed mid-flight and a human must reconcile (check
    // the portal's "Previously submitted reports") before anything re-files.
    Attempting {
        started_at: TimestampMillis,
    },
    // The automated filing failed against a portal outage (5xx/timeout after retries): for
    // P1/P2 the contingency path (email + phone) is required, P3 waits for the portal
    ContingencyRequired {
        error: String,
        // Carried from the due entry so a retry (automated or manual) keeps the priority
        #[serde(default)]
        #[ts(as = "Option<bool>", optional)]
        urgent: bool,
    },
    // The NCA rejected the payload (400) - our defect; file via the web form and raise a bug
    ValidationFailed {
        error: String,
        #[serde(default)]
        #[ts(as = "Option<bool>", optional)]
        urgent: bool,
    },
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
    // The account token0 is deposited from, defaulting to the user's wallet. The deposit is pulled via
    // ICRC-2 by the canister taking it (the user's canister, or the group or community the swap is
    // offered in), spending only an approval made under the user's own spender subaccount (see
    // `ledger_utils::spender_subaccount`).
    pub from_account: Option<icrc1::Account>,
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
    #[serde(default)]
    #[ts(as = "Option<bool>", optional)]
    pub audio_only: bool,
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

/// A chart of token prices, which the frontend draws so that readers can see the price at any
/// time. Only a bot can send one, needing the Image permission, though anyone can forward one.
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PriceChartContent {
    // eg. "CHAT · 30 days": the chart's text, in notifications, previews and search
    pub title: String,
    // the time drawn: each line runs on flat from its last price to `end`
    pub start: TimestampMillis,
    pub end: TimestampMillis,
    // one token's prices are drawn in USD, several tokens' as their change since `start`
    pub series: Vec<PriceChartSeries>,
    // where the prices are from, credited with links under the chart
    pub sources: Vec<PriceChartSource>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PriceChartSeries {
    pub token: PriceChartToken,
    pub symbol: String,
    pub name: String,
    // each time and its price in USD
    pub points: Vec<(TimestampMillis, f64)>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum PriceChartToken {
    // a token on the Internet Computer, by its ledger
    Ledger(CanisterId),
    // any other coin, by its CoinGecko id, eg. "cardano"
    Coin(String),
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PriceChartSource {
    pub name: String,
    pub url: String,
}

impl PriceChartContent {
    pub const MAX_TITLE_CHARS: usize = 100;
    pub const MAX_SERIES: usize = 5;
    // across all the series
    pub const MAX_POINTS: usize = 1_000;
    pub const MAX_SOURCES: usize = 3;
    const MAX_SYMBOL_CHARS: usize = 20;
    const MAX_NAME_CHARS: usize = 50;
    const MAX_COIN_ID_CHARS: usize = 100;
    const MAX_URL_CHARS: usize = 200;

    pub fn validate(&self) -> Result<(), String> {
        check_chars("title", &self.title, Self::MAX_TITLE_CHARS)?;
        if self.start >= self.end {
            return Err("The start must be before the end".to_string());
        }
        if self.series.is_empty() || self.series.len() > Self::MAX_SERIES {
            return Err(format!("A chart has 1 to {} series", Self::MAX_SERIES));
        }
        if self.series.iter().map(|s| s.points.len()).sum::<usize>() > Self::MAX_POINTS {
            return Err(format!("A chart has at most {} points", Self::MAX_POINTS));
        }
        for series in &self.series {
            check_chars("symbol", &series.symbol, Self::MAX_SYMBOL_CHARS)?;
            check_chars("name", &series.name, Self::MAX_NAME_CHARS)?;
            if let PriceChartToken::Coin(id) = &series.token {
                check_chars("coin id", id, Self::MAX_COIN_ID_CHARS)?;
            }
            if series.points.is_empty() {
                return Err(format!("{} has no prices", series.symbol));
            }
            let mut previous = None;
            for &(timestamp, usd) in &series.points {
                if timestamp < self.start || timestamp > self.end || previous.is_some_and(|p| timestamp <= p) {
                    return Err(format!(
                        "{}'s times must be increasing, between the start and end",
                        series.symbol
                    ));
                }
                if !usd.is_finite() || usd <= 0.0 {
                    return Err(format!("{}'s prices must be above 0", series.symbol));
                }
                previous = Some(timestamp);
            }
        }
        if self.sources.is_empty() || self.sources.len() > Self::MAX_SOURCES {
            return Err(format!("A chart credits 1 to {} sources", Self::MAX_SOURCES));
        }
        for source in &self.sources {
            check_chars("source", &source.name, Self::MAX_NAME_CHARS)?;
            check_chars("source url", &source.url, Self::MAX_URL_CHARS)?;
            if !source.url.starts_with("https://") {
                return Err(format!("{}'s url must be https", source.name));
            }
        }
        Ok(())
    }
}

/// A bot's card for a game, or another app, it hosts. Its text, app, player limit and whether others
/// can watch are set when it's posted and never change. Its status is written only by the MiniApp
/// service (`update_mini_app` on the LocalUserIndex, with a `MiniAppStatusUpdate`): the players the
/// game starts with, who joined through the service and were accepted by the bot, its settings, fixed
/// then, whose turn it is, and then its result. Who's joined so far, while the game's taking players,
/// is shown live by the service. Everything else the app shows, its board
/// and buttons, is the bot's own page, which OpenChat opens from the card in a frame. The app's image,
/// from the bot's definition, is shown whenever there's no app to show. Only a bot can send one,
/// needing the MiniApp permission. It can't be forwarded, edited, or sent in a direct chat.
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MiniAppContent {
    // markdown, eg. "**Uno** · 2 to 4 players": the message's text in notifications, previews and
    // search
    pub text: String,
    // which of the bot's apps, by its name in the bot's definition, eg. "chess"
    pub app: String,
    // the most who can play, if there's a limit, so the card can show eg. "2 of 4"
    pub max_players: Option<u32>,
    // whether people who aren't playing can watch: members, and anyone who can see a public chat
    pub spectators: bool,
    // the size the app's designed for, in CSS pixels, eg. 440 by 740: the card shows the app at that
    // aspect ratio, sized before the app loads, so the chat doesn't jump as it does
    pub app_size: MiniAppSize,
    pub status: MiniAppStatus,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct MiniAppSize {
    pub width: u32,
    pub height: u32,
}

// In the order a game goes through them, which it only ever moves forward through
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default, PartialEq, Eq)]
pub enum MiniAppStatus {
    // taking players
    #[default]
    Open,
    // being played
    Active(MiniAppActive),
    // over, after which the card never changes
    Finished(MiniAppFinished),
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct MiniAppActive {
    // who the game started with, in the order they joined
    pub players: Vec<UserId>,
    // the players whose turn it is, or no one in particular, eg. in a game without turns
    pub waiting_for: Vec<UserId>,
    // the game's settings, fixed when it started, as JSON the bot chose, which its app reads: eg. the
    // winning tile and the time limit. None if the bot gave none. OpenChat never reads or shows them.
    pub settings: Option<String>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct MiniAppFinished {
    // who the game started with, or no one if it never started
    pub players: Vec<UserId>,
    // eg. "Bob won", or none if the game was abandoned
    pub result: Option<String>,
    // how the game ended, as JSON the bot chose, which its app shows in the card: eg. the final
    // position and the moves. None if the bot gave none, when the card shows the app's image instead.
    pub end_state: Option<String>,
    // the game's settings, as the card recorded them when it started, or none if it never started or
    // the bot gave none
    pub settings: Option<String>,
}

/// What the MiniApp service writes to a card as its game goes on
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum MiniAppStatusUpdate {
    // The game started, with its players
    Started(MiniAppStarted),
    // Whose turn it is now
    Turn(MiniAppTurn),
    // The game finished, with the players it started with, if it did
    Ended(MiniAppEnded),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct MiniAppStarted {
    pub players: Vec<UserId>,
    pub waiting_for: Vec<UserId>,
    // JSON the bot chose, which the card records for the game's life
    pub settings: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct MiniAppTurn {
    pub waiting_for: Vec<UserId>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct MiniAppEnded {
    // eg. "Bob won", or none if the game was abandoned
    pub result: Option<String>,
    // JSON, which the card's app shows as how the game ended
    pub end_state: Option<String>,
}

impl MiniAppStatus {
    pub fn players(&self) -> &[UserId] {
        match self {
            MiniAppStatus::Open => &[],
            MiniAppStatus::Active(active) => &active.players,
            MiniAppStatus::Finished(finished) => &finished.players,
        }
    }

    pub fn result(&self) -> Option<&str> {
        match self {
            MiniAppStatus::Finished(finished) => finished.result.as_deref(),
            _ => None,
        }
    }

    // The game's settings, once it has started
    pub fn settings(&self) -> Option<&str> {
        match self {
            MiniAppStatus::Open => None,
            MiniAppStatus::Active(active) => active.settings.as_deref(),
            MiniAppStatus::Finished(finished) => finished.settings.as_deref(),
        }
    }
}

impl MiniAppContent {
    pub const MAX_TEXT_CHARS: usize = 2_000;
    pub const MAX_PLAYERS: usize = 100;
    // an app's size is in pixels, no more than this each way, and no taller or wider than this ratio
    pub const MAX_APP_SIZE: u32 = 10_000;
    pub const MAX_APP_SIZE_RATIO: u32 = 3;
    pub const MAX_RESULT_CHARS: usize = 200;
    pub const MAX_APP_NAME_CHARS: usize = MiniAppDefinition::MAX_NAME_CHARS;
    // an end state is JSON of at most this many bytes
    pub const MAX_END_STATE_BYTES: usize = 16 * 1024;
    // a game's settings are JSON of at most this many bytes
    pub const MAX_SETTINGS_BYTES: usize = 4 * 1024;

    // A card as the bot posts it: open, as only the MiniApp service writes its status
    pub fn validate_new(&self) -> Result<(), String> {
        if self.status != MiniAppStatus::Open {
            return Err("A game is posted open".to_string());
        }
        self.validate()
    }

    pub fn validate(&self) -> Result<(), String> {
        check_chars("text", &self.text, Self::MAX_TEXT_CHARS)?;
        check_chars("app", &self.app, Self::MAX_APP_NAME_CHARS)?;
        if self
            .max_players
            .is_some_and(|max| max == 0 || max as usize > Self::MAX_PLAYERS)
        {
            return Err(format!("A game has 1 to {} players at most", Self::MAX_PLAYERS));
        }
        let size = self.app_size;
        if size.width == 0 || size.height == 0 || size.width > Self::MAX_APP_SIZE || size.height > Self::MAX_APP_SIZE {
            return Err(format!("The app's size is 1 to {} pixels each way", Self::MAX_APP_SIZE));
        }
        if size.width > size.height * Self::MAX_APP_SIZE_RATIO || size.height > size.width * Self::MAX_APP_SIZE_RATIO {
            return Err(format!("The app's size is at most {}:1 either way", Self::MAX_APP_SIZE_RATIO));
        }
        let players = self.status.players();
        let limit = self.max_players.map_or(Self::MAX_PLAYERS, |max| max as usize);
        if players.len() > limit {
            return Err(format!("This game has at most {limit} players"));
        }
        if players.iter().collect::<HashSet<_>>().len() < players.len() {
            return Err("A player is listed twice".to_string());
        }
        if let MiniAppStatus::Active(active) = &self.status {
            if active.waiting_for.iter().any(|user_id| !players.contains(user_id)) {
                return Err("Only players can be waited for".to_string());
            }
            if active.waiting_for.iter().collect::<HashSet<_>>().len() < active.waiting_for.len() {
                return Err("A player is waited for twice".to_string());
            }
        }
        if let Some(result) = self.status.result() {
            check_chars("result", result, Self::MAX_RESULT_CHARS)?;
        }
        if let MiniAppStatus::Finished(finished) = &self.status
            && finished
                .end_state
                .as_ref()
                .is_some_and(|state| state.len() > Self::MAX_END_STATE_BYTES)
        {
            return Err(format!("The end state is at most {} bytes", Self::MAX_END_STATE_BYTES));
        }
        if self
            .status
            .settings()
            .is_some_and(|settings| settings.len() > Self::MAX_SETTINGS_BYTES)
        {
            return Err(format!("The settings are at most {} bytes", Self::MAX_SETTINGS_BYTES));
        }
        Ok(())
    }

    // The status the MiniApp service's update leaves: a game starts with its players and its settings,
    // its turns pass between them, and it ends with them, its settings and its result, or ends without
    // starting. A finished game never changes. An update the card already reflects changes nothing,
    // so the service can retry a write whose outcome it didn't learn: a repeated start carries the
    // players and settings the card holds, whatever turns have passed since.
    pub fn next_status(&self, update: MiniAppStatusUpdate) -> Result<MiniAppStatus, String> {
        use MiniAppStatus::*;
        use MiniAppStatusUpdate::*;

        match (&self.status, update) {
            (Open, Started(started)) => Ok(Active(MiniAppActive {
                players: started.players,
                waiting_for: started.waiting_for,
                settings: started.settings,
            })),
            // A retried start carries the turn as the service knows it now, which may have passed
            // since the write it's retrying
            (Active(active), Started(started)) if active.players == started.players && active.settings == started.settings => {
                Ok(Active(MiniAppActive {
                    waiting_for: started.waiting_for,
                    ..active.clone()
                }))
            }
            (Active(_), Started(_)) => Err("The game has already started".to_string()),
            (Active(active), Turn(turn)) => Ok(Active(MiniAppActive {
                players: active.players.clone(),
                waiting_for: turn.waiting_for,
                settings: active.settings.clone(),
            })),
            (Open, Turn(_)) => Err("The game hasn't started".to_string()),
            (Open, Ended(ended)) => Ok(Finished(MiniAppFinished {
                players: Vec::new(),
                result: ended.result,
                end_state: ended.end_state,
                settings: None,
            })),
            (Active(active), Ended(ended)) => Ok(Finished(MiniAppFinished {
                players: active.players.clone(),
                result: ended.result,
                end_state: ended.end_state,
                settings: active.settings.clone(),
            })),
            (Finished(finished), Ended(ended)) if finished.result == ended.result && finished.end_state == ended.end_state => {
                Ok(self.status.clone())
            }
            (Finished(_), _) => Err("A finished game's card can't be changed".to_string()),
        }
    }
}

fn check_chars(field: &str, value: &str, max: usize) -> Result<(), String> {
    if value.trim().is_empty() || value.chars().count() > max {
        Err(format!("The {field} must have 1 to {max} characters"))
    } else {
        Ok(())
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    fn chart() -> PriceChartContent {
        PriceChartContent {
            title: "CHAT · 30 days".to_string(),
            start: 1_000,
            end: 4_000,
            series: vec![PriceChartSeries {
                token: PriceChartToken::Coin("cardano".to_string()),
                symbol: "ADA".to_string(),
                name: "Cardano".to_string(),
                points: vec![(1_000, 0.5), (2_000, 0.25), (4_000, 0.75)],
            }],
            sources: vec![PriceChartSource {
                name: "CoinGecko".to_string(),
                url: "https://www.coingecko.com".to_string(),
            }],
        }
    }

    fn invalid(change: impl FnOnce(&mut PriceChartContent)) -> String {
        let mut chart = chart();
        change(&mut chart);
        chart.validate().expect_err("Expected the chart to be invalid")
    }

    #[test]
    fn a_price_chart_within_its_limits_is_valid() {
        assert_eq!(chart().validate(), Ok(()));
    }

    #[test]
    fn a_price_chart_needs_a_title_and_a_time() {
        invalid(|c| c.title = " ".to_string());
        invalid(|c| c.title = "x".repeat(PriceChartContent::MAX_TITLE_CHARS + 1));
        invalid(|c| c.end = c.start);
    }

    #[test]
    fn a_price_chart_has_1_to_5_series_and_at_most_1000_points() {
        invalid(|c| c.series.clear());
        invalid(|c| c.series = vec![c.series[0].clone(); PriceChartContent::MAX_SERIES + 1]);
        invalid(|c| {
            c.end = 10_000;
            c.series[0].points = (0..=PriceChartContent::MAX_POINTS as u64).map(|i| (1_000 + i, 1.0)).collect();
        });
    }

    #[test]
    fn a_price_charts_series_needs_names_and_prices_in_time_order_within_its_time() {
        invalid(|c| c.series[0].symbol = String::new());
        invalid(|c| c.series[0].name = "x".repeat(51));
        invalid(|c| c.series[0].token = PriceChartToken::Coin(String::new()));
        invalid(|c| c.series[0].points.clear());
        invalid(|c| c.series[0].points = vec![(2_000, 1.0), (2_000, 1.0)]);
        invalid(|c| c.series[0].points = vec![(500, 1.0)]);
        invalid(|c| c.series[0].points = vec![(5_000, 1.0)]);
        invalid(|c| c.series[0].points = vec![(2_000, 0.0)]);
        invalid(|c| c.series[0].points = vec![(2_000, f64::NAN)]);
    }

    #[test]
    fn a_price_chart_credits_1_to_3_sources_with_https_links() {
        invalid(|c| c.sources.clear());
        invalid(|c| c.sources = vec![c.sources[0].clone(); PriceChartContent::MAX_SOURCES + 1]);
        invalid(|c| c.sources[0].url = "http://www.coingecko.com".to_string());
        invalid(|c| c.sources[0].url = "javascript:alert(1)".to_string());
    }
}
