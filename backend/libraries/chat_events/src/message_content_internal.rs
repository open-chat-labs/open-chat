#![allow(deprecated)]
use crate::DeletedByInternal;
use candid::Principal;
use constants::{MEMO_PRIZE_FEE, MEMO_PRIZE_REFUND, OPENCHAT_TREASURY_CANISTER_ID, PRIZE_FEE_PERCENT};
use ledger_utils::{create_pending_transaction, format_crypto_amount};
use search::simple::Document;
use serde::{Deserialize, Deserializer, Serialize};
use serde_bytes::ByteBuf;
use std::collections::{HashMap, HashSet};
use types::icrc1::{Account, CryptoAccount};
use types::{
    is_default, AudioContent, BlobReference, CallParticipant, CanisterId, CompletedCryptoTransaction, ContentValidationError,
    ContentWithCaptionEventPayload, CryptoContent, CryptoContentEventPayload, CryptoTransaction, Cryptocurrency, CustomContent,
    FileContent, FileContentEventPayload, GiphyContent, GiphyImageVariant, GovernanceProposalContentEventPayload, ImageContent,
    ImageOrVideoContentEventPayload, MessageContent, MessageContentEventPayload, MessageContentInitial, MessageContentType,
    MessageIndex, MessageReminderContent, MessageReminderContentEventPayload, MessageReminderCreatedContent, MessageReport,
    P2PSwapAccepted, P2PSwapCancelled, P2PSwapCompleted, P2PSwapContent, P2PSwapContentEventPayload, P2PSwapContentInitial,
    P2PSwapExpired, P2PSwapReserved, P2PSwapStatus, PendingCryptoTransaction, PollConfig, PollContent, PollContentEventPayload,
    PollVotes, PrizeContent, PrizeContentEventPayload, PrizeContentInitial, PrizeWinnerContent, PrizeWinnerContentEventPayload,
    Proposal, ProposalContent, RegisterVoteResult, ReportedMessage, ReportedMessageContentEventPayload, TextContent,
    TextContentEventPayload, ThumbnailData, TimestampMillis, TimestampNanos, TokenInfo, TotalVotes, TransactionHash, UserId,
    UserType, VideoCallContent, VideoCallPresence, VideoCallType, VideoContent, VoteOperation, MAX_TEXT_LENGTH,
    MAX_TEXT_LENGTH_USIZE,
};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum MessageContentInternal {
    #[serde(rename = "t")]
    Text(TextContentInternal),
    #[serde(rename = "i")]
    Image(ImageContentInternal),
    #[serde(rename = "v")]
    Video(VideoContentInternal),
    #[serde(rename = "a")]
    Audio(AudioContentInternal),
    #[serde(rename = "f")]
    File(FileContentInternal),
    #[serde(rename = "p")]
    Poll(PollContentInternal),
    #[serde(rename = "c")]
    Crypto(CryptoContentInternal),
    #[serde(rename = "d")]
    Deleted(DeletedByInternal),
    #[serde(rename = "g")]
    Giphy(GiphyContentInternal),
    #[serde(rename = "gp")]
    GovernanceProposal(ProposalContentInternal),
    #[serde(rename = "pr")]
    Prize(PrizeContentInternal),
    #[serde(rename = "pw")]
    PrizeWinner(PrizeWinnerContentInternal),
    #[serde(rename = "mrc")]
    MessageReminderCreated(MessageReminderCreatedContentInternal),
    #[serde(rename = "mr")]
    MessageReminder(MessageReminderContentInternal),
    #[serde(rename = "rm")]
    ReportedMessage(ReportedMessageInternal),
    #[serde(rename = "p2p")]
    P2PSwap(P2PSwapContentInternal),
    #[serde(rename = "vc")]
    VideoCall(VideoCallContentInternal),
    #[serde(rename = "cu")]
    Custom(CustomContentInternal),
}

impl MessageContentInternal {
    pub fn validate_new_message(
        content: MessageContentInitial,
        is_direct_chat: bool,
        sender_user_type: UserType,
        forwarding: bool,
        now: TimestampMillis,
    ) -> ValidateNewMessageContentResult {
        let contains_crypto_transfer = content.contains_crypto_transfer();

        if forwarding {
            let invalid_type_for_forwarding = contains_crypto_transfer
                || matches!(
                    &content,
                    MessageContentInitial::Poll(_) | MessageContentInitial::GovernanceProposal(_)
                );

            if invalid_type_for_forwarding {
                return ValidateNewMessageContentResult::Error(ContentValidationError::InvalidTypeForForwarding);
            }
        }

        // Allow GovernanceProposal messages to exceed the max length since they are collapsed on the UI
        if content.text_length() > MAX_TEXT_LENGTH_USIZE && !matches!(&content, MessageContentInitial::GovernanceProposal(_)) {
            return ValidateNewMessageContentResult::Error(ContentValidationError::TextTooLong(MAX_TEXT_LENGTH));
        }

        match &content {
            MessageContentInitial::Poll(p) => {
                if let Err(reason) = p.config.validate(is_direct_chat, now) {
                    return ValidateNewMessageContentResult::Error(ContentValidationError::InvalidPoll(reason));
                }
            }
            MessageContentInitial::Prize(p) => {
                if p.end_date <= now {
                    return ValidateNewMessageContentResult::Error(ContentValidationError::PrizeEndDateInThePast);
                }
            }
            MessageContentInitial::GovernanceProposal(_)
            | MessageContentInitial::MessageReminderCreated(_)
            | MessageContentInitial::MessageReminder(_) => {
                return ValidateNewMessageContentResult::Error(ContentValidationError::Unauthorized);
            }
            _ => {}
        };

        let is_empty = match &content {
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
            return ValidateNewMessageContentResult::Error(ContentValidationError::Empty);
        }

        match content {
            MessageContentInitial::Crypto(c) => match c.transfer {
                CryptoTransaction::Pending(_) => ValidateNewMessageContentResult::SuccessCrypto(c),
                CryptoTransaction::Completed(completed) if sender_user_type.is_oc_controlled_bot() => {
                    ValidateNewMessageContentResult::Success(MessageContentInternal::Crypto(CryptoContentInternal {
                        recipient: c.recipient,
                        transfer: completed.into(),
                        caption: c.caption,
                    }))
                }
                _ => ValidateNewMessageContentResult::Error(ContentValidationError::TransferMustBePending),
            },
            MessageContentInitial::Prize(c) => match &c.transfer {
                CryptoTransaction::Pending(_) => ValidateNewMessageContentResult::SuccessPrize(c),
                CryptoTransaction::Completed(completed) if sender_user_type.is_oc_controlled_bot() => {
                    let completed = completed.clone().into();
                    ValidateNewMessageContentResult::Success(MessageContentInternal::Prize(PrizeContentInternal::new(
                        c, completed,
                    )))
                }
                _ => ValidateNewMessageContentResult::Error(ContentValidationError::TransferMustBePending),
            },
            MessageContentInitial::P2PSwap(c) => ValidateNewMessageContentResult::SuccessP2PSwap(c),
            content => ValidateNewMessageContentResult::Success(content.into()),
        }
    }

    pub fn new_with_transfer(
        content: MessageContentInitial,
        transfer: CompletedCryptoTransactionInternal,
        p2p_swap_id: Option<u32>,
        now: TimestampMillis,
    ) -> MessageContentInternal {
        match content {
            MessageContentInitial::Crypto(c) => MessageContentInternal::Crypto(CryptoContentInternal {
                recipient: c.recipient,
                transfer,
                caption: c.caption,
            }),
            MessageContentInitial::Prize(c) => MessageContentInternal::Prize(PrizeContentInternal::new(c, transfer)),
            MessageContentInitial::P2PSwap(c) => {
                MessageContentInternal::P2PSwap(P2PSwapContentInternal::new(p2p_swap_id.unwrap(), c, transfer.index(), now))
            }
            _ => unreachable!("Message must include a crypto transfer"),
        }
    }

