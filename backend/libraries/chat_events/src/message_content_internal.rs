#![expect(deprecated)]
use crate::DeletedByInternal;
use candid::{CandidType, Principal};
use constants::{MEMO_PRIZE_FEE, MEMO_PRIZE_REFUND, OPENCHAT_TREASURY_CANISTER_ID, PRIZE_FEE_PERCENT};
use ledger_utils::{create_pending_transaction, format_crypto_amount};
use search::simple::Document;
use serde::{Deserialize, Deserializer, Serialize};
use serde_bytes::ByteBuf;
use std::collections::{BTreeMap, BTreeSet, HashMap};
use types::icrc1::{Account, CryptoAccount};
use types::{
    ActionCardContent, ActionCardContentInitial, ActionCardRow, ActionCardState, AiAppId, AudioContent, BlobReference,
    CallParticipant, CanisterId, CompletedCryptoTransaction, ContentValidationError, ContentWithCaptionEventPayload,
    CryptoContent, CryptoContentEventPayload, CryptoTransaction, Cryptocurrency, CustomContent, EncryptedContent,
    EncryptedContentEventPayload, EncryptedMessageContentType, EncryptionKey, FileContent, FileContentEventPayload,
    GiphyContent, GiphyImageVariant, GovernanceProposalContentEventPayload, ImageContent, ImageOrVideoContentEventPayload,
    MAX_TEXT_LENGTH, MAX_TEXT_LENGTH_USIZE, MessageContent, MessageContentEventPayload, MessageContentInitial,
    MessageContentType, MessageIndex, MessageReminderContent, MessageReminderContentEventPayload,
    MessageReminderCreatedContent, MessageReport, Milliseconds, ModerationInput, ModerationReportContent, P2PSwapAccepted,
    P2PSwapCancelled, P2PSwapCompleted, P2PSwapContent, P2PSwapContentEventPayload, P2PSwapContentInitial, P2PSwapExpired,
    P2PSwapReserved, P2PSwapStatus, PendingCryptoTransaction, PollConfig, PollContent, PollContentEventPayload, PollVotes,
    PrizeContent, PrizeContentEventPayload, PrizeContentInitial, PrizeWinnerContent, PrizeWinnerContentEventPayload, Proposal,
    ProposalContent, RegisterVoteResult, ReportedMessage, ReportedMessageContentEventPayload, TextContent,
    TextContentEventPayload, ThumbnailData, TimestampMillis, TimestampNanos, TokenInfo, TotalVotes, TransactionHash, UserId,
    UserType, VideoCallContent, VideoCallPresence, VideoCallType, VideoContent, VoteOperation, is_default,
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
    #[serde(rename = "modr")]
    ModerationReport(Box<ModerationReportContent>),
    #[serde(rename = "p2p")]
    P2PSwap(P2PSwapContentInternal),
    #[serde(rename = "vc")]
    VideoCall(VideoCallContentInternal),
    #[serde(rename = "e")]
    Encrypted(EncryptedContentInternal),
    #[serde(rename = "cu")]
    Custom(CustomContentInternal),
    #[serde(rename = "ac")]
    ActionCard(ActionCardContentInternal),
}

const MAX_ACTION_CARD_BYTES: usize = 64 * 1024;
const MAX_ACTION_CARD_ROWS: usize = 32;
const MAX_ACTION_CARD_RECIPIENTS: usize = 8;
const MAX_ACTION_CARD_PAYLOAD_BYTES: usize = 16_384;

fn action_card_within_bounds(card: &ActionCardContentInitial, sender_user_type: UserType, now: TimestampMillis) -> bool {
    fn chars_between(value: &str, min: usize, max: usize) -> bool {
        let length = value.chars().count();
        (min..=max).contains(&length) && (min == 0 || !value.trim().is_empty())
    }

    let app_tuple_all_present = card.app_id.is_some() && card.app_revision.is_some() && card.app_provenance.is_some();
    let app_tuple_all_absent = card.app_id.is_none() && card.app_revision.is_none() && card.app_provenance.is_none();
    if (!app_tuple_all_absent && (!app_tuple_all_present || !matches!(sender_user_type, UserType::User)))
        || card
            .app_provenance
            .as_ref()
            .is_some_and(|value| value.len() != types::AI_APP_CARD_TOKEN_BYTES)
        || !chars_between(&card.title, 1, 200)
        || !chars_between(&card.confirm_label, 1, 80)
        || !chars_between(&card.cancel_label, 1, 80)
        || !chars_between(&card.action_id, 1, 128)
        || card.rows.is_empty()
        || card.rows.len() > MAX_ACTION_CARD_ROWS
        || card.disclosure.as_ref().is_some_and(|value| value.chars().count() > 1_000)
        || card.expires_at.is_some_and(|expires_at| expires_at <= now)
        || card
            .confirm_payload
            .as_ref()
            .is_some_and(|payload| payload.is_empty() || payload.len() > MAX_ACTION_CARD_PAYLOAD_BYTES)
    {
        return false;
    }
    if card
        .rows
        .iter()
        .any(|row| !chars_between(&row.label, 1, 128) || row.value.chars().count() > 4_096)
    {
        return false;
    }
    let mut recipients = Vec::new();
    for key in card.recipient_public_key.iter().chain(card.recipient_public_keys.iter()) {
        if key.is_empty() || key.chars().count() > 2_000 {
            return false;
        }
        if !recipients.contains(key) {
            recipients.push(key.clone());
        }
    }
    if recipients.len() > MAX_ACTION_CARD_RECIPIENTS {
        return false;
    }
    msgpack::serialize_to_vec(card).is_ok_and(|encoded| encoded.len() <= MAX_ACTION_CARD_BYTES)
}

