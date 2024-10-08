use crate::DeletedByInternal;
use ledger_utils::{create_pending_transaction, format_crypto_amount};
use search::Document;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use types::{
    is_default, AudioContent, BlobReference, CallParticipant, CanisterId, CompletedCryptoTransaction,
    ContentWithCaptionEventPayload, CryptoContent, CryptoContentEventPayload, CryptoTransaction, CustomContent, FileContent,
    FileContentEventPayload, GiphyContent, GiphyImageVariant, GovernanceProposalContentEventPayload, ImageContent,
    ImageOrVideoContentEventPayload, MessageContent, MessageContentEventPayload, MessageContentInitial, MessageContentType,
    MessageIndex, MessageReminderContent, MessageReminderContentEventPayload, MessageReminderCreatedContent, MessageReport,
    P2PSwapContent, P2PSwapContentEventPayload, PendingCryptoTransaction, PollConfig, PollContent, PollContentEventPayload,
    PollVotes, PrizeContent, PrizeContentEventPayload, PrizeContentInitial, PrizeWinnerContent, PrizeWinnerContentEventPayload,
    Proposal, ProposalContent, RegisterVoteResult, ReportedMessage, ReportedMessageContentEventPayload, TextContent,
    TextContentEventPayload, ThumbnailData, TimestampMillis, TimestampNanos, TotalVotes, UserId, VideoCallContent,
    VideoCallPresence, VideoCallType, VideoContent, VoteOperation,
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
    P2PSwap(P2PSwapContent),
    #[serde(rename = "vc")]
    VideoCall(VideoCallContentInternal),
    #[serde(rename = "cu")]
    Custom(CustomContentInternal),
}