    pub fn hydrate(self, my_user_id: Option<UserId>) -> MessageContent {
        match self {
            MessageContentInternal::Text(t) => MessageContent::Text(t.hydrate(my_user_id)),
            MessageContentInternal::Image(i) => MessageContent::Image(i.hydrate(my_user_id)),
            MessageContentInternal::Video(v) => MessageContent::Video(v.hydrate(my_user_id)),
            MessageContentInternal::Audio(a) => MessageContent::Audio(a.hydrate(my_user_id)),
            MessageContentInternal::File(f) => MessageContent::File(f.hydrate(my_user_id)),
            MessageContentInternal::Poll(p) => MessageContent::Poll(p.hydrate(my_user_id)),
            MessageContentInternal::Crypto(c) => MessageContent::Crypto(c.hydrate(my_user_id)),
            MessageContentInternal::Deleted(d) => MessageContent::Deleted(d.hydrate()),
            MessageContentInternal::Giphy(g) => MessageContent::Giphy(g.hydrate(my_user_id)),
            MessageContentInternal::GovernanceProposal(p) => MessageContent::GovernanceProposal(p.hydrate(my_user_id)),
            MessageContentInternal::PrizeWinner(c) => MessageContent::PrizeWinner(c.hydrate(my_user_id)),
            MessageContentInternal::Prize(p) => MessageContent::Prize(p.hydrate(my_user_id)),
            MessageContentInternal::MessageReminderCreated(r) => MessageContent::MessageReminderCreated(r.hydrate(my_user_id)),
            MessageContentInternal::MessageReminder(r) => MessageContent::MessageReminder(r.hydrate(my_user_id)),
            MessageContentInternal::ReportedMessage(r) => MessageContent::ReportedMessage(r.hydrate(my_user_id)),
            MessageContentInternal::P2PSwap(p) => MessageContent::P2PSwap(p.hydrate(my_user_id)),
            MessageContentInternal::VideoCall(c) => MessageContent::VideoCall(c.hydrate()),
            MessageContentInternal::Custom(c) => MessageContent::Custom(c.hydrate(my_user_id)),
        }
    }

    pub fn text(&self) -> Option<&str> {
        match self {
            MessageContentInternal::Text(c) => Some(&c.text),
            MessageContentInternal::Image(c) => c.caption.as_deref(),
            MessageContentInternal::Video(c) => c.caption.as_deref(),
            MessageContentInternal::Audio(c) => c.caption.as_deref(),
            MessageContentInternal::File(c) => c.caption.as_deref(),
            MessageContentInternal::Poll(c) => c.config.text.as_deref(),
            MessageContentInternal::Crypto(c) => c.caption.as_deref(),
            MessageContentInternal::Giphy(c) => c.caption.as_deref(),
            MessageContentInternal::GovernanceProposal(c) => Some(c.proposal.title()),
            MessageContentInternal::Prize(c) => c.caption.as_deref(),
            MessageContentInternal::MessageReminderCreated(r) => r.notes.as_deref(),
            MessageContentInternal::MessageReminder(r) => r.notes.as_deref(),
            MessageContentInternal::P2PSwap(p) => p.caption.as_deref(),
            MessageContentInternal::PrizeWinner(_)
            | MessageContentInternal::Deleted(_)
            | MessageContentInternal::ReportedMessage(_)
            | MessageContentInternal::VideoCall(_)
            | MessageContentInternal::Custom(_) => None,
        }
    }

    pub fn text_length(&self) -> u32 {
        self.text().map(|t| t.len() as u32).unwrap_or_default()
    }

    pub fn blob_references(&self) -> Vec<BlobReference> {
        let mut references = Vec::new();

        match self {
            MessageContentInternal::Image(i) => {
                if let Some(br) = i.blob_reference.clone() {
                    references.push(br.into());
                }
            }
            MessageContentInternal::Video(v) => {
                if let Some(br) = v.video_blob_reference.clone() {
                    references.push(br.into());
                }
                if let Some(br) = v.image_blob_reference.clone() {
                    references.push(br.into());
                }
            }
            MessageContentInternal::Audio(a) => {
                if let Some(br) = a.blob_reference.clone() {
                    references.push(br.into())
                }
            }
            MessageContentInternal::File(f) => {
                if let Some(br) = f.blob_reference.clone() {
                    references.push(br.into());
                }
            }
            MessageContentInternal::Text(_)
            | MessageContentInternal::Poll(_)
            | MessageContentInternal::Crypto(_)
            | MessageContentInternal::Deleted(_)
            | MessageContentInternal::Giphy(_)
            | MessageContentInternal::GovernanceProposal(_)
            | MessageContentInternal::Prize(_)
            | MessageContentInternal::PrizeWinner(_)
            | MessageContentInternal::MessageReminderCreated(_)
            | MessageContentInternal::MessageReminder(_)
            | MessageContentInternal::ReportedMessage(_)
            | MessageContentInternal::P2PSwap(_)
            | MessageContentInternal::VideoCall(_)
            | MessageContentInternal::Custom(_) => {}
        }

        references
    }

    pub fn event_payload(&self) -> MessageContentEventPayload {
        match self {
            MessageContentInternal::Text(c) => MessageContentEventPayload::Text(TextContentEventPayload {
                length: c.text.len() as u32,
            }),
            MessageContentInternal::Image(c) => MessageContentEventPayload::Image(ImageOrVideoContentEventPayload {
                caption_length: option_string_length(&c.caption),
                height: c.height,
                width: c.width,
            }),
            MessageContentInternal::Video(c) => MessageContentEventPayload::Video(ImageOrVideoContentEventPayload {
                caption_length: option_string_length(&c.caption),
                height: c.height,
                width: c.width,
            }),
            MessageContentInternal::Audio(c) => MessageContentEventPayload::Audio(ContentWithCaptionEventPayload {
                caption_length: option_string_length(&c.caption),
            }),
            MessageContentInternal::File(c) => MessageContentEventPayload::File(FileContentEventPayload {
                caption_length: option_string_length(&c.caption),
                file_size: c.file_size,
            }),
            MessageContentInternal::Poll(c) => MessageContentEventPayload::Poll(PollContentEventPayload {
                text_length: option_string_length(&c.config.text),
                options: c.config.options.len() as u32,
                anonymous: c.config.anonymous,
                show_votes_before_end_date: c.config.show_votes_before_end_date,
                allow_multiple_votes_per_user: c.config.allow_multiple_votes_per_user,
                allow_user_to_change_vote: c.config.allow_user_to_change_vote,
            }),
            MessageContentInternal::Crypto(c) => MessageContentEventPayload::Crypto(CryptoContentEventPayload {
                caption_length: option_string_length(&c.caption),
                token: c.transfer.token().token_symbol().to_string(),
                amount: c.transfer.units(),
            }),
            MessageContentInternal::Giphy(c) => MessageContentEventPayload::Giphy(ContentWithCaptionEventPayload {
                caption_length: option_string_length(&c.caption),
            }),
            MessageContentInternal::GovernanceProposal(c) => {
                MessageContentEventPayload::GovernanceProposal(GovernanceProposalContentEventPayload {
                    governance_canister_id: c.governance_canister_id.to_string(),
                })
            }
            MessageContentInternal::Prize(c) => MessageContentEventPayload::Prize(PrizeContentEventPayload {
                caption_length: option_string_length(&c.caption),
                prizes: (c.prizes_remaining.len() + c.winners.len() + c.reservations.len()) as u32,
                token: c.transaction.token().token_symbol().to_string(),
                amount: c.transaction.units(),
                diamond_only: c.diamond_only,
                lifetime_diamond_only: c.lifetime_diamond_only,
                unique_person_only: c.unique_person_only,
                streak_only: c.streak_only,
            }),
            MessageContentInternal::PrizeWinner(c) => MessageContentEventPayload::PrizeWinner(PrizeWinnerContentEventPayload {
                token: c.token_symbol.clone(),
                amount: c.amount,
            }),
            MessageContentInternal::MessageReminderCreated(c) => {
                MessageContentEventPayload::MessageReminderCreated(MessageReminderContentEventPayload {
                    notes_length: option_string_length(&c.notes),
                })
            }
            MessageContentInternal::MessageReminder(c) => {
                MessageContentEventPayload::MessageReminder(MessageReminderContentEventPayload {
                    notes_length: option_string_length(&c.notes),
                })
            }
            MessageContentInternal::ReportedMessage(c) => {
                MessageContentEventPayload::ReportedMessage(ReportedMessageContentEventPayload {
                    reason: c.reports.first().map(|r| r.reason_code).unwrap_or_default(),
                    notes_length: c.reports.first().map(|r| option_string_length(&r.notes)).unwrap_or_default(),
                })
            }
            MessageContentInternal::P2PSwap(c) => MessageContentEventPayload::P2PSwap(P2PSwapContentEventPayload {
                caption_length: option_string_length(&c.caption),
                token0: c.token0.symbol.clone(),
                token0_amount: c.token0_amount,
                token1: c.token1.symbol.clone(),
                token1_amount: c.token1_amount,
            }),
            MessageContentInternal::Deleted(_) | MessageContentInternal::VideoCall(_) | MessageContentInternal::Custom(_) => {
                MessageContentEventPayload::Empty
            }
        }
    }