impl MessageContentInternal {
    /// Called only by a chat update after UserIndex consumed a one-time proof whose content hash was
    /// vouched by the exact registered app canister and recomputed from raw message ingress.
    pub fn mark_ai_app_card_verified(&mut self, content_hash: [u8; 32]) -> bool {
        if let MessageContentInternal::ActionCard(card) = self {
            card.mark_app_verified(content_hash);
            true
        } else {
            false
        }
    }

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
                    MessageContentInitial::Poll(_)
                        | MessageContentInitial::GovernanceProposal(_)
                        | MessageContentInitial::ActionCard(_)
                );

            if invalid_type_for_forwarding {
                return ValidateNewMessageContentResult::Error(ContentValidationError::InvalidTypeForForwarding);
            }
        }

        // Allow GovernanceProposal messages to exceed the max length since they are collapsed on the UI
        if content.text_length() > MAX_TEXT_LENGTH_USIZE && !matches!(&content, MessageContentInitial::GovernanceProposal(_)) {
            return ValidateNewMessageContentResult::Error(ContentValidationError::TextTooLong(MAX_TEXT_LENGTH));
        }

        if let MessageContentInitial::ActionCard(card) = &content
            && !action_card_within_bounds(card, sender_user_type, now)
        {
            return ValidateNewMessageContentResult::Error(ContentValidationError::TextTooLong(MAX_TEXT_LENGTH));
        }

        match &content {
            MessageContentInitial::Poll(p) => {
                if let Err(reason) = p.config.validate(is_direct_chat, now) {
                    return ValidateNewMessageContentResult::Error(ContentValidationError::InvalidPoll(reason));
                }
            }
            MessageContentInitial::Prize(p) if p.end_date <= now => {
                return ValidateNewMessageContentResult::Error(ContentValidationError::PrizeEndDateInThePast);
            }
            MessageContentInitial::Encrypted(e) if e.encrypted_data.len() > MAX_TEXT_LENGTH_USIZE => {
                return ValidateNewMessageContentResult::Error(ContentValidationError::TextTooLong(MAX_TEXT_LENGTH));
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
            MessageContentInitial::Encrypted(e) => e.encrypted_data.is_empty(),
            MessageContentInitial::Deleted(_) => true,
            MessageContentInitial::ActionCard(a) => a.rows.is_empty(),
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
            MessageContentInternal::ModerationReport(r) => MessageContent::ModerationReport(*r.clone()),
            MessageContentInternal::P2PSwap(p) => MessageContent::P2PSwap(p.hydrate(my_user_id)),
            MessageContentInternal::VideoCall(c) => MessageContent::VideoCall(c.hydrate()),
            MessageContentInternal::Encrypted(e) => MessageContent::Encrypted(e.hydrate(my_user_id)),
            MessageContentInternal::Custom(c) => MessageContent::Custom(c.hydrate(my_user_id)),
            MessageContentInternal::ActionCard(a) => MessageContent::ActionCard(a.hydrate(my_user_id)),
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
            MessageContentInternal::ActionCard(c) => Some(c.title.as_str()),
            MessageContentInternal::PrizeWinner(_)
            | MessageContentInternal::Deleted(_)
            | MessageContentInternal::ReportedMessage(_)
            | MessageContentInternal::ModerationReport(_)
            | MessageContentInternal::VideoCall(_)
            | MessageContentInternal::Encrypted(_)
            | MessageContentInternal::Custom(_) => None,
        }
    }

    pub fn moderation_input(&self) -> ModerationInput {
        let mut input = ModerationInput {
            text: self.text().map(|t| t.to_string()),
            image_urls: Vec::new(),
        };

        match self {
            MessageContentInternal::Image(i) => {
                if let Some(br) = &i.blob_reference {
                    input.image_urls.push(BlobReference::from(br.clone()).url());
                }
            }
            MessageContentInternal::Video(v) => {
                if let Some(br) = &v.image_blob_reference {
                    input.image_urls.push(BlobReference::from(br.clone()).url());
                }
            }
            MessageContentInternal::Giphy(g) => {
                if let Some(variant) = [&g.desktop, &g.mobile]
                    .into_iter()
                    .find(|v| v.mime_type.starts_with("image/"))
                {
                    input.image_urls.push(variant.url.clone());
                }
            }
            MessageContentInternal::Poll(p) => {
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

    pub fn text_length(&self) -> u32 {
        self.text().map(|t| t.len() as u32).unwrap_or_default()
    }

    // The media which the scanning pipeline hashes: still images only. Image content always;
    // File content regardless of its declared mime type (the declaration is client-supplied
    // and must not gate the scan - the worker's decoder decides what is actually an image,
    // reporting everything else Unscannable); the Video inline thumbnail, which is itself a
    // still image rendered in the chat (keyframes of the video stream await extraction in v2).
    // Giphy variants are third-party URLs, not OpenChat blobs.
    pub fn scannable_blobs(&self) -> Vec<types::MediaScanBlob> {
        match self {
            MessageContentInternal::Image(i) => i
                .blob_reference
                .clone()
                .map(|br| types::MediaScanBlob {
                    blob_reference: br.into(),
                    mime_type: i.mime_type.clone(),
                    frame_index: None,
                })
                .into_iter()
                .collect(),
            MessageContentInternal::File(f) => f
                .blob_reference
                .clone()
                .map(|br| types::MediaScanBlob {
                    blob_reference: br.into(),
                    mime_type: f.mime_type.clone(),
                    frame_index: None,
                })
                .into_iter()
                .collect(),
            MessageContentInternal::Video(v) => v
                .image_blob_reference
                .clone()
                .map(|br| types::MediaScanBlob {
                    blob_reference: br.into(),
                    mime_type: "image/*".to_string(),
                    frame_index: None,
                })
                .into_iter()
                .collect(),
            _ => Vec::new(),
        }
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
            | MessageContentInternal::ModerationReport(_)
            | MessageContentInternal::P2PSwap(_)
            | MessageContentInternal::VideoCall(_)
            | MessageContentInternal::Encrypted(_)
            | MessageContentInternal::Custom(_)
            | MessageContentInternal::ActionCard(_) => {}
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
                token: c.transfer.token_symbol().to_string(),
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
                token: c.transaction.token_symbol().to_string(),
                amount: c.transaction.units(),
                diamond_only: c.diamond_only,
                lifetime_diamond_only: c.lifetime_diamond_only,
                unique_person_only: c.unique_person_only,
                streak_only: c.streak_only,
                requires_captcha: c.requires_captcha,
                min_chit_earned: c.min_chit_earned,
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
            MessageContentInternal::ModerationReport(_) => MessageContentEventPayload::Empty,
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
            MessageContentInternal::Encrypted(e) => MessageContentEventPayload::Encrypted(EncryptedContentEventPayload {
                content_type: MessageContentType::from(e.content_type.clone()).to_string(),
                encrypted_length: e.encrypted_data.len() as u32,
            }),
            MessageContentInternal::Deleted(_)
            | MessageContentInternal::VideoCall(_)
            | MessageContentInternal::Custom(_)
            | MessageContentInternal::ActionCard(_) => MessageContentEventPayload::Empty,
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
                document.add_field(c.transfer.token_symbol());

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
                document.add_field(c.transaction.token_symbol());
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
            MessageContentInternal::ModerationReport(_)
            | MessageContentInternal::ReportedMessage(_)
            | MessageContentInternal::Deleted(_)
            | MessageContentInternal::VideoCall(_)
            | MessageContentInternal::Encrypted(_)
            | MessageContentInternal::ActionCard(_) => {}
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
    #[serde(rename = "d", default, skip_serializing_if = "is_default")]
    pub duration_ms: Milliseconds,
    #[serde(rename = "s", default, skip_serializing_if = "Vec::is_empty", with = "serde_bytes")]
    pub samples: Vec<u8>,
}

impl From<AudioContent> for AudioContentInternal {
    fn from(value: AudioContent) -> Self {
        AudioContentInternal {
            caption: value.caption,
            mime_type: value.mime_type,
            blob_reference: value.blob_reference.map(|r| r.into()),
            duration_ms: value.duration_ms.unwrap_or_default(),
            samples: value.samples.unwrap_or_default(),
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
            duration_ms: Some(self.duration_ms),
            samples: Some(self.samples),
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
                        for (_, votes) in self.votes.iter_mut().filter(|(o, _)| **o != option_index) {
                            if let Some((index, _)) = votes.iter().enumerate().find(|(_, u)| **u == user_id) {
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
                    if let Some(votes) = self.votes.get_mut(&option_index)
                        && let Some((index, _)) = votes.iter().enumerate().find(|(_, u)| **u == user_id)
                    {
                        votes.remove(index);
                        return RegisterVoteResult::Success(true);
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

    pub fn token_symbol(&self) -> &str {
        match self {
            CompletedCryptoTransactionInternal::NNS(t) => t.token_symbol.as_str(),
            CompletedCryptoTransactionInternal::ICRC1(t) => t.token_symbol.as_str(),
            CompletedCryptoTransactionInternal::ICRC2(t) => t.token_symbol.as_str(),
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

    #[derive(Serialize, Clone, Debug)]
    pub struct CompletedCryptoTransactionInternal {
        #[serde(rename = "l", alias = "ledger")]
        pub ledger: CanisterId,
        #[serde(rename = "y", alias = "token_symbol")]
        pub token_symbol: String,
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

    impl<'de> Deserialize<'de> for CompletedCryptoTransactionInternal {
        fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
        where
            D: Deserializer<'de>,
        {
            #[derive(Deserialize)]
            struct Inner {
                #[serde(rename = "l", alias = "ledger")]
                ledger: CanisterId,
                #[serde(rename = "k", alias = "token")]
                token: Option<Cryptocurrency>,
                #[serde(rename = "y", alias = "token_symbol")]
                token_symbol: Option<String>,
                #[serde(rename = "a", alias = "amount", deserialize_with = "deserialize_amount")]
                amount: u64,
                #[serde(rename = "e", alias = "fee", deserialize_with = "deserialize_amount")]
                fee: u64,
                #[serde(rename = "f", alias = "from")]
                from: CryptoAccountInternal,
                #[serde(rename = "t", alias = "to")]
                to: CryptoAccountInternal,
                #[serde(rename = "m", alias = "memo")]
                memo: u64,
                #[serde(rename = "c", alias = "created")]
                created: TimestampNanos,
                #[serde(rename = "h", alias = "transaction_hash")]
                transaction_hash: TransactionHash,
                #[serde(rename = "i", alias = "block_index")]
                block_index: u64,
            }

            let inner = Inner::deserialize(deserializer)?;
            Ok(CompletedCryptoTransactionInternal {
                ledger: inner.ledger,
                token_symbol: inner
                    .token_symbol
                    .unwrap_or_else(|| inner.token.unwrap().token_symbol().to_string()),
                amount: inner.amount,
                from: inner.from,
                to: inner.to,
                fee: inner.fee,
                memo: inner.memo,
                created: inner.created,
                transaction_hash: inner.transaction_hash,
                block_index: inner.block_index,
            })
        }
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
                token_symbol: value.token_symbol,
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
                token_symbol: value.token_symbol,
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

    #[derive(Serialize, Clone, Debug)]
    pub struct CompletedCryptoTransactionInternal {
        #[serde(rename = "l", alias = "ledger")]
        pub ledger: CanisterId,
        #[serde(rename = "y", alias = "token_symbol")]
        pub token_symbol: String,
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

    impl<'de> Deserialize<'de> for CompletedCryptoTransactionInternal {
        fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
        where
            D: Deserializer<'de>,
        {
            #[derive(Deserialize)]
            struct Inner {
                #[serde(rename = "l", alias = "ledger")]
                ledger: CanisterId,
                #[serde(rename = "k", alias = "token")]
                token: Option<Cryptocurrency>,
                #[serde(rename = "y", alias = "token_symbol")]
                token_symbol: Option<String>,
                #[serde(rename = "a", alias = "amount")]
                amount: u128,
                #[serde(rename = "f", alias = "from")]
                from: CryptoAccountInternal,
                #[serde(rename = "t", alias = "to")]
                to: CryptoAccountInternal,
                #[serde(rename = "e", alias = "fee")]
                fee: u128,
                #[serde(rename = "m", alias = "memo", skip_serializing_if = "Option::is_none")]
                memo: Option<ByteBuf>,
                #[serde(rename = "c", alias = "created")]
                created: TimestampNanos,
                #[serde(rename = "i", alias = "block_index")]
                block_index: u64,
            }

            let inner = Inner::deserialize(deserializer)?;
            Ok(CompletedCryptoTransactionInternal {
                ledger: inner.ledger,
                token_symbol: inner
                    .token_symbol
                    .unwrap_or_else(|| inner.token.unwrap().token_symbol().to_string()),
                amount: inner.amount,
                from: inner.from,
                to: inner.to,
                fee: inner.fee,
                memo: inner.memo,
                created: inner.created,
                block_index: inner.block_index,
            })
        }
    }

    impl From<CompletedCryptoTransactionInternal> for types::icrc1::CompletedCryptoTransaction {
        fn from(value: CompletedCryptoTransactionInternal) -> Self {
            Self {
                ledger: value.ledger,
                token_symbol: value.token_symbol,
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
                token_symbol: value.token_symbol,
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

    #[derive(Serialize, Clone, Debug)]
    pub struct CompletedCryptoTransactionInternal {
        #[serde(rename = "l", alias = "ledger")]
        pub ledger: CanisterId,
        #[serde(rename = "y", alias = "token_symbol")]
        pub token_symbol: String,
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

    impl<'de> Deserialize<'de> for CompletedCryptoTransactionInternal {
        fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
        where
            D: Deserializer<'de>,
        {
            #[derive(Deserialize)]
            struct Inner {
                #[serde(rename = "l", alias = "ledger")]
                ledger: CanisterId,
                #[serde(rename = "k", alias = "token")]
                token: Option<Cryptocurrency>,
                #[serde(rename = "y", alias = "token_symbol")]
                token_symbol: Option<String>,
                #[serde(rename = "a", alias = "amount")]
                amount: u128,
                #[serde(rename = "s", alias = "spender")]
                spender: UserId,
                #[serde(rename = "f", alias = "from")]
                from: CryptoAccountInternal,
                #[serde(rename = "t", alias = "to")]
                to: CryptoAccountInternal,
                #[serde(rename = "e", alias = "fee")]
                fee: u128,
                #[serde(rename = "m", alias = "memo")]
                memo: Option<ByteBuf>,
                #[serde(rename = "c", alias = "created")]
                created: TimestampNanos,
                #[serde(rename = "i", alias = "block_index")]
                block_index: u64,
            }

            let inner = Inner::deserialize(deserializer)?;
            Ok(CompletedCryptoTransactionInternal {
                ledger: inner.ledger,
                token_symbol: inner
                    .token_symbol
                    .unwrap_or_else(|| inner.token.unwrap().token_symbol().to_string()),
                amount: inner.amount,
                spender: inner.spender,
                from: inner.from,
                to: inner.to,
                fee: inner.fee,
                memo: inner.memo,
                created: inner.created,
                block_index: inner.block_index,
            })
        }
    }

    impl From<CompletedCryptoTransactionInternal> for types::icrc2::CompletedCryptoTransaction {
        fn from(value: CompletedCryptoTransactionInternal) -> Self {
            Self {
                ledger: value.ledger,
                token_symbol: value.token_symbol,
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
                token_symbol: value.token_symbol,
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
    #[serde(rename = "v", default, skip_serializing_if = "BTreeMap::is_empty")]
    pub votes: BTreeMap<UserId, bool>,
}

impl From<ProposalContent> for ProposalContentInternal {
    fn from(value: ProposalContent) -> Self {
        ProposalContentInternal {
            governance_canister_id: value.governance_canister_id,
            proposal: value.proposal,
            votes: BTreeMap::new(),
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
    #[serde(rename = "r", default, skip_serializing_if = "BTreeSet::is_empty")]
    pub reservations: BTreeSet<UserId>,
    #[serde(rename = "w")]
    pub winners: BTreeSet<UserId>,
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
    #[serde(rename = "rc", default, skip_serializing_if = "is_default")]
    pub requires_captcha: bool,
    #[serde(rename = "mc", default, skip_serializing_if = "is_default")]
    pub min_chit_earned: u32,
}

impl PrizeContentInternal {
    pub fn new(content: PrizeContentInitial, transaction: CompletedCryptoTransactionInternal) -> PrizeContentInternal {
        PrizeContentInternal {
            prizes_remaining: content.prizes_v2,
            reservations: BTreeSet::new(),
            winners: BTreeSet::new(),
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
            requires_captcha: content.requires_captcha,
            min_chit_earned: content.min_chit_earned,
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
        let token_symbol = self.transaction.token_symbol().to_string();

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
            winners: Vec::new(),
            token_symbol: self.transaction.token_symbol().to_string(),
            ledger: self.transaction.ledger_canister_id(),
            end_date: self.end_date,
            caption: self.caption,
            diamond_only: self.diamond_only,
            lifetime_diamond_only: self.lifetime_diamond_only,
            unique_person_only: self.unique_person_only,
            streak_only: self.streak_only,
            requires_captcha: self.requires_captcha,
            min_chit_earned: self.min_chit_earned,
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
                token_symbol: self.token_symbol,
                amount: self.amount,
                from: types::icrc1::Account {
                    owner: Principal::anonymous(),
                    subaccount: None,
                }
                .into(),
                to: my_user_id
                    .map(types::icrc1::Account::for_user)
                    .unwrap_or(types::icrc1::Account {
                        owner: Principal::anonymous(),
                        subaccount: None,
                    })
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
        if let P2PSwapStatus::Reserved(r) = &self.status
            && r.reserved_by == user_id
        {
            self.status = P2PSwapStatus::Open;
            return true;
        }
        false
    }

    pub fn accept(&mut self, user_id: UserId, token1_txn_in: u64) -> bool {
        if let P2PSwapStatus::Reserved(a) = &self.status
            && a.reserved_by == user_id
        {
            self.status = P2PSwapStatus::Accepted(P2PSwapAccepted {
                accepted_by: user_id,
                token1_txn_in,
            });
            return true;
        }
        false
    }

    pub fn complete(&mut self, user_id: UserId, token0_txn_out: u64, token1_txn_out: u64) -> Option<P2PSwapCompleted> {
        if let P2PSwapStatus::Accepted(a) = &self.status
            && a.accepted_by == user_id
        {
            let status = P2PSwapCompleted {
                accepted_by: user_id,
                token1_txn_in: a.token1_txn_in,
                token0_txn_out,
                token1_txn_out,
            };
            self.status = P2PSwapStatus::Completed(status.clone());
            return Some(status);
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
    pub participants: BTreeMap<UserId, CallParticipantInternal>,
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

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct EncryptedContentInternal {
    #[serde(rename = "c")]
    pub content_type: EncryptedMessageContentType,
    #[serde(rename = "v")]
    pub version: u32,
    #[serde(rename = "k")]
    pub encrypted_message_key: EncryptionKey,
    #[serde(rename = "p")]
    pub public_key: EncryptionKey,
    #[serde(rename = "d", with = "serde_bytes")]
    pub encrypted_data: Vec<u8>,
}

impl From<EncryptedContent> for EncryptedContentInternal {
    fn from(value: EncryptedContent) -> Self {
        EncryptedContentInternal {
            content_type: value.content_type,
            version: value.version,
            encrypted_message_key: value.encrypted_message_key,
            public_key: value.public_key,
            encrypted_data: value.encrypted_data,
        }
    }
}

impl MessageContentInternalSubtype for EncryptedContentInternal {
    type ContentType = EncryptedContent;

    fn hydrate(self, _my_user_id: Option<UserId>) -> Self::ContentType {
        EncryptedContent {
            version: self.version,
            content_type: self.content_type,
            encrypted_message_key: self.encrypted_message_key,
            public_key: self.public_key,
            encrypted_data: self.encrypted_data,
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

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ActionCardContentInternal {
    #[serde(rename = "ti")]
    pub title: String,
    #[serde(rename = "r")]
    pub rows: Vec<ActionCardRow>,
    #[serde(rename = "cl")]
    pub confirm_label: String,
    #[serde(rename = "xl")]
    pub cancel_label: String,
    #[serde(rename = "ai")]
    pub action_id: String,
    // The owning directory app (set at post time). Distinct from the server-only routing fields below:
    // this IS hydrated to clients so a recipient binds card-surface resolution to the exact producing
    // app rather than the non-namespaced action_id. Absent on legacy cards.
    #[serde(rename = "aid", default, skip_serializing_if = "Option::is_none")]
    pub app_id: Option<AiAppId>,
    #[serde(rename = "arv", default, skip_serializing_if = "Option::is_none")]
    pub app_revision: Option<TimestampMillis>,
    // Set only after the chat canister consumes a UserIndex proposal proof that binds the directory
    // app coordinates before storing the card. It does not attest app authorship of rows/payload.
    #[serde(rename = "av", default, skip_serializing_if = "std::ops::Not::not")]
    pub app_verified: bool,
    // Full-card content attestation is deliberately distinct from directory-coordinate provenance.
    // It defaults false across upgrades and raw message ingress; only the trusted app-attestation
    // path may set it true after binding the exact canonical content hash. Browser-authored fields
    // cannot opt into trusted rendering.
    #[serde(rename = "acv", default, skip_serializing_if = "std::ops::Not::not")]
    pub app_content_verified: bool,
    // Server-only exact canonical content commitment. Never hydrated to clients; capabilities and
    // final-confirmation grants bind to it so neither a copied app id nor a different card can reuse
    // the attestation.
    #[serde(rename = "ach", default, skip_serializing_if = "Option::is_none")]
    pub app_content_hash: Option<[u8; 32]>,
    #[serde(rename = "d", default, skip_serializing_if = "Option::is_none")]
    pub disclosure: Option<String>,
    #[serde(rename = "s")]
    pub state: ActionCardState,
    #[serde(rename = "e", default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<TimestampMillis>,
    #[serde(rename = "rb", default, skip_serializing_if = "Option::is_none")]
    pub responded_by: Option<UserId>,
    #[serde(rename = "ra", default, skip_serializing_if = "Option::is_none")]
    pub responded_at: Option<TimestampMillis>,
    // Internal durable confirmation reservation. It is never hydrated to clients. Reserving before
    // the inter-canister await fixes the actor and payload for every retry. Because sibling calls
    // can reuse one lease, async handlers preserve it until exact completion or an explicitly
    // proven same-execution release.
    #[serde(rename = "crb", default, skip_serializing_if = "Option::is_none")]
    pub confirmation_reserved_by: Option<UserId>,
    #[serde(rename = "cra", default, skip_serializing_if = "Option::is_none")]
    pub confirmation_reserved_at: Option<TimestampMillis>,
    /// Monotonic durable attempt generation. It survives upgrades and lets the encrypted envelope
    /// identify which persisted lease produced a delivery without weakening card-level dedupe.
    #[serde(rename = "crg", default)]
    pub confirmation_lease_generation: u64,
    /// Exact payload digest locked to the current lease. An ambiguous outbound result may be
    /// retried only with these same bytes; a different edit can never overwrite a possibly-stored
    /// action for the same card.
    #[serde(rename = "crh", default, skip_serializing_if = "Option::is_none")]
    pub confirmation_payload_hash: Option<[u8; 32]>,
    /// Domain-separated digest of the one-use confirmation grant consumed for the current exact
    /// lease. It lets an ambiguous inbox delivery retry the same bearer without weakening UIX's
    /// one-use token semantics. Server-only and cleared whenever the lease ends.
    #[serde(rename = "cgh", default, skip_serializing_if = "Option::is_none")]
    pub confirmation_grant_hash: Option<[u8; 32]>,
    // Legacy sender-carried routing, stored only for wire compatibility and ignored by the current
    // authoritative confirmation path. Server-only: not hydrated to clients.
    #[serde(rename = "rpk", default, skip_serializing_if = "Option::is_none")]
    pub recipient_public_key: Option<String>,
    // Legacy sender-carried fan-out data; ignored by the current confirmation path.
    #[serde(rename = "rpks", default, skip_serializing_if = "Vec::is_empty")]
    pub recipient_public_keys: Vec<String>,
    #[serde(rename = "cp", default, skip_serializing_if = "Option::is_none")]
    pub confirm_payload: Option<ByteBuf>,
    // Legacy sender-carried inbox data; ignored by the current confirmation path.
    #[serde(rename = "ici", default, skip_serializing_if = "Option::is_none")]
    pub inbox_canister_id: Option<CanisterId>,
}

impl ActionCardContentInternal {
    pub fn mark_app_verified(&mut self, content_hash: [u8; 32]) {
        // Sender-carried routing fields are legacy wire compatibility only. Once provenance binds
        // the card to a directory app, retain no untrusted routing material in chat storage; confirm
        // resolves the exact current route and per-user key from UserIndex.
        self.recipient_public_key = None;
        self.recipient_public_keys.clear();
        self.inbox_canister_id = None;
        self.app_verified = true;
        self.app_content_verified = true;
        self.app_content_hash = Some(content_hash);
    }
    // Transition Pending -> Confirmed (idempotent). Returns true only on the transition, so callers
    // forward the payload exactly once. An expired card cannot be confirmed.
    pub fn confirm(&mut self, user_id: UserId, now: TimestampMillis) -> bool {
        if self.is_expired(now) {
            self.state = ActionCardState::Expired;
            return false;
        }
        if matches!(self.state, ActionCardState::Pending) && self.confirmation_reserved_by.is_none() {
            self.state = ActionCardState::Confirmed;
            self.responded_by = Some(user_id);
            self.responded_at = Some(now);
            true
        } else {
            false
        }
    }

    // Transition Pending -> Cancelled (idempotent). Returns true only on the transition.
    pub fn cancel(&mut self, user_id: UserId, now: TimestampMillis) -> bool {
        if matches!(self.state, ActionCardState::Pending) && self.confirmation_reserved_by.is_none() {
            self.state = ActionCardState::Cancelled;
            self.responded_by = Some(user_id);
            self.responded_at = Some(now);
            true
        } else {
            false
        }
    }

    pub(crate) fn is_expired(&self, now: TimestampMillis) -> bool {
        self.expires_at.is_some_and(|e| now > e)
    }

    /// Atomically reserves a pending card to one immutable confirmation attempt before delivery.
    ///
    /// Once present, a reservation never times out or changes generation: an outbound reply may
    /// have been lost after the inbox committed. Only an exact retry by the same actor with the same
    /// payload commitment is admitted. A handler may release it only when it can prove that its own
    /// atomic execution created the lease and no sibling request could already be in flight.
    pub fn reserve_confirmation(&mut self, user_id: UserId, payload_hash: [u8; 32], now: TimestampMillis) -> bool {
        if !matches!(self.state, ActionCardState::Pending) {
            return false;
        }
        if let Some(reserved_by) = self.confirmation_reserved_by {
            return reserved_by == user_id
                && self.confirmation_payload_hash == Some(payload_hash)
                && self.confirmation_reserved_at.is_some();
        }
        if self.is_expired(now) {
            return false;
        }
        let Some(generation) = self.confirmation_lease_generation.checked_add(1) else {
            return false;
        };
        self.confirmation_lease_generation = generation;
        self.confirmation_reserved_by = Some(user_id);
        self.confirmation_reserved_at = Some(now);
        self.confirmation_payload_hash = Some(payload_hash);
        self.confirmation_grant_hash = None;
        true
    }

    pub fn confirmation_grant_consumed_for_lease(
        &self,
        user_id: UserId,
        lease_generation: u64,
        payload_hash: [u8; 32],
        grant_hash: [u8; 32],
    ) -> bool {
        matches!(self.state, ActionCardState::Pending)
            && self.confirmation_reserved_by == Some(user_id)
            && self.confirmation_reserved_at.is_some()
            && self.confirmation_lease_generation == lease_generation
            && self.confirmation_payload_hash == Some(payload_hash)
            && self.confirmation_grant_hash == Some(grant_hash)
    }

    /// Records a successful one-use grant consumption only for the exact durable lease. The marker
    /// is idempotent for the same bearer and cannot be rebound: once an outbound deposit may have
    /// started, a different grant must never take over that ambiguous lease.
    pub fn mark_confirmation_grant_consumed_for_lease(
        &mut self,
        user_id: UserId,
        lease_generation: u64,
        payload_hash: [u8; 32],
        grant_hash: [u8; 32],
    ) -> bool {
        if !matches!(self.state, ActionCardState::Pending)
            || self.confirmation_reserved_by != Some(user_id)
            || self.confirmation_reserved_at.is_none()
            || self.confirmation_lease_generation != lease_generation
            || self.confirmation_payload_hash != Some(payload_hash)
        {
            return false;
        }
        match self.confirmation_grant_hash {
            None => {
                self.confirmation_grant_hash = Some(grant_hash);
                true
            }
            Some(existing) => existing == grant_hash,
        }
    }

    /// Commits only the lease holder's successful delivery.
    pub fn complete_confirmation(&mut self, user_id: UserId, now: TimestampMillis) -> bool {
        if self.confirmation_reserved_by != Some(user_id) || !matches!(self.state, ActionCardState::Pending) {
            return false;
        }
        // Expiry gates the reservation, not its completion. Once delivery succeeded, turning the card
        // Expired here would claim no action occurred and invite a retry even though the inbox stored it.
        let reserved_at = self.confirmation_reserved_at.unwrap_or(now);
        self.confirmation_reserved_by = None;
        self.confirmation_reserved_at = None;
        self.confirmation_grant_hash = None;
        self.state = ActionCardState::Confirmed;
        self.responded_by = Some(user_id);
        self.responded_at = Some(reserved_at);
        true
    }

    /// Commits only the exact durable lease that was authorized before an outbound delivery.
    /// This is used after a definite downstream Success, when re-running mutable chat/member
    /// authorization would be both too late and capable of stranding an already-delivered action.
    pub fn complete_confirmation_for_lease(
        &mut self,
        user_id: UserId,
        lease_generation: u64,
        payload_hash: [u8; 32],
        now: TimestampMillis,
    ) -> bool {
        if self.confirmation_reserved_by != Some(user_id)
            || self.confirmation_lease_generation != lease_generation
            || self.confirmation_payload_hash != Some(payload_hash)
            || !matches!(self.state, ActionCardState::Pending)
        {
            return false;
        }
        let reserved_at = self.confirmation_reserved_at.unwrap_or(now);
        self.confirmation_reserved_by = None;
        self.confirmation_reserved_at = None;
        self.confirmation_grant_hash = None;
        self.state = ActionCardState::Confirmed;
        self.responded_by = Some(user_id);
        self.responded_at = Some(reserved_at);
        true
    }

    /// Unscoped release retained for synchronous legacy callers. This is safe only in the same
    /// atomic execution that created the reservation; it must never be used after an await.
    pub fn abort_confirmation(&mut self, user_id: UserId) -> bool {
        if self.confirmation_reserved_by != Some(user_id) || !matches!(self.state, ActionCardState::Pending) {
            return false;
        }
        self.confirmation_reserved_by = None;
        self.confirmation_reserved_at = None;
        self.confirmation_payload_hash = None;
        self.confirmation_grant_hash = None;
        true
    }

    /// Releases only the exact lease generation and payload. This prevents erasing a newer lease,
    /// but it does not distinguish concurrent sibling requests sharing this exact lease; callers
    /// must additionally prove that no sibling can be in flight (in practice, do not call after an
    /// await).
    pub fn abort_confirmation_for_lease(&mut self, user_id: UserId, lease_generation: u64, payload_hash: [u8; 32]) -> bool {
        if self.confirmation_reserved_by != Some(user_id)
            || self.confirmation_lease_generation != lease_generation
            || self.confirmation_payload_hash != Some(payload_hash)
            || !matches!(self.state, ActionCardState::Pending)
        {
            return false;
        }
        self.confirmation_reserved_by = None;
        self.confirmation_reserved_at = None;
        self.confirmation_payload_hash = None;
        self.confirmation_grant_hash = None;
        true
    }

    /// All delivery recipients for this card: the legacy single key plus the fan-out list,
    /// deduped preserving order (legacy first). Empty when the card carries no routing.
    pub fn all_recipient_keys(&self) -> Vec<String> {
        let mut out: Vec<String> = Vec::new();
        for k in self.recipient_public_key.iter().chain(self.recipient_public_keys.iter()) {
            if !k.is_empty() && !out.contains(k) {
                out.push(k.clone());
            }
        }
        out
    }
}

impl From<ActionCardContentInitial> for ActionCardContentInternal {
    fn from(value: ActionCardContentInitial) -> Self {
        ActionCardContentInternal {
            title: value.title,
            rows: value.rows,
            confirm_label: value.confirm_label,
            cancel_label: value.cancel_label,
            action_id: value.action_id,
            app_id: value.app_id,
            app_revision: value.app_revision,
            app_verified: false,
            app_content_verified: false,
            app_content_hash: None,
            disclosure: value.disclosure,
            state: ActionCardState::Pending,
            expires_at: value.expires_at,
            responded_by: None,
            responded_at: None,
            confirmation_reserved_by: None,
            confirmation_reserved_at: None,
            confirmation_lease_generation: 0,
            confirmation_payload_hash: None,
            confirmation_grant_hash: None,
            recipient_public_key: value.recipient_public_key,
            recipient_public_keys: value.recipient_public_keys,
            confirm_payload: value.confirm_payload,
            inbox_canister_id: value.inbox_canister_id,
        }
    }
}

impl MessageContentInternalSubtype for ActionCardContentInternal {
    type ContentType = ActionCardContent;

    fn hydrate(self, _my_user_id: Option<UserId>) -> Self::ContentType {
        ActionCardContent {
            title: self.title,
            rows: self.rows,
            confirm_label: self.confirm_label,
            cancel_label: self.cancel_label,
            action_id: self.action_id,
            app_id: self.app_verified.then_some(self.app_id).flatten(),
            app_revision: self.app_verified.then_some(self.app_revision).flatten(),
            app_verified: self.app_verified,
            app_content_verified: self.app_content_verified,
            disclosure: self.disclosure,
            state: self.state,
            responded_by: self.responded_by,
            responded_at: self.responded_at,
            expires_at: self.expires_at,
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
            MessageContentInitial::Encrypted(e) => MessageContentInternal::Encrypted(e.into()),
            MessageContentInitial::Custom(c) => MessageContentInternal::Custom(c.into()),
            MessageContentInitial::ActionCard(a) => MessageContentInternal::ActionCard(a.into()),
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
            MessageContentInternal::ModerationReport(_) => MessageContentType::ModerationReport,
            MessageContentInternal::P2PSwap(_) => MessageContentType::P2PSwap,
            MessageContentInternal::VideoCall(_) => MessageContentType::VideoCall,
            MessageContentInternal::Encrypted(e) => e.content_type.clone().into(),
            MessageContentInternal::Custom(c) => MessageContentType::Custom(c.kind.clone()),
            MessageContentInternal::ActionCard(_) => MessageContentType::ActionCard,
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

#[cfg(test)]
mod action_card_security_tests {
    use super::*;
    use candid::Principal;

    fn user(byte: u8) -> UserId {
        Principal::from_slice(&[byte]).into()
    }

    fn initial_card() -> ActionCardContentInitial {
        ActionCardContentInitial {
            title: "Approve operation".to_string(),
            rows: vec![ActionCardRow {
                label: "Value".to_string(),
                value: "42".to_string(),
            }],
            confirm_label: "Confirm".to_string(),
            cancel_label: "Cancel".to_string(),
            action_id: "sample.action".to_string(),
            app_id: Some(7),
            app_revision: Some(11),
            app_provenance: Some(ByteBuf::from(vec![1; 32])),
            disclosure: None,
            expires_at: None,
            recipient_public_key: Some("test-key".to_string()),
            recipient_public_keys: Vec::new(),
            confirm_payload: Some(ByteBuf::from(br#"{"value":42}"#.to_vec())),
            inbox_canister_id: None,
        }
    }

    fn card() -> ActionCardContentInternal {
        initial_card().into()
    }

    #[test]
    fn confirmation_reservation_is_single_flight() {
        let mut card = card();
        assert!(card.reserve_confirmation(user(1), [1; 32], 10));
        assert!(!card.reserve_confirmation(user(2), [1; 32], 11));
        assert!(!card.confirm(user(2), 11));
        assert!(!card.cancel(user(2), 11));
        assert!(card.complete_confirmation(user(1), 12));
        assert!(matches!(card.state, ActionCardState::Confirmed));
    }

    #[test]
    fn failed_delivery_releases_reservation_for_retry() {
        let mut card = card();
        assert!(card.reserve_confirmation(user(1), [1; 32], 10));
        assert!(!card.abort_confirmation(user(2)));
        assert!(card.abort_confirmation(user(1)));
        assert!(card.reserve_confirmation(user(2), [1; 32], 11));
    }

    #[test]
    fn ambiguous_confirmation_is_retried_only_as_the_same_immutable_attempt() {
        let mut card = card();
        assert!(card.reserve_confirmation(user(1), [1; 32], 10));
        let generation = card.confirmation_lease_generation;
        assert!(card.reserve_confirmation(user(1), [1; 32], 11));
        assert!(!card.reserve_confirmation(user(2), [1; 32], 300_010));
        assert!(!card.reserve_confirmation(user(1), [2; 32], 300_011));
        assert!(card.reserve_confirmation(user(1), [1; 32], 300_011));
        assert_eq!(card.confirmation_lease_generation, generation);
        assert_eq!(card.confirmation_reserved_at, Some(10));
        assert!(card.complete_confirmation(user(1), 300_012));
        assert!(matches!(card.state, ActionCardState::Confirmed));
    }

    #[test]
    fn malformed_reservation_without_a_complete_commitment_fails_closed() {
        let mut card = card();
        card.confirmation_reserved_by = Some(user(1));
        card.confirmation_reserved_at = None;
        assert!(!card.reserve_confirmation(user(2), [1; 32], 20));
        assert!(!card.reserve_confirmation(user(1), [1; 32], 20));
        assert_eq!(card.confirmation_reserved_by, Some(user(1)));
        assert_eq!(card.confirmation_reserved_at, None);
    }

    #[test]
    fn expiry_after_reservation_does_not_undo_successful_delivery() {
        let mut card = card();
        card.expires_at = Some(10);
        assert!(card.reserve_confirmation(user(1), [1; 32], 10));
        assert!(card.complete_confirmation(user(1), 11));
        assert!(matches!(card.state, ActionCardState::Confirmed));
        assert_eq!(
            card.responded_at,
            Some(10),
            "the response time is the accepted reservation time"
        );
    }

    #[test]
    fn delivered_completion_is_bound_to_the_exact_generation_and_payload() {
        let mut card = card();
        let payload_hash = [7; 32];
        assert!(card.reserve_confirmation(user(1), payload_hash, 10));
        let generation = card.confirmation_lease_generation;
        assert!(!card.complete_confirmation_for_lease(user(1), generation + 1, payload_hash, 11));
        assert!(!card.complete_confirmation_for_lease(user(1), generation, [8; 32], 11));
        assert!(card.complete_confirmation_for_lease(user(1), generation, payload_hash, 11));
        assert!(matches!(card.state, ActionCardState::Confirmed));
    }

    #[test]
    fn consumed_grant_marker_is_durable_and_bound_to_the_exact_pending_lease() {
        let mut leased = card();
        let payload_hash = [7; 32];
        let grant_hash = [8; 32];
        assert!(leased.reserve_confirmation(user(1), payload_hash, 10));
        let generation = leased.confirmation_lease_generation;

        assert!(!leased.confirmation_grant_consumed_for_lease(user(1), generation, payload_hash, grant_hash));
        assert!(leased.mark_confirmation_grant_consumed_for_lease(user(1), generation, payload_hash, grant_hash));
        assert!(leased.mark_confirmation_grant_consumed_for_lease(user(1), generation, payload_hash, grant_hash));
        assert!(
            !leased.mark_confirmation_grant_consumed_for_lease(user(1), generation, payload_hash, [10; 32]),
            "an ambiguous lease must never be rebound to a different consumed grant"
        );
        assert!(leased.confirmation_grant_consumed_for_lease(user(1), generation, payload_hash, grant_hash));
        assert!(!leased.confirmation_grant_consumed_for_lease(user(2), generation, payload_hash, grant_hash));
        assert!(!leased.confirmation_grant_consumed_for_lease(user(1), generation + 1, payload_hash, grant_hash));
        assert!(!leased.confirmation_grant_consumed_for_lease(user(1), generation, [9; 32], grant_hash));
        assert!(!leased.confirmation_grant_consumed_for_lease(user(1), generation, payload_hash, [10; 32]));

        let encoded = msgpack::serialize_to_vec(&leased).unwrap();
        let mut restored: ActionCardContentInternal = msgpack::deserialize_then_unwrap(&encoded);
        assert!(restored.confirmation_grant_consumed_for_lease(user(1), generation, payload_hash, grant_hash));
        assert!(restored.reserve_confirmation(user(1), payload_hash, 300_011));
        assert!(restored.confirmation_grant_consumed_for_lease(user(1), generation, payload_hash, grant_hash));

        assert!(restored.abort_confirmation(user(1)));
        assert!(!restored.confirmation_grant_consumed_for_lease(user(1), generation, payload_hash, grant_hash));
        assert!(restored.reserve_confirmation(user(1), payload_hash, 300_012));
        assert_ne!(restored.confirmation_lease_generation, generation);
        assert!(!restored.confirmation_grant_consumed_for_lease(
            user(1),
            restored.confirmation_lease_generation,
            payload_hash,
            grant_hash,
        ));

        let mut completed = card();
        assert!(completed.reserve_confirmation(user(1), payload_hash, 20));
        let completed_generation = completed.confirmation_lease_generation;
        assert!(completed.mark_confirmation_grant_consumed_for_lease(user(1), completed_generation, payload_hash, grant_hash,));
        assert!(completed.complete_confirmation_for_lease(user(1), completed_generation, payload_hash, 21,));
        assert_eq!(completed.confirmation_grant_hash, None);
    }

    #[test]
    fn exact_abort_cannot_release_a_different_generation_or_payload() {
        let mut card = card();
        let payload_hash = [7; 32];
        assert!(card.reserve_confirmation(user(1), payload_hash, 10));
        let generation = card.confirmation_lease_generation;

        assert!(!card.abort_confirmation_for_lease(user(1), generation + 1, payload_hash));
        assert!(!card.abort_confirmation_for_lease(user(1), generation, [8; 32]));
        assert_eq!(card.confirmation_reserved_by, Some(user(1)));
        assert!(card.abort_confirmation_for_lease(user(1), generation, payload_hash));
        assert_eq!(card.confirmation_reserved_by, None);
    }

    #[test]
    fn current_card_state_round_trip_preserves_attestation_and_confirmation_lease() {
        let mut before = card();
        let content_hash = [6; 32];
        let payload_hash = [7; 32];
        before.mark_app_verified(content_hash);
        assert!(before.reserve_confirmation(user(1), payload_hash, 10));
        let generation = before.confirmation_lease_generation;

        let encoded = msgpack::serialize_to_vec(&before).unwrap();
        let mut after: ActionCardContentInternal = msgpack::deserialize_then_unwrap(&encoded);

        assert!(after.app_verified);
        assert!(after.app_content_verified);
        assert_eq!(after.app_content_hash, Some(content_hash));
        assert_eq!(after.confirmation_reserved_by, Some(user(1)));
        assert_eq!(after.confirmation_reserved_at, Some(10));
        assert_eq!(after.confirmation_lease_generation, generation);
        assert_eq!(after.confirmation_payload_hash, Some(payload_hash));
        assert!(after.reserve_confirmation(user(1), payload_hash, 300_011));
        assert_eq!(after.confirmation_lease_generation, generation);
        assert_eq!(after.confirmation_reserved_at, Some(10));
        assert!(after.complete_confirmation_for_lease(user(1), generation, payload_hash, 11));
        assert!(matches!(after.state, ActionCardState::Confirmed));
    }

    fn is_rejected(card: ActionCardContentInitial) -> bool {
        matches!(
            MessageContentInternal::validate_new_message(
                MessageContentInitial::ActionCard(card),
                false,
                UserType::User,
                false,
                10,
            ),
            ValidateNewMessageContentResult::Error(_)
        )
    }

    #[test]
    fn action_card_wire_fields_and_total_work_are_bounded() {
        assert!(!is_rejected(initial_card()));

        let mut card = initial_card();
        card.rows = (0..33)
            .map(|i| ActionCardRow {
                label: format!("Row {i}"),
                value: i.to_string(),
            })
            .collect();
        assert!(is_rejected(card));

        let mut card = initial_card();
        card.rows[0].value = "v".repeat(4_097);
        assert!(is_rejected(card));

        let mut card = initial_card();
        card.recipient_public_keys = (0..9).map(|i| format!("KEY-{i}")).collect();
        assert!(is_rejected(card));

        let mut card = initial_card();
        card.confirm_payload = Some(ByteBuf::from(vec![0; 16_385]));
        assert!(is_rejected(card));
    }

    #[test]
    fn every_app_provenance_tuple_is_validated_for_each_sender_kind() {
        for sender in [
            UserType::User,
            UserType::Bot,
            UserType::BotV2,
            UserType::OcControlledBot,
            UserType::Webhook,
        ] {
            for mask in 0..8 {
                let mut candidate = initial_card();
                candidate.app_id = (mask & 1 != 0).then_some(7);
                candidate.app_revision = (mask & 2 != 0).then_some(11);
                candidate.app_provenance = (mask & 4 != 0).then(|| ByteBuf::from(vec![1; types::AI_APP_CARD_TOKEN_BYTES]));

                let accepted = match mask {
                    0 => true,
                    7 => matches!(sender, UserType::User),
                    _ => false,
                };
                assert_eq!(
                    action_card_within_bounds(&candidate, sender, 10),
                    accepted,
                    "unexpected provenance authorization for tuple mask {mask} and sender {sender:?}"
                );
            }
        }
    }

    #[test]
    fn provenance_verification_discards_sender_carried_routing() {
        let mut card = card();
        card.recipient_public_key = Some("attacker-single".to_string());
        card.recipient_public_keys = vec!["attacker-one".to_string(), "attacker-two".to_string()];
        card.inbox_canister_id = Some(Principal::from_slice(&[99]));
        let payload = card.confirm_payload.clone();

        card.mark_app_verified([1; 32]);

        assert!(card.app_verified);
        assert_eq!(card.recipient_public_key, None);
        assert!(card.recipient_public_keys.is_empty());
        assert_eq!(card.inbox_canister_id, None);
        assert_eq!(card.confirm_payload, payload, "the opaque action payload remains frozen");
    }

    #[test]
    fn direct_human_app_card_enters_unverified_until_trusted_provenance_marks_it() {
        let mut content = match MessageContentInternal::validate_new_message(
            MessageContentInitial::ActionCard(initial_card()),
            true,
            UserType::User,
            false,
            10,
        ) {
            ValidateNewMessageContentResult::Success(content) => content,
            _ => panic!("a structurally valid direct app card must reach the trusted provenance verifier"),
        };

        let MessageContentInternal::ActionCard(raw) = &content else {
            unreachable!();
        };
        assert!(!raw.app_verified);
        assert!(!raw.app_content_verified);
        assert_eq!(raw.app_content_hash, None);

        let MessageContent::ActionCard(hydrated_raw) = content.clone().hydrate(None) else {
            unreachable!();
        };
        assert_eq!(
            hydrated_raw.app_id, None,
            "raw sender coordinates must not be exposed as trusted"
        );
        assert_eq!(
            hydrated_raw.app_revision, None,
            "raw sender coordinates must not be exposed as trusted"
        );
        assert!(!hydrated_raw.app_verified);
        assert!(!hydrated_raw.app_content_verified);

        let content_hash = [0xA5; 32];
        assert!(content.mark_ai_app_card_verified(content_hash));
        let MessageContentInternal::ActionCard(verified) = &content else {
            unreachable!();
        };
        assert!(verified.app_verified);
        assert!(verified.app_content_verified);
        assert_eq!(verified.app_content_hash, Some(content_hash));

        let MessageContent::ActionCard(hydrated_verified) = content.hydrate(None) else {
            unreachable!();
        };
        assert_eq!(hydrated_verified.app_id, Some(7));
        assert_eq!(hydrated_verified.app_revision, Some(11));
        assert!(hydrated_verified.app_verified);
        assert!(hydrated_verified.app_content_verified);
    }

    #[test]
    fn bot_or_webhook_cannot_supply_an_app_provenance_tuple_in_any_chat_kind() {
        for is_direct_chat in [true, false] {
            for sender_user_type in [UserType::Bot, UserType::BotV2, UserType::OcControlledBot, UserType::Webhook] {
                assert!(matches!(
                    MessageContentInternal::validate_new_message(
                        MessageContentInitial::ActionCard(initial_card()),
                        is_direct_chat,
                        sender_user_type,
                        false,
                        10,
                    ),
                    ValidateNewMessageContentResult::Error(_)
                ));
            }
        }
    }

    #[test]
    fn trusted_direct_card_mirror_round_trip_preserves_server_only_attestation() {
        let mut before = MessageContentInternal::ActionCard(card());
        let content_hash = [0x5A; 32];
        assert!(before.mark_ai_app_card_verified(content_hash));

        // SendMessageArgs transports MessageContentInternal between the two User canisters. Its
        // msgpack round-trip must retain the trust bits/hash; re-validating it as raw browser input
        // on the recipient would erase the only trustworthy provenance boundary.
        let encoded = msgpack::serialize_to_vec(&before).unwrap();
        let after: MessageContentInternal = msgpack::deserialize_then_unwrap(&encoded);
        let MessageContentInternal::ActionCard(after) = after else {
            unreachable!();
        };
        assert!(after.app_verified);
        assert!(after.app_content_verified);
        assert_eq!(after.app_content_hash, Some(content_hash));
        assert_eq!(after.app_id, Some(7));
        assert_eq!(after.app_revision, Some(11));
    }
}