impl MessageContentInternal {
    pub fn new_with_transfer(
        content: MessageContentInitial,
        transfer: CompletedCryptoTransaction,
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
                MessageContentInternal::P2PSwap(P2PSwapContent::new(p2p_swap_id.unwrap(), c, transfer, now))
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
            MessageContentInternal::P2PSwap(p) => MessageContent::P2PSwap(p.clone()),
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
                    references.push(br);
                }
            }
            MessageContentInternal::Video(v) => {
                if let Some(br) = v.video_blob_reference.clone() {
                    references.push(br);
                }
                if let Some(br) = v.image_blob_reference.clone() {
                    references.push(br);
                }
            }
            MessageContentInternal::Audio(a) => {
                if let Some(br) = a.blob_reference.clone() {
                    references.push(br)
                }
            }
            MessageContentInternal::File(f) => {
                if let Some(br) = f.blob_reference.clone() {
                    references.push(br);
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
            }),
            MessageContentInternal::PrizeWinner(c) => MessageContentEventPayload::PrizeWinner(PrizeWinnerContentEventPayload {
                token: c.transaction.token().token_symbol().to_string(),
                amount: c.transaction.units(),
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
                token0: c.token0.token.token_symbol().to_string(),
                token0_amount: c.token0_amount,
                token1: c.token1.token.token_symbol().to_string(),
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

fn option_string_length(value: &Option<String>) -> u32 {
    value.as_ref().map(|c| c.len() as u32).unwrap_or_default()
}

impl From<&MessageContentInternal> for Document {
    fn from(message_content: &MessageContentInternal) -> Self {
        let mut document = Document::default();

        fn try_add_caption(document: &mut Document, caption_option: Option<&String>) {
            if let Some(caption) = caption_option {
                document.add_field(caption.to_owned(), 1.0, false);
            }
        }

        fn try_add_caption_and_mime_type(document: &mut Document, caption_option: Option<&String>, mime_type: &str) {
            document.add_field(mime_type.to_owned(), 1.0, false);
            try_add_caption(document, caption_option);
        }

        match message_content {
            MessageContentInternal::Text(c) => {
                document.add_field(c.text.clone(), 1.0, false);
            }
            MessageContentInternal::Crypto(c) => {
                let token = c.transfer.token();
                document.add_field(token.token_symbol().to_string(), 1.0, false);

                let amount = c.transfer.units();
                // This is only used for string searching so it's better to default to 8 than to trap
                let decimals = c.transfer.token().decimals().unwrap_or(8);
                let amount_string = format_crypto_amount(amount, decimals);
                document.add_field(amount_string, 1.0, false);

                try_add_caption(&mut document, c.caption.as_ref())
            }
            MessageContentInternal::Image(c) => try_add_caption_and_mime_type(&mut document, c.caption.as_ref(), &c.mime_type),
            MessageContentInternal::Video(c) => try_add_caption_and_mime_type(&mut document, c.caption.as_ref(), &c.mime_type),
            MessageContentInternal::Audio(c) => try_add_caption_and_mime_type(&mut document, c.caption.as_ref(), &c.mime_type),
            MessageContentInternal::File(c) => try_add_caption_and_mime_type(&mut document, c.caption.as_ref(), &c.mime_type),
            MessageContentInternal::Giphy(c) => try_add_caption(&mut document, c.caption.as_ref()),
            MessageContentInternal::Poll(p) => {
                document.add_field("poll".to_string(), 1.0, false);
                if let Some(text) = p.config.text.clone() {
                    document.add_field(text, 1.0, false);
                }
            }
            MessageContentInternal::GovernanceProposal(p) => {
                document.add_field(p.proposal.title().to_string(), 1.0, false);
                document.add_field(p.proposal.summary().to_string(), 1.0, false);
            }
            MessageContentInternal::Prize(c) => {
                document.add_field(c.transaction.token().token_symbol().to_string(), 1.0, false);
                try_add_caption(&mut document, c.caption.as_ref())
            }
            MessageContentInternal::PrizeWinner(c) => {
                document.add_field(c.transaction.token().token_symbol().to_string(), 1.0, false);
            }
            MessageContentInternal::MessageReminderCreated(r) => try_add_caption(&mut document, r.notes.as_ref()),
            MessageContentInternal::MessageReminder(r) => try_add_caption(&mut document, r.notes.as_ref()),
            MessageContentInternal::P2PSwap(p) => {
                document.add_field("swap".to_string(), 1.0, false);
                document.add_field(p.token0.token.token_symbol().to_string(), 1.0, false);
                document.add_field(p.token1.token.token_symbol().to_string(), 1.0, false);
                try_add_caption(&mut document, p.caption.as_ref())
            }
            MessageContentInternal::Custom(c) => {
                document.add_field(c.kind.clone(), 1.0, false);
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
    pub blob_reference: Option<BlobReference>,
}

impl From<ImageContent> for ImageContentInternal {
    fn from(value: ImageContent) -> Self {
        ImageContentInternal {
            width: value.width,
            height: value.height,
            thumbnail_data: value.thumbnail_data,
            caption: value.caption,
            mime_type: value.mime_type,
            blob_reference: value.blob_reference,
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
            blob_reference: self.blob_reference,
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
    pub image_blob_reference: Option<BlobReference>,
    #[serde(rename = "v", default, skip_serializing_if = "Option::is_none")]
    pub video_blob_reference: Option<BlobReference>,
}

impl From<VideoContent> for VideoContentInternal {
    fn from(value: VideoContent) -> Self {
        VideoContentInternal {
            width: value.width,
            height: value.height,
            thumbnail_data: value.thumbnail_data,
            caption: value.caption,
            mime_type: value.mime_type,
            image_blob_reference: value.image_blob_reference,
            video_blob_reference: value.video_blob_reference,
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
            image_blob_reference: self.image_blob_reference,
            video_blob_reference: self.video_blob_reference,
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
    pub blob_reference: Option<BlobReference>,
}

impl From<AudioContent> for AudioContentInternal {
    fn from(value: AudioContent) -> Self {
        AudioContentInternal {
            caption: value.caption,
            mime_type: value.mime_type,
            blob_reference: value.blob_reference,
        }
    }
}

impl MessageContentInternalSubtype for AudioContentInternal {
    type ContentType = AudioContent;

    fn hydrate(self, _my_user_id: Option<UserId>) -> Self::ContentType {
        AudioContent {
            caption: self.caption,
            mime_type: self.mime_type,
            blob_reference: self.blob_reference,
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
    pub blob_reference: Option<BlobReference>,
}

impl From<FileContent> for FileContentInternal {
    fn from(value: FileContent) -> Self {
        FileContentInternal {
            name: value.name,
            caption: value.caption,
            mime_type: value.mime_type,
            file_size: value.file_size,
            blob_reference: value.blob_reference,
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
            blob_reference: self.blob_reference,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PollContentInternal {
    #[serde(rename = "c")]
    pub config: PollConfig,
    #[serde(rename = "v")]
    pub votes: HashMap<u32, Vec<UserId>>,
    #[serde(rename = "e")]
    pub ended: bool,
}

impl From<PollContent> for PollContentInternal {
    fn from(value: PollContent) -> Self {
        PollContentInternal {
            config: value.config,
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
            config: self.config,
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
pub struct CryptoContentInternal {
    #[serde(rename = "r")]
    pub recipient: UserId,
    #[serde(rename = "t")]
    pub transfer: CompletedCryptoTransaction,
    #[serde(rename = "c", default, skip_serializing_if = "Option::is_none")]
    pub caption: Option<String>,
}

impl MessageContentInternalSubtype for CryptoContentInternal {
    type ContentType = CryptoContent;

    fn hydrate(self, _my_user_id: Option<UserId>) -> Self::ContentType {
        CryptoContent {
            recipient: self.recipient,
            transfer: CryptoTransaction::Completed(self.transfer),
            caption: self.caption,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GiphyContentInternal {
    #[serde(rename = "c", default, skip_serializing_if = "Option::is_none")]
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
    pub transaction: CompletedCryptoTransaction,
    #[serde(rename = "e")]
    pub end_date: TimestampMillis,
    #[serde(rename = "c", default, skip_serializing_if = "Option::is_none")]
    pub caption: Option<String>,
    #[serde(rename = "d", default, skip_serializing_if = "is_default")]
    pub diamond_only: bool,
    #[serde(rename = "f", default, skip_serializing_if = "is_default")]
    pub refund_started: bool,
    #[serde(rename = "l", default, skip_serializing_if = "is_default")]
    pub ledger_error: bool,
}

impl PrizeContentInternal {
    pub fn new(content: PrizeContentInitial, transaction: CompletedCryptoTransaction) -> PrizeContentInternal {
        PrizeContentInternal {
            prizes_remaining: content.prizes_v2,
            reservations: HashSet::new(),
            winners: HashSet::new(),
            transaction,
            end_date: content.end_date,
            caption: content.caption,
            diamond_only: content.diamond_only,
            refund_started: false,
            ledger_error: false,
        }
    }

    pub fn prize_refund(&mut self, sender: UserId, memo: &[u8], now_nanos: TimestampNanos) -> Option<PendingCryptoTransaction> {
        if self.refund_started {
            return None;
        }
        let fee = self.transaction.fee();
        let unclaimed = self.prizes_remaining.iter().map(|p| p + fee).sum::<u128>();
        if unclaimed > 0 {
            self.refund_started = true;
            Some(create_pending_transaction(
                self.transaction.token(),
                self.transaction.ledger_canister_id(),
                unclaimed - fee,
                fee,
                sender,
                Some(memo),
                now_nanos,
            ))
        } else {
            None
        }
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
            token: self.transaction.token(),
            end_date: self.end_date,
            caption: self.caption,
            diamond_only: self.diamond_only,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(from = "PrizeWinnerContentInternalPrevious")]
pub struct PrizeWinnerContentInternal {
    #[serde(rename = "w")]
    pub winner: UserId,
    #[serde(rename = "l")]
    pub ledger: CanisterId,
    #[serde(rename = "a")]
    pub amount: u128,
    #[serde(rename = "f")]
    pub fee: u128,
    #[serde(rename = "i")]
    pub block_index: u64,
    #[serde(rename = "t")]
    pub transaction: CompletedCryptoTransaction,
    #[serde(rename = "m")]
    pub prize_message: MessageIndex,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PrizeWinnerContentInternalPrevious {
    #[serde(rename = "w")]
    pub winner: UserId,
    #[serde(rename = "t")]
    pub transaction: CompletedCryptoTransaction,
    #[serde(rename = "m")]
    pub prize_message: MessageIndex,
}

impl From<PrizeWinnerContentInternalPrevious> for PrizeWinnerContentInternal {
    fn from(value: PrizeWinnerContentInternalPrevious) -> Self {
        PrizeWinnerContentInternal {
            winner: value.winner,
            ledger: value.transaction.ledger_canister_id(),
            amount: value.transaction.units(),
            fee: value.transaction.fee(),
            block_index: value.transaction.index(),
            transaction: value.transaction,
            prize_message: value.prize_message,
        }
    }
}

impl MessageContentInternalSubtype for PrizeWinnerContentInternal {
    type ContentType = PrizeWinnerContent;

    fn hydrate(self, _my_user_id: Option<UserId>) -> Self::ContentType {
        PrizeWinnerContent {
            winner: self.winner,
            transaction: self.transaction,
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
            MessageContentInitial::Crypto(c) => {
                if let CryptoTransaction::Completed(transfer) = c.transfer {
                    MessageContentInternal::Crypto(CryptoContentInternal {
                        recipient: c.recipient,
                        transfer,
                        caption: c.caption,
                    })
                } else {
                    panic!("Crypto transfer must be completed")
                }
            }
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