    pub fn content_type(&self) -> MessageContentType {
        self.into()
    }
}

pub enum ValidateNewMessageContentResult {
    Success(MessageContentInternal),
    SuccessCrypto(CryptoContent),
    SuccessPrize(PrizeContentInitial),
    SuccessP2PSwap(P2PSwapContentInitial),
    Error(ContentValidationError),
}

fn option_string_length(value: &Option<String>) -> u32 {
    value.as_ref().map(|c| c.len() as u32).unwrap_or_default()
}

impl From<&MessageContentInternal> for Document {
    fn from(message_content: &MessageContentInternal) -> Self {
        let mut document = Document::default();

        fn try_add_caption(document: &mut Document, caption_option: Option<&String>) {
            if let Some(caption) = caption_option {
                document.add_field(caption);
            }
        }

        fn try_add_caption_and_mime_type(document: &mut Document, caption_option: Option<&String>, mime_type: &str) {
            document.add_field(mime_type);
            try_add_caption(document, caption_option);
        }

        match message_content {
            MessageContentInternal::Text(c) => {
                document.add_field(&c.text);
            }
            MessageContentInternal::Crypto(c) => {
                let token = c.transfer.token();
                document.add_field(token.token_symbol());

                let amount = c.transfer.units();
                // This is only used for string searching so it's better to default to 8 than to trap
                let amount_string = format_crypto_amount(amount, 8);
                document.add_field(&amount_string);

                try_add_caption(&mut document, c.caption.as_ref())
            }
            MessageContentInternal::Image(c) => try_add_caption_and_mime_type(&mut document, c.caption.as_ref(), &c.mime_type),
            MessageContentInternal::Video(c) => try_add_caption_and_mime_type(&mut document, c.caption.as_ref(), &c.mime_type),
            MessageContentInternal::Audio(c) => try_add_caption_and_mime_type(&mut document, c.caption.as_ref(), &c.mime_type),
            MessageContentInternal::File(c) => try_add_caption_and_mime_type(&mut document, c.caption.as_ref(), &c.mime_type),
            MessageContentInternal::Giphy(c) => try_add_caption(&mut document, c.caption.as_ref()),
            MessageContentInternal::Poll(p) => {
                document.add_field("poll");
                if let Some(text) = &p.config.text {
                    document.add_field(text);
                }
            }
            MessageContentInternal::GovernanceProposal(p) => {
                document.add_field(p.proposal.title());
                document.add_field(p.proposal.summary());
            }
            MessageContentInternal::Prize(c) => {
                document.add_field(c.transaction.token().token_symbol());
                try_add_caption(&mut document, c.caption.as_ref())
            }
            MessageContentInternal::PrizeWinner(c) => {
                document.add_field(&c.token_symbol);
            }
            MessageContentInternal::MessageReminderCreated(r) => try_add_caption(&mut document, r.notes.as_ref()),
            MessageContentInternal::MessageReminder(r) => try_add_caption(&mut document, r.notes.as_ref()),
            MessageContentInternal::P2PSwap(p) => {
                document.add_field("swap");
                document.add_field(&p.token0.symbol);
                document.add_field(&p.token1.symbol);
                try_add_caption(&mut document, p.caption.as_ref())
            }
            MessageContentInternal::Custom(c) => {
                document.add_field(&c.kind);
            }
            MessageContentInternal::ReportedMessage(_)
            | MessageContentInternal::Deleted(_)
            | MessageContentInternal::VideoCall(_) => {}
        }

        document
    }
}

pub(crate) trait MessageContentInternalSubtype {
    type ContentType;

    fn hydrate(self, my_user_id: Option<UserId>) -> Self::ContentType;
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TextContentInternal {
    #[serde(rename = "t")]
    pub text: String,
}

impl From<TextContent> for TextContentInternal {
    fn from(value: TextContent) -> Self {
        TextContentInternal { text: value.text }
    }
}

impl MessageContentInternalSubtype for TextContentInternal {
    type ContentType = TextContent;

    fn hydrate(self, _my_user_id: Option<UserId>) -> Self::ContentType {
        TextContent { text: self.text }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ImageContentInternal {
    #[serde(rename = "w")]
    pub width: u32,
    #[serde(rename = "h")]
    pub height: u32,
    #[serde(rename = "t")]
    pub thumbnail_data: ThumbnailData,
    #[serde(rename = "c", default, skip_serializing_if = "Option::is_none")]
    pub caption: Option<String>,
    #[serde(rename = "m")]
    pub mime_type: String,
    #[serde(rename = "b", default, skip_serializing_if = "Option::is_none")]
    pub blob_reference: Option<BlobReferenceInternal>,
}

impl From<ImageContent> for ImageContentInternal {
    fn from(value: ImageContent) -> Self {
        ImageContentInternal {
            width: value.width,
            height: value.height,
            thumbnail_data: value.thumbnail_data,
            caption: value.caption,
            mime_type: value.mime_type,
            blob_reference: value.blob_reference.map(|r| r.into()),
        }
    }
}

impl MessageContentInternalSubtype for ImageContentInternal {
    type ContentType = ImageContent;

    fn hydrate(self, _my_user_id: Option<UserId>) -> Self::ContentType {
        ImageContent {
            width: self.width,
            height: self.height,
            thumbnail_data: self.thumbnail_data,
            caption: self.caption,
            mime_type: self.mime_type,
            blob_reference: self.blob_reference.map(|r| r.into()),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct VideoContentInternal {
    #[serde(rename = "w")]
    pub width: u32,
    #[serde(rename = "h")]
    pub height: u32,
    #[serde(rename = "t")]
    pub thumbnail_data: ThumbnailData,
    #[serde(rename = "c", default, skip_serializing_if = "Option::is_none")]
    pub caption: Option<String>,
    #[serde(rename = "m")]
    pub mime_type: String,
    #[serde(rename = "i", default, skip_serializing_if = "Option::is_none")]
    pub image_blob_reference: Option<BlobReferenceInternal>,
    #[serde(rename = "v", default, skip_serializing_if = "Option::is_none")]
    pub video_blob_reference: Option<BlobReferenceInternal>,
}

impl From<VideoContent> for VideoContentInternal {
    fn from(value: VideoContent) -> Self {
        VideoContentInternal {
            width: value.width,
            height: value.height,
            thumbnail_data: value.thumbnail_data,
            caption: value.caption,
            mime_type: value.mime_type,
            image_blob_reference: value.image_blob_reference.map(|r| r.into()),
            video_blob_reference: value.video_blob_reference.map(|r| r.into()),
        }
    }
}

impl MessageContentInternalSubtype for VideoContentInternal {
    type ContentType = VideoContent;

    fn hydrate(self, _my_user_id: Option<UserId>) -> Self::ContentType {
        VideoContent {
            width: self.width,
            height: self.height,
            thumbnail_data: self.thumbnail_data,
            caption: self.caption,
            mime_type: self.mime_type,
            image_blob_reference: self.image_blob_reference.map(|r| r.into()),
            video_blob_reference: self.video_blob_reference.map(|r| r.into()),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AudioContentInternal {
    #[serde(rename = "c", default, skip_serializing_if = "Option::is_none")]
    pub caption: Option<String>,
    #[serde(rename = "m")]
    pub mime_type: String,
    #[serde(rename = "b", default, skip_serializing_if = "Option::is_none")]
    pub blob_reference: Option<BlobReferenceInternal>,
}

impl From<AudioContent> for AudioContentInternal {
    fn from(value: AudioContent) -> Self {
        AudioContentInternal {
            caption: value.caption,
            mime_type: value.mime_type,
            blob_reference: value.blob_reference.map(|r| r.into()),
        }
    }
}

impl MessageContentInternalSubtype for AudioContentInternal {
    type ContentType = AudioContent;

    fn hydrate(self, _my_user_id: Option<UserId>) -> Self::ContentType {
        AudioContent {
            caption: self.caption,
            mime_type: self.mime_type,
            blob_reference: self.blob_reference.map(|r| r.into()),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FileContentInternal {
    #[serde(rename = "n")]
    pub name: String,
    #[serde(rename = "c", default, skip_serializing_if = "Option::is_none")]
    pub caption: Option<String>,
    #[serde(rename = "m")]
    pub mime_type: String,
    #[serde(rename = "f")]
    pub file_size: u32,
    #[serde(rename = "b", default, skip_serializing_if = "Option::is_none")]
    pub blob_reference: Option<BlobReferenceInternal>,
}

impl From<FileContent> for FileContentInternal {
    fn from(value: FileContent) -> Self {
        FileContentInternal {
            name: value.name,
            caption: value.caption,
            mime_type: value.mime_type,
            file_size: value.file_size,
            blob_reference: value.blob_reference.map(|r| r.into()),
        }
    }
}

impl MessageContentInternalSubtype for FileContentInternal {
    type ContentType = FileContent;

    fn hydrate(self, _my_user_id: Option<UserId>) -> Self::ContentType {
        FileContent {
            name: self.name,
            caption: self.caption,
            mime_type: self.mime_type,
            file_size: self.file_size,
            blob_reference: self.blob_reference.map(|r| r.into()),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PollContentInternal {
    #[serde(rename = "c")]
    pub config: PollConfigInternal,
    #[serde(rename = "v")]
    pub votes: HashMap<u32, Vec<UserId>>,
    #[serde(rename = "e")]
    pub ended: bool,
}

impl From<PollContent> for PollContentInternal {
    fn from(value: PollContent) -> Self {
        PollContentInternal {
            config: value.config.into(),
            votes: HashMap::new(),
            ended: false,
        }
    }
}

impl MessageContentInternalSubtype for PollContentInternal {
    type ContentType = PollContent;

    fn hydrate(self, my_user_id: Option<UserId>) -> Self::ContentType {
        PollContent {
            votes: self.votes(my_user_id),
            config: self.config.into(),
            ended: self.ended,
        }
    }
}

impl PollContentInternal {
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
                                // if the poll does not permit users to change vote then this is an error
                                if !self.config.allow_user_to_change_vote {
                                    return RegisterVoteResult::UserCannotChangeVote;
                                }
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

    pub fn votes(&self, my_user_id: Option<UserId>) -> PollVotes {
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

        PollVotes {
            user: user_votes,
            total: total_votes,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PollConfigInternal {
    #[serde(rename = "t", alias = "text")]
    pub text: Option<String>,
    #[serde(rename = "o", alias = "options")]
    pub options: Vec<String>,
    #[serde(rename = "e", alias = "end_date", skip_serializing_if = "Option::is_none")]
    pub end_date: Option<TimestampMillis>,
    #[serde(rename = "a", alias = "anonymous", default, skip_serializing_if = "is_default")]
    pub anonymous: bool,
    #[serde(
        rename = "b",
        alias = "show_votes_before_end_date",
        default,
        skip_serializing_if = "is_default"
    )]
    pub show_votes_before_end_date: bool,
    #[serde(
        rename = "m",
        alias = "allow_multiple_votes_per_user",
        default,
        skip_serializing_if = "is_default"
    )]
    pub allow_multiple_votes_per_user: bool,
    #[serde(
        rename = "c",
        alias = "allow_user_to_change_vote",
        default,
        skip_serializing_if = "is_default"
    )]
    pub allow_user_to_change_vote: bool,
}

impl From<PollConfig> for PollConfigInternal {
    fn from(value: PollConfig) -> Self {
        PollConfigInternal {
            text: value.text,
            options: value.options,
            end_date: value.end_date,
            anonymous: value.anonymous,
            show_votes_before_end_date: value.show_votes_before_end_date,
            allow_multiple_votes_per_user: value.allow_multiple_votes_per_user,
            allow_user_to_change_vote: value.allow_user_to_change_vote,
        }
    }
}

impl From<PollConfigInternal> for PollConfig {
    fn from(value: PollConfigInternal) -> Self {
        PollConfig {
            text: value.text,
            options: value.options,
            end_date: value.end_date,
            anonymous: value.anonymous,
            show_votes_before_end_date: value.show_votes_before_end_date,
            allow_multiple_votes_per_user: value.allow_multiple_votes_per_user,
            allow_user_to_change_vote: value.allow_user_to_change_vote,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CryptoContentInternal {
    #[serde(rename = "r")]
    pub recipient: UserId,
    #[serde(rename = "t")]
    pub transfer: CompletedCryptoTransactionInternal,
    #[serde(rename = "c", default, skip_serializing_if = "Option::is_none")]
    pub caption: Option<String>,
}

impl MessageContentInternalSubtype for CryptoContentInternal {
    type ContentType = CryptoContent;

    fn hydrate(self, _my_user_id: Option<UserId>) -> Self::ContentType {
        CryptoContent {
            recipient: self.recipient,
            transfer: CryptoTransaction::Completed(self.transfer.into()),
            caption: self.caption,
        }
    }
}

impl TryFrom<CryptoContent> for CryptoContentInternal {
    type Error = ();

    fn try_from(value: CryptoContent) -> Result<Self, Self::Error> {
        if let CryptoTransaction::Completed(transfer) = value.transfer {
            Ok(CryptoContentInternal {
                recipient: value.recipient,
                transfer: transfer.into(),
                caption: value.caption,
            })
        } else {
            Err(())
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum CompletedCryptoTransactionInternal {
    NNS(nns::CompletedCryptoTransactionInternal),
    ICRC1(icrc1::CompletedCryptoTransactionInternal),
    ICRC2(icrc2::CompletedCryptoTransactionInternal),
}

impl CompletedCryptoTransactionInternal {
    pub fn ledger_canister_id(&self) -> CanisterId {
        match self {
            CompletedCryptoTransactionInternal::NNS(t) => t.ledger,
            CompletedCryptoTransactionInternal::ICRC1(t) => t.ledger,
            CompletedCryptoTransactionInternal::ICRC2(t) => t.ledger,
        }
    }

    pub fn token(&self) -> Cryptocurrency {
        match self {
            CompletedCryptoTransactionInternal::NNS(t) => t.token.clone(),
            CompletedCryptoTransactionInternal::ICRC1(t) => t.token.clone(),
            CompletedCryptoTransactionInternal::ICRC2(t) => t.token.clone(),
        }
    }

    pub fn units(&self) -> u128 {
        match self {
            CompletedCryptoTransactionInternal::NNS(t) => t.amount as u128,
            CompletedCryptoTransactionInternal::ICRC1(t) => t.amount,
            CompletedCryptoTransactionInternal::ICRC2(t) => t.amount,
        }
    }

    pub fn fee(&self) -> u128 {
        match self {
            CompletedCryptoTransactionInternal::NNS(t) => t.fee as u128,
            CompletedCryptoTransactionInternal::ICRC1(t) => t.fee,
            CompletedCryptoTransactionInternal::ICRC2(t) => t.fee,
        }
    }

    pub fn index(&self) -> u64 {
        match self {
            CompletedCryptoTransactionInternal::NNS(t) => t.block_index,
            CompletedCryptoTransactionInternal::ICRC1(t) => t.block_index,
            CompletedCryptoTransactionInternal::ICRC2(t) => t.block_index,
        }
    }
}

impl From<CompletedCryptoTransactionInternal> for CompletedCryptoTransaction {
    fn from(value: CompletedCryptoTransactionInternal) -> Self {
        match value {
            CompletedCryptoTransactionInternal::NNS(t) => CompletedCryptoTransaction::NNS(t.into()),
            CompletedCryptoTransactionInternal::ICRC1(t) => CompletedCryptoTransaction::ICRC1(t.into()),
            CompletedCryptoTransactionInternal::ICRC2(t) => CompletedCryptoTransaction::ICRC2(t.into()),
        }
    }
}

impl From<CompletedCryptoTransaction> for CompletedCryptoTransactionInternal {
    fn from(value: CompletedCryptoTransaction) -> Self {
        match value {
            CompletedCryptoTransaction::NNS(t) => CompletedCryptoTransactionInternal::NNS(t.into()),
            CompletedCryptoTransaction::ICRC1(t) => CompletedCryptoTransactionInternal::ICRC1(t.into()),
            CompletedCryptoTransaction::ICRC2(t) => CompletedCryptoTransactionInternal::ICRC2(t.into()),
        }
    }
}

pub(crate) mod nns {
    use super::*;
    use ic_ledger_types::AccountIdentifier;
    use serde::Deserializer;
    use types::nns::{CryptoAccount, Tokens};

    #[derive(Serialize, Deserialize, Clone, Debug)]
    pub enum CryptoAccountInternal {
        #[serde(rename = "m", alias = "Mint")]
        Mint,
        #[serde(rename = "a", alias = "Account")]
        Account(AccountIdentifier),
    }

    impl From<CryptoAccountInternal> for CryptoAccount {
        fn from(value: CryptoAccountInternal) -> Self {
            match value {
                CryptoAccountInternal::Account(a) => CryptoAccount::Account(a),
                CryptoAccountInternal::Mint => CryptoAccount::Mint,
            }
        }
    }

    impl From<CryptoAccount> for CryptoAccountInternal {
        fn from(value: CryptoAccount) -> Self {
            match value {
                CryptoAccount::Account(a) => CryptoAccountInternal::Account(a),
                CryptoAccount::Mint => CryptoAccountInternal::Mint,
            }
        }
    }

    #[derive(Serialize, Deserialize, Clone, Debug)]
    pub struct CompletedCryptoTransactionInternal {
        #[serde(rename = "l", alias = "ledger")]
        pub ledger: CanisterId,
        #[serde(rename = "k", alias = "token")]
        pub token: Cryptocurrency,
        #[serde(rename = "a", alias = "amount", deserialize_with = "deserialize_amount")]
        pub amount: u64,
        #[serde(rename = "e", alias = "fee", deserialize_with = "deserialize_amount")]
        pub fee: u64,
        #[serde(rename = "f", alias = "from")]
        pub from: CryptoAccountInternal,
        #[serde(rename = "t", alias = "to")]
        pub to: CryptoAccountInternal,
        #[serde(rename = "m", alias = "memo")]
        pub memo: u64,
        #[serde(rename = "c", alias = "created")]
        pub created: TimestampNanos,
        #[serde(rename = "h", alias = "transaction_hash")]
        pub transaction_hash: TransactionHash,
        #[serde(rename = "i", alias = "block_index")]
        pub block_index: u64,
    }

    fn deserialize_amount<'de, D: Deserializer<'de>>(d: D) -> Result<u64, D::Error> {
        let amount = AmountCombined::deserialize(d)?;
        Ok(amount.into())
    }

    #[derive(Serialize, Deserialize, Clone, Debug)]
    #[serde(untagged)]
    pub enum AmountCombined {
        Old { e8s: u64 },
        New(u64),
    }

    impl From<AmountCombined> for u64 {
        fn from(value: AmountCombined) -> Self {
            match value {
                AmountCombined::Old { e8s } => e8s,
                AmountCombined::New(a) => a,
            }
        }
    }

    impl From<CompletedCryptoTransactionInternal> for types::nns::CompletedCryptoTransaction {
        fn from(value: CompletedCryptoTransactionInternal) -> Self {
            Self {
                ledger: value.ledger,
                token: value.token,
                amount: Tokens::from_e8s(value.amount),
                fee: Tokens::from_e8s(value.fee),
                from: value.from.into(),
                to: value.to.into(),
                memo: value.memo,
                created: value.created,
                transaction_hash: value.transaction_hash,
                block_index: value.block_index,
            }
        }
    }

    impl From<types::nns::CompletedCryptoTransaction> for CompletedCryptoTransactionInternal {
        fn from(value: types::nns::CompletedCryptoTransaction) -> Self {
            Self {
                ledger: value.ledger,
                token: value.token,
                amount: value.amount.e8s(),
                fee: value.fee.e8s(),
                from: value.from.into(),
                to: value.to.into(),
                memo: value.memo,
                created: value.created,
                transaction_hash: value.transaction_hash,
                block_index: value.block_index,
            }
        }
    }
}

pub(crate) mod icrc1 {
    use super::*;
    use candid::Principal;
    use types::icrc1::Account;

    #[derive(Serialize, Deserialize, Clone, Debug)]
    pub struct AccountInternal {
        #[serde(rename = "o", alias = "owner")]
        pub owner: Principal,
        #[serde(rename = "s", alias = "subaccount", skip_serializing_if = "Option::is_none")]
        pub subaccount: Option<[u8; 32]>,
    }

    impl From<AccountInternal> for Account {
        fn from(value: AccountInternal) -> Self {
            Account {
                owner: value.owner,
                subaccount: value.subaccount,
            }
        }
    }

    impl From<Account> for AccountInternal {
        fn from(value: Account) -> Self {
            AccountInternal {
                owner: value.owner,
                subaccount: value.subaccount,
            }
        }
    }

    #[derive(Serialize, Deserialize, Clone, Debug)]
    pub enum CryptoAccountInternal {
        #[serde(rename = "m", alias = "Mint")]
        Mint,
        #[serde(rename = "a", alias = "Account")]
        Account(AccountInternal),
    }

    impl From<CryptoAccountInternal> for CryptoAccount {
        fn from(value: CryptoAccountInternal) -> Self {
            match value {
                CryptoAccountInternal::Account(a) => CryptoAccount::Account(a.into()),
                CryptoAccountInternal::Mint => CryptoAccount::Mint,
            }
        }
    }

    impl From<CryptoAccount> for CryptoAccountInternal {
        fn from(value: CryptoAccount) -> Self {
            match value {
                CryptoAccount::Account(a) => CryptoAccountInternal::Account(a.into()),
                CryptoAccount::Mint => CryptoAccountInternal::Mint,
            }
        }
    }

    #[derive(Serialize, Deserialize, Clone, Debug)]
    pub struct CompletedCryptoTransactionInternal {
        #[serde(rename = "l", alias = "ledger")]
        pub ledger: CanisterId,
        #[serde(rename = "k", alias = "token")]
        #[allow(deprecated)]
        pub token: Cryptocurrency,
        #[serde(rename = "a", alias = "amount")]
        pub amount: u128,
        #[serde(rename = "f", alias = "from")]
        pub from: CryptoAccountInternal,
        #[serde(rename = "t", alias = "to")]
        pub to: CryptoAccountInternal,
        #[serde(rename = "e", alias = "fee")]
        pub fee: u128,
        #[serde(rename = "m", alias = "memo", skip_serializing_if = "Option::is_none")]
        pub memo: Option<ByteBuf>,
        #[serde(rename = "c", alias = "created")]
        pub created: TimestampNanos,
        #[serde(rename = "i", alias = "block_index")]
        pub block_index: u64,
    }

    impl From<CompletedCryptoTransactionInternal> for types::icrc1::CompletedCryptoTransaction {
        fn from(value: CompletedCryptoTransactionInternal) -> Self {
            Self {
                ledger: value.ledger,
                token: value.token,
                amount: value.amount,
                from: value.from.into(),
                to: value.to.into(),
                fee: value.fee,
                memo: value.memo.map(|m| m.into()),
                created: value.created,
                block_index: value.block_index,
            }
        }
    }

    impl From<types::icrc1::CompletedCryptoTransaction> for CompletedCryptoTransactionInternal {
        fn from(value: types::icrc1::CompletedCryptoTransaction) -> Self {
            Self {
                ledger: value.ledger,
                token: value.token,
                amount: value.amount,
                from: value.from.into(),
                to: value.to.into(),
                fee: value.fee,
                memo: value.memo.map(|m| m.0),
                created: value.created,
                block_index: value.block_index,
            }
        }
    }
}

pub(crate) mod icrc2 {
    use super::*;
    use crate::message_content_internal::icrc1::CryptoAccountInternal;

    #[derive(Serialize, Deserialize, Clone, Debug)]
    pub struct CompletedCryptoTransactionInternal {
        #[serde(rename = "l", alias = "ledger")]
        pub ledger: CanisterId,
        #[serde(rename = "k", alias = "token")]
        #[allow(deprecated)]
        pub token: Cryptocurrency,
        #[serde(rename = "a", alias = "amount")]
        pub amount: u128,
        #[serde(rename = "s", alias = "spender")]
        pub spender: UserId,
        #[serde(rename = "f", alias = "from")]
        pub from: CryptoAccountInternal,
        #[serde(rename = "t", alias = "to")]
        pub to: CryptoAccountInternal,
        #[serde(rename = "e", alias = "fee")]
        pub fee: u128,
        #[serde(rename = "m", alias = "memo", skip_serializing_if = "Option::is_none")]
        pub memo: Option<ByteBuf>,
        #[serde(rename = "c", alias = "created")]
        pub created: TimestampNanos,
        #[serde(rename = "i", alias = "block_index")]
        pub block_index: u64,
    }

    impl From<CompletedCryptoTransactionInternal> for types::icrc2::CompletedCryptoTransaction {
        fn from(value: CompletedCryptoTransactionInternal) -> Self {
            Self {
                ledger: value.ledger,
                token: value.token,
                amount: value.amount,
                spender: value.spender,
                from: value.from.into(),
                to: value.to.into(),
                fee: value.fee,
                memo: value.memo.map(|m| m.into()),
                created: value.created,
                block_index: value.block_index,
            }
        }
    }

    impl From<types::icrc2::CompletedCryptoTransaction> for CompletedCryptoTransactionInternal {
        fn from(value: types::icrc2::CompletedCryptoTransaction) -> Self {
            Self {
                ledger: value.ledger,
                token: value.token,
                amount: value.amount,
                spender: value.spender,
                from: value.from.into(),
                to: value.to.into(),
                fee: value.fee,
                memo: value.memo.map(|m| m.0),
                created: value.created,
                block_index: value.block_index,
            }
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GiphyContentInternal {
    #[serde(rename = "c", skip_serializing_if = "Option::is_none")]
    pub caption: Option<String>,
    #[serde(rename = "t")]
    pub title: String,
    #[serde(rename = "d")]
    pub desktop: GiphyImageVariantInternal,
    #[serde(rename = "m")]
    pub mobile: GiphyImageVariantInternal,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GiphyImageVariantInternal {
    #[serde(rename = "w")]
    pub width: u32,
    #[serde(rename = "h")]
    pub height: u32,
    #[serde(rename = "u")]
    pub url: String,
    #[serde(rename = "m")]
    pub mime_type: String,
}

impl From<GiphyContent> for GiphyContentInternal {
    fn from(value: GiphyContent) -> Self {
        GiphyContentInternal {
            caption: value.caption,
            title: value.title,
            desktop: value.desktop.into(),
            mobile: value.mobile.into(),
        }
    }
}

impl From<GiphyImageVariant> for GiphyImageVariantInternal {
    fn from(value: GiphyImageVariant) -> Self {
        GiphyImageVariantInternal {
            width: value.width,
            height: value.height,
            url: value.url,
            mime_type: value.mime_type,
        }
    }
}

impl From<&GiphyImageVariantInternal> for GiphyImageVariant {
    fn from(value: &GiphyImageVariantInternal) -> Self {
        GiphyImageVariant {
            width: value.width,
            height: value.height,
            url: value.url.clone(),
            mime_type: value.mime_type.clone(),
        }
    }
}

impl MessageContentInternalSubtype for GiphyContentInternal {
    type ContentType = GiphyContent;

    fn hydrate(self, _my_user_id: Option<UserId>) -> Self::ContentType {
        GiphyContent {
            caption: self.caption,
            title: self.title,
            desktop: GiphyImageVariant::from(&self.desktop),
            mobile: GiphyImageVariant::from(&self.mobile),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ProposalContentInternal {
    #[serde(rename = "g")]
    pub governance_canister_id: CanisterId,
    #[serde(rename = "p")]
    pub proposal: Proposal,
    #[serde(rename = "v", default, skip_serializing_if = "HashMap::is_empty")]
    pub votes: HashMap<UserId, bool>,
}

impl From<ProposalContent> for ProposalContentInternal {
    fn from(value: ProposalContent) -> Self {
        ProposalContentInternal {
            governance_canister_id: value.governance_canister_id,
            proposal: value.proposal,
            votes: HashMap::new(),
        }
    }
}

impl MessageContentInternalSubtype for ProposalContentInternal {
    type ContentType = ProposalContent;

    fn hydrate(self, my_user_id: Option<UserId>) -> Self::ContentType {
        ProposalContent {
            governance_canister_id: self.governance_canister_id,
            proposal: self.proposal,
            my_vote: my_user_id.and_then(|u| self.votes.get(&u)).copied(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PrizeContentInternal {
    #[serde(rename = "p", alias = "p2", default, skip_serializing_if = "Vec::is_empty")]
    pub prizes_remaining: Vec<u128>,
    #[serde(rename = "r", default, skip_serializing_if = "HashSet::is_empty")]
    pub reservations: HashSet<UserId>,
    #[serde(rename = "w")]
    pub winners: HashSet<UserId>,
    #[serde(rename = "t")]
    pub transaction: CompletedCryptoTransactionInternal,
    #[serde(rename = "e")]
    pub end_date: TimestampMillis,
    #[serde(rename = "c", default, skip_serializing_if = "Option::is_none")]
    pub caption: Option<String>,
    #[serde(rename = "d", default, skip_serializing_if = "is_default")]
    pub diamond_only: bool,
    #[serde(rename = "g", default, skip_serializing_if = "is_default")]
    pub lifetime_diamond_only: bool,
    #[serde(rename = "u", default, skip_serializing_if = "is_default")]
    pub unique_person_only: bool,
    #[serde(rename = "s", default, skip_serializing_if = "is_default")]
    pub streak_only: u16,
    #[serde(rename = "f", default, skip_serializing_if = "is_default")]
    pub final_payments_started: bool,
    #[serde(rename = "l", default, skip_serializing_if = "is_default")]
    pub ledger_error: bool,
    #[serde(rename = "pp", default, skip_serializing_if = "is_default")]
    pub prizes_paid: u128,
    #[serde(rename = "fp", default, skip_serializing_if = "is_default")]
    pub fee_percent: u8,
}

impl PrizeContentInternal {
    pub fn new(content: PrizeContentInitial, transaction: CompletedCryptoTransactionInternal) -> PrizeContentInternal {
        PrizeContentInternal {
            prizes_remaining: content.prizes_v2,
            reservations: HashSet::new(),
            winners: HashSet::new(),
            transaction,
            end_date: content.end_date,
            caption: content.caption,
            diamond_only: content.diamond_only,
            lifetime_diamond_only: content.lifetime_diamond_only,
            unique_person_only: content.unique_person_only,
            streak_only: content.streak_only,
            final_payments_started: false,
            ledger_error: false,
            prizes_paid: 0,
            fee_percent: PRIZE_FEE_PERCENT,
        }
    }

    pub fn final_payments(&mut self, sender: UserId, now_nanos: TimestampNanos) -> Vec<PendingCryptoTransaction> {
        if self.final_payments_started {
            return Vec::new();
        }

        self.final_payments_started = true;

        let transaction_fee = self.transaction.fee();
        let ledger = self.transaction.ledger_canister_id();

        // Only take proportion of prizes paid out as a fee and refund the rest
        let oc_fee = (self.prizes_paid * self.fee_percent as u128) / 100;

        // Refund includes prizes unclaimed plus their associated fee
        let unclaimed_prizes = self.prizes_remaining.iter().sum::<u128>();
        let unclaimed_fees =
            ((unclaimed_prizes * self.fee_percent as u128) / 100) + (self.prizes_remaining.len() as u128 * transaction_fee);
        let refund = unclaimed_prizes + unclaimed_fees;
        let token_symbol = self.transaction.token().token_symbol().to_string();

        let mut payments = Vec::new();

        if oc_fee > transaction_fee {
            payments.push(PendingCryptoTransaction::ICRC1(types::icrc1::PendingCryptoTransaction {
                ledger,
                fee: transaction_fee,
                token_symbol: token_symbol.clone(),
                amount: oc_fee - transaction_fee,
                to: Account::from(OPENCHAT_TREASURY_CANISTER_ID),
                memo: Some(MEMO_PRIZE_FEE.to_vec().into()),
                created: now_nanos,
            }));
        }

        if refund > transaction_fee {
            payments.push(create_pending_transaction(
                token_symbol,
                ledger,
                refund - transaction_fee,
                transaction_fee,
                sender,
                Some(&MEMO_PRIZE_REFUND),
                now_nanos,
            ));
        }

        payments
    }
}

impl MessageContentInternalSubtype for PrizeContentInternal {
    type ContentType = PrizeContent;

    fn hydrate(self, my_user_id: Option<UserId>) -> Self::ContentType {
        PrizeContent {
            prizes_remaining: self.prizes_remaining.len() as u32,
            prizes_pending: self.reservations.len() as u32,
            winner_count: self.winners.len() as u32,
            user_is_winner: my_user_id.map(|u| self.winners.contains(&u)).unwrap_or_default(),
            winners: self.winners.into_iter().collect(),
            token_symbol: self.transaction.token().token_symbol().to_string(),
            ledger: self.transaction.ledger_canister_id(),
            end_date: self.end_date,
            caption: self.caption,
            diamond_only: self.diamond_only,
            lifetime_diamond_only: self.lifetime_diamond_only,
            unique_person_only: self.unique_person_only,
            streak_only: self.streak_only,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PrizeWinnerContentInternal {
    #[serde(rename = "w")]
    pub winner: UserId,
    #[serde(rename = "l")]
    pub ledger: CanisterId,
    #[serde(rename = "s")]
    pub token_symbol: String,
    #[serde(rename = "a")]
    pub amount: u128,
    #[serde(rename = "f")]
    pub fee: u128,
    #[serde(rename = "i")]
    pub block_index: u64,
    #[serde(rename = "m")]
    pub prize_message: MessageIndex,
}

impl MessageContentInternalSubtype for PrizeWinnerContentInternal {
    type ContentType = PrizeWinnerContent;

    fn hydrate(self, my_user_id: Option<UserId>) -> Self::ContentType {
        PrizeWinnerContent {
            winner: self.winner,
            transaction: CompletedCryptoTransaction::ICRC1(types::icrc1::CompletedCryptoTransaction {
                ledger: self.ledger,
                token: Cryptocurrency::Other(self.token_symbol.clone()),
                amount: self.amount,
                from: types::icrc1::Account {
                    owner: Principal::anonymous(),
                    subaccount: None,
                }
                .into(),
                to: types::icrc1::Account {
                    owner: my_user_id.map(|u| u.into()).unwrap_or(Principal::anonymous()),
                    subaccount: None,
                }
                .into(),
                fee: self.fee,
                memo: None,
                created: 0,
                block_index: self.block_index,
            }),
            prize_message: self.prize_message,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MessageReminderCreatedContentInternal {
    #[serde(rename = "i")]
    pub reminder_id: u64,
    #[serde(rename = "r")]
    pub remind_at: TimestampMillis,
    #[serde(rename = "n", default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(rename = "h", default, skip_serializing_if = "is_default")]
    pub hidden: bool,
}

impl From<MessageReminderCreatedContent> for MessageReminderCreatedContentInternal {
    fn from(value: MessageReminderCreatedContent) -> Self {
        MessageReminderCreatedContentInternal {
            reminder_id: value.reminder_id,
            remind_at: value.remind_at,
            notes: value.notes,
            hidden: value.hidden,
        }
    }
}

impl MessageContentInternalSubtype for MessageReminderCreatedContentInternal {
    type ContentType = MessageReminderCreatedContent;

    fn hydrate(self, _my_user_id: Option<UserId>) -> Self::ContentType {
        MessageReminderCreatedContent {
            reminder_id: self.reminder_id,
            remind_at: self.remind_at,
            notes: self.notes,
            hidden: self.hidden,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MessageReminderContentInternal {
    #[serde(rename = "i")]
    pub reminder_id: u64,
    #[serde(rename = "n", default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

impl From<MessageReminderContent> for MessageReminderContentInternal {
    fn from(value: MessageReminderContent) -> Self {
        MessageReminderContentInternal {
            reminder_id: value.reminder_id,
            notes: value.notes,
        }
    }
}

impl MessageContentInternalSubtype for MessageReminderContentInternal {
    type ContentType = MessageReminderContent;

    fn hydrate(self, _my_user_id: Option<UserId>) -> Self::ContentType {
        MessageReminderContent {
            reminder_id: self.reminder_id,
            notes: self.notes,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ReportedMessageInternal {
    #[serde(rename = "r")]
    pub reports: Vec<MessageReport>,
}

impl From<ReportedMessage> for ReportedMessageInternal {
    fn from(value: ReportedMessage) -> Self {
        ReportedMessageInternal { reports: value.reports }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct P2PSwapContentInternal {
    #[serde(rename = "i", alias = "swap_id")]
    pub swap_id: u32,
    #[serde(rename = "t0", alias = "token0", deserialize_with = "deserialize_token_info")]
    pub token0: TokenInfo,
    #[serde(rename = "a0", alias = "token0_amount")]
    pub token0_amount: u128,
    #[serde(rename = "t1", alias = "token1", deserialize_with = "deserialize_token_info")]
    pub token1: TokenInfo,
    #[serde(rename = "a1", alias = "token1_amount")]
    pub token1_amount: u128,
    #[serde(rename = "e", alias = "expires_at")]
    pub expires_at: TimestampMillis,
    #[serde(rename = "c", alias = "caption", skip_serializing_if = "Option::is_none")]
    pub caption: Option<String>,
    #[serde(rename = "tx0", alias = "token0_txn_in")]
    pub token0_txn_in: u64,
    #[serde(rename = "s", alias = "status")]
    pub status: P2PSwapStatus,
}

impl P2PSwapContentInternal {
    pub fn new(
        swap_id: u32,
        content: P2PSwapContentInitial,
        token0_txn_in: u64,
        now: TimestampMillis,
    ) -> P2PSwapContentInternal {
        P2PSwapContentInternal {
            swap_id,
            token0: content.token0,
            token0_amount: content.token0_amount,
            token1: content.token1,
            token1_amount: content.token1_amount,
            expires_at: now + content.expires_in,
            caption: content.caption,
            token0_txn_in,
            status: P2PSwapStatus::Open,
        }
    }

    pub fn reserve(&mut self, user_id: UserId, now: TimestampMillis) -> bool {
        if let P2PSwapStatus::Open = self.status {
            if now < self.expires_at {
                self.status = P2PSwapStatus::Reserved(P2PSwapReserved { reserved_by: user_id });
                return true;
            } else {
                self.status = P2PSwapStatus::Expired(P2PSwapExpired { token0_txn_out: None });
            }
        }

        false
    }

    pub fn unreserve(&mut self, user_id: UserId) -> bool {
        if let P2PSwapStatus::Reserved(r) = &self.status {
            if r.reserved_by == user_id {
                self.status = P2PSwapStatus::Open;
                return true;
            }
        }
        false
    }

    pub fn accept(&mut self, user_id: UserId, token1_txn_in: u64) -> bool {
        if let P2PSwapStatus::Reserved(a) = &self.status {
            if a.reserved_by == user_id {
                self.status = P2PSwapStatus::Accepted(P2PSwapAccepted {
                    accepted_by: user_id,
                    token1_txn_in,
                });
                return true;
            }
        }
        false
    }

    pub fn complete(&mut self, user_id: UserId, token0_txn_out: u64, token1_txn_out: u64) -> Option<P2PSwapCompleted> {
        if let P2PSwapStatus::Accepted(a) = &self.status {
            if a.accepted_by == user_id {
                let status = P2PSwapCompleted {
                    accepted_by: user_id,
                    token1_txn_in: a.token1_txn_in,
                    token0_txn_out,
                    token1_txn_out,
                };
                self.status = P2PSwapStatus::Completed(status.clone());
                return Some(status);
            }
        }
        None
    }

    pub fn cancel(&mut self) -> bool {
        if matches!(self.status, P2PSwapStatus::Open) {
            self.status = P2PSwapStatus::Cancelled(P2PSwapCancelled { token0_txn_out: None });
            true
        } else {
            false
        }
    }

    pub fn mark_expired(&mut self) -> bool {
        if matches!(self.status, P2PSwapStatus::Open) {
            self.status = P2PSwapStatus::Expired(P2PSwapExpired { token0_txn_out: None });
            true
        } else {
            false
        }
    }
}

impl MessageContentInternalSubtype for P2PSwapContentInternal {
    type ContentType = P2PSwapContent;

    fn hydrate(self, _my_user_id: Option<UserId>) -> Self::ContentType {
        self.into()
    }
}

impl From<P2PSwapContentInternal> for P2PSwapContent {
    fn from(value: P2PSwapContentInternal) -> Self {
        Self {
            swap_id: value.swap_id,
            token0: value.token0,
            token0_amount: value.token0_amount,
            token1: value.token1,
            token1_amount: value.token1_amount,
            expires_at: value.expires_at,
            caption: value.caption,
            token0_txn_in: value.token0_txn_in,
            status: value.status,
        }
    }
}

impl From<P2PSwapContent> for P2PSwapContentInternal {
    fn from(value: P2PSwapContent) -> Self {
        Self {
            swap_id: value.swap_id,
            token0: value.token0,
            token0_amount: value.token0_amount,
            token1: value.token1,
            token1_amount: value.token1_amount,
            expires_at: value.expires_at,
            caption: value.caption,
            token0_txn_in: value.token0_txn_in,
            status: value.status,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct VideoCallContentInternal {
    #[serde(rename = "t", default, skip_serializing_if = "is_default")]
    pub call_type: VideoCallType,
    #[serde(rename = "e", default, skip_serializing_if = "is_default")]
    pub ended: Option<TimestampMillis>,
    #[serde(rename = "p", default)]
    pub participants: HashMap<UserId, CallParticipantInternal>,
}

impl VideoCallContentInternal {
    fn hydrate(&self) -> VideoCallContent {
        let mut participants = Vec::new();
        let mut hidden_participants = 0;
        for (user_id, participant) in self.participants.iter() {
            if matches!(participant.presence, VideoCallPresence::Hidden) {
                hidden_participants += 1;
            } else {
                participants.push(CallParticipant {
                    joined: participant.joined,
                    user_id: *user_id,
                });
            }
        }

        VideoCallContent {
            call_type: self.call_type,
            ended: self.ended,
            participants,
            hidden_participants,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CallParticipantInternal {
    #[serde(rename = "j")]
    pub joined: TimestampMillis,
    #[serde(rename = "u", default, skip_serializing_if = "Option::is_none")]
    pub last_updated: Option<TimestampMillis>,
    #[serde(rename = "p", default, skip_serializing_if = "is_default")]
    pub presence: VideoCallPresence,
}

impl MessageContentInternalSubtype for ReportedMessageInternal {
    type ContentType = ReportedMessage;

    fn hydrate(self, _my_user_id: Option<UserId>) -> Self::ContentType {
        ReportedMessage {
            count: self.reports.len() as u32,
            reports: self.reports.into_iter().take(10).collect(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CustomContentInternal {
    #[serde(rename = "k")]
    pub kind: String,
    #[serde(rename = "d", with = "serde_bytes")]
    pub data: Vec<u8>,
}

impl From<CustomContent> for CustomContentInternal {
    fn from(value: CustomContent) -> Self {
        CustomContentInternal {
            kind: value.kind,
            data: value.data,
        }
    }
}

impl MessageContentInternalSubtype for CustomContentInternal {
    type ContentType = CustomContent;

    fn hydrate(self, _my_user_id: Option<UserId>) -> Self::ContentType {
        CustomContent {
            kind: self.kind,
            data: self.data,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BlobReferenceInternal {
    #[serde(rename = "c", alias = "canister_id")]
    pub canister_id: CanisterId,
    #[serde(rename = "b", alias = "blob_id")]
    pub blob_id: u128,
}

impl From<BlobReferenceInternal> for BlobReference {
    fn from(value: BlobReferenceInternal) -> Self {
        BlobReference {
            canister_id: value.canister_id,
            blob_id: value.blob_id,
        }
    }
}

impl From<BlobReference> for BlobReferenceInternal {
    fn from(value: BlobReference) -> Self {
        BlobReferenceInternal {
            canister_id: value.canister_id,
            blob_id: value.blob_id,
        }
    }
}

impl From<MessageContentInitial> for MessageContentInternal {
    fn from(value: MessageContentInitial) -> Self {
        match value {
            MessageContentInitial::Text(t) => MessageContentInternal::Text(t.into()),
            MessageContentInitial::Image(i) => MessageContentInternal::Image(i.into()),
            MessageContentInitial::Video(v) => MessageContentInternal::Video(v.into()),
            MessageContentInitial::Audio(a) => MessageContentInternal::Audio(a.into()),
            MessageContentInitial::File(f) => MessageContentInternal::File(f.into()),
            MessageContentInitial::Poll(p) => MessageContentInternal::Poll(p.into()),
            MessageContentInitial::Deleted(d) => MessageContentInternal::Deleted(d.into()),
            MessageContentInitial::Giphy(g) => MessageContentInternal::Giphy(g.into()),
            MessageContentInitial::GovernanceProposal(p) => MessageContentInternal::GovernanceProposal(p.into()),
            MessageContentInitial::MessageReminderCreated(r) => MessageContentInternal::MessageReminderCreated(r.into()),
            MessageContentInitial::MessageReminder(r) => MessageContentInternal::MessageReminder(r.into()),
            MessageContentInitial::Custom(c) => MessageContentInternal::Custom(c.into()),
            MessageContentInitial::Crypto(c) => c
                .try_into()
                .map(MessageContentInternal::Crypto)
                .expect("Crypto transfer must be completed"),
            MessageContentInitial::P2PSwap(_) | MessageContentInitial::Prize(_) => {
                unreachable!()
            }
        }
    }
}

impl From<&MessageContentInternal> for MessageContentType {
    fn from(value: &MessageContentInternal) -> Self {
        match value {
            MessageContentInternal::Text(_) => MessageContentType::Text,
            MessageContentInternal::Image(_) => MessageContentType::Image,
            MessageContentInternal::Video(_) => MessageContentType::Video,
            MessageContentInternal::Audio(_) => MessageContentType::Audio,
            MessageContentInternal::File(_) => MessageContentType::File,
            MessageContentInternal::Poll(_) => MessageContentType::Poll,
            MessageContentInternal::Crypto(_) => MessageContentType::Crypto,
            MessageContentInternal::Deleted(_) => MessageContentType::Deleted,
            MessageContentInternal::Giphy(_) => MessageContentType::Giphy,
            MessageContentInternal::GovernanceProposal(_) => MessageContentType::GovernanceProposal,
            MessageContentInternal::Prize(_) => MessageContentType::Prize,
            MessageContentInternal::PrizeWinner(_) => MessageContentType::PrizeWinner,
            MessageContentInternal::MessageReminderCreated(_) => MessageContentType::MessageReminderCreated,
            MessageContentInternal::MessageReminder(_) => MessageContentType::MessageReminder,
            MessageContentInternal::ReportedMessage(_) => MessageContentType::ReportedMessage,
            MessageContentInternal::P2PSwap(_) => MessageContentType::P2PSwap,
            MessageContentInternal::VideoCall(_) => MessageContentType::VideoCall,
            MessageContentInternal::Custom(c) => MessageContentType::Custom(c.kind.clone()),
        }
    }
}

fn deserialize_token_info<'de, D: Deserializer<'de>>(d: D) -> Result<TokenInfo, D::Error> {
    let token_info: TokenInfoCombined = Deserialize::deserialize(d)?;
    Ok(token_info.into())
}

// We need this in order to deserialize old messages stored in stable memory
#[derive(Deserialize)]
struct TokenInfoCombined {
    symbol: Option<String>,
    token: Option<Cryptocurrency>,
    ledger: CanisterId,
    decimals: u8,
    fee: u128,
}

impl From<TokenInfoCombined> for TokenInfo {
    fn from(value: TokenInfoCombined) -> Self {
        let symbol = value
            .symbol
            .unwrap_or_else(|| value.token.unwrap().token_symbol().to_string());

        TokenInfo {
            symbol,
            ledger: value.ledger,
            decimals: value.decimals,
            fee: value.fee,
        }
    }
}
