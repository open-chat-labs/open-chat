use crate::DeletedByInternal;
use ic_ledger_types::Tokens;
use ledger_utils::{create_pending_transaction, format_crypto_amount};
use search::Document;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use types::{
    is_default, is_empty_hashmap, is_empty_hashset, is_empty_slice, AudioContent, BlobReference, CanisterId,
    CompletedCryptoTransaction, CryptoContent, CryptoTransaction, CustomContent, FileContent, GiphyContent, GiphyImageVariant,
    ImageContent, MessageContent, MessageContentInitial, MessageIndex, MessageReminderContent, MessageReminderCreatedContent,
    MessageReport, P2PSwapContent, PendingCryptoTransaction, PollConfig, PollContent, PollVotes, PrizeContent,
    PrizeContentInitial, PrizeWinnerContent, Proposal, ProposalContent, RegisterVoteResult, ReportedMessage, TextContent,
    ThumbnailData, TimestampMillis, TimestampNanos, TotalVotes, UserId, VideoContent, VoteOperation,
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

    pub fn hydrate(&self, my_user_id: Option<UserId>) -> MessageContent {
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
            | MessageContentInternal::Custom(_) => None,
        }
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
            | MessageContentInternal::Custom(_) => {}
        }

        references
    }
}

impl TryFrom<MessageContentInitial> for MessageContentInternal {
    type Error = ();

    fn try_from(value: MessageContentInitial) -> Result<Self, ()> {
        match value {
            MessageContentInitial::Text(t) => Ok(MessageContentInternal::Text(t.into())),
            MessageContentInitial::Image(i) => Ok(MessageContentInternal::Image(i.into())),
            MessageContentInitial::Video(v) => Ok(MessageContentInternal::Video(v.into())),
            MessageContentInitial::Audio(a) => Ok(MessageContentInternal::Audio(a.into())),
            MessageContentInitial::File(f) => Ok(MessageContentInternal::File(f.into())),
            MessageContentInitial::Poll(p) => Ok(MessageContentInternal::Poll(p.into())),
            MessageContentInitial::Deleted(d) => Ok(MessageContentInternal::Deleted(d.into())),
            MessageContentInitial::Giphy(g) => Ok(MessageContentInternal::Giphy(g.into())),
            MessageContentInitial::GovernanceProposal(p) => Ok(MessageContentInternal::GovernanceProposal(p.into())),
            MessageContentInitial::MessageReminderCreated(r) => Ok(MessageContentInternal::MessageReminderCreated(r.into())),
            MessageContentInitial::MessageReminder(r) => Ok(MessageContentInternal::MessageReminder(r.into())),
            MessageContentInitial::Custom(c) => Ok(MessageContentInternal::Custom(c.into())),
            MessageContentInitial::Crypto(_) | MessageContentInitial::P2PSwap(_) | MessageContentInitial::Prize(_) => {
                // These should be created via `new_with_transfer`
                Err(())
            }
        }
    }
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
            MessageContentInternal::ReportedMessage(_) | MessageContentInternal::Deleted(_) => {}
        }

        document
    }
}

pub(crate) trait MessageContentInternalSubtype {
    type ContentType;

    fn hydrate(&self, my_user_id: Option<UserId>) -> Self::ContentType;
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TextContentInternal {
    #[serde(rename = "t", alias = "text")]
    pub text: String,
}

impl From<TextContent> for TextContentInternal {
    fn from(value: TextContent) -> Self {
        TextContentInternal { text: value.text }
    }
}

impl MessageContentInternalSubtype for TextContentInternal {
    type ContentType = TextContent;

    fn hydrate(&self, _my_user_id: Option<UserId>) -> Self::ContentType {
        TextContent { text: self.text.clone() }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ImageContentInternal {
    #[serde(rename = "w", alias = "width")]
    pub width: u32,
    #[serde(rename = "h", alias = "height")]
    pub height: u32,
    #[serde(rename = "t", alias = "thumbnail_data")]
    pub thumbnail_data: ThumbnailData,
    #[serde(rename = "c", alias = "caption", default, skip_serializing_if = "Option::is_none")]
    pub caption: Option<String>,
    #[serde(rename = "m", alias = "mime_type")]
    pub mime_type: String,
    #[serde(rename = "b", alias = "blob_reference", default, skip_serializing_if = "Option::is_none")]
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

    fn hydrate(&self, _my_user_id: Option<UserId>) -> Self::ContentType {
        ImageContent {
            width: self.width,
            height: self.height,
            thumbnail_data: self.thumbnail_data.clone(),
            caption: self.caption.clone(),
            mime_type: self.mime_type.clone(),
            blob_reference: self.blob_reference.clone(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct VideoContentInternal {
    #[serde(rename = "w", alias = "width")]
    pub width: u32,
    #[serde(rename = "h", alias = "height")]
    pub height: u32,
    #[serde(rename = "t", alias = "thumbnail_data")]
    pub thumbnail_data: ThumbnailData,
    #[serde(rename = "c", alias = "caption", default, skip_serializing_if = "Option::is_none")]
    pub caption: Option<String>,
    #[serde(rename = "m", alias = "mime_type")]
    pub mime_type: String,
    #[serde(
        rename = "i",
        alias = "image_blob_reference",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub image_blob_reference: Option<BlobReference>,
    #[serde(
        rename = "v",
        alias = "video_blob_reference",
        default,
        skip_serializing_if = "Option::is_none"
    )]
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

    fn hydrate(&self, _my_user_id: Option<UserId>) -> Self::ContentType {
        VideoContent {
            width: self.width,
            height: self.height,
            thumbnail_data: self.thumbnail_data.clone(),
            caption: self.caption.clone(),
            mime_type: self.mime_type.clone(),
            image_blob_reference: self.image_blob_reference.clone(),
            video_blob_reference: self.video_blob_reference.clone(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AudioContentInternal {
    #[serde(rename = "c", alias = "caption", default, skip_serializing_if = "Option::is_none")]
    pub caption: Option<String>,
    #[serde(rename = "m", alias = "mime_type")]
    pub mime_type: String,
    #[serde(rename = "b", alias = "blob_reference", default, skip_serializing_if = "Option::is_none")]
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

    fn hydrate(&self, _my_user_id: Option<UserId>) -> Self::ContentType {
        AudioContent {
            caption: self.caption.clone(),
            mime_type: self.mime_type.clone(),
            blob_reference: self.blob_reference.clone(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FileContentInternal {
    #[serde(rename = "n", alias = "name")]
    pub name: String,
    #[serde(rename = "c", alias = "caption", default, skip_serializing_if = "Option::is_none")]
    pub caption: Option<String>,
    #[serde(rename = "m", alias = "mime_type")]
    pub mime_type: String,
    #[serde(rename = "f", alias = "file_size")]
    pub file_size: u32,
    #[serde(rename = "b", alias = "blob_reference", default, skip_serializing_if = "Option::is_none")]
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

    fn hydrate(&self, _my_user_id: Option<UserId>) -> Self::ContentType {
        FileContent {
            name: self.name.clone(),
            caption: self.caption.clone(),
            mime_type: self.mime_type.clone(),
            file_size: self.file_size,
            blob_reference: self.blob_reference.clone(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PollContentInternal {
    #[serde(rename = "c", alias = "config")]
    pub config: PollConfig,
    #[serde(rename = "v", alias = "votes")]
    pub votes: HashMap<u32, Vec<UserId>>,
    #[serde(rename = "e", alias = "ended")]
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

    fn hydrate(&self, my_user_id: Option<UserId>) -> Self::ContentType {
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

impl From<CryptoContent> for CryptoContentInternal {
    fn from(value: CryptoContent) -> Self {
        if let CryptoTransaction::Completed(transfer) = value.transfer {
            CryptoContentInternal {
                recipient: value.recipient,
                transfer,
                caption: value.caption,
            }
        } else {
            panic!("Unable to convert from CryptoContent to CryptoContentInternal")
        }
    }
}

impl MessageContentInternalSubtype for CryptoContentInternal {
    type ContentType = CryptoContent;

    fn hydrate(&self, _my_user_id: Option<UserId>) -> Self::ContentType {
        CryptoContent {
            recipient: self.recipient,
            transfer: CryptoTransaction::Completed(self.transfer.clone()),
            caption: self.caption.clone(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GiphyContentInternal {
    #[serde(rename = "c", alias = "caption", default, skip_serializing_if = "Option::is_none")]
    pub caption: Option<String>,
    #[serde(rename = "t", alias = "title")]
    pub title: String,
    #[serde(rename = "d", alias = "desktop")]
    pub desktop: GiphyImageVariantInternal,
    #[serde(rename = "m", alias = "mobile")]
    pub mobile: GiphyImageVariantInternal,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GiphyImageVariantInternal {
    #[serde(rename = "w", alias = "width")]
    pub width: u32,
    #[serde(rename = "h", alias = "height")]
    pub height: u32,
    #[serde(rename = "u", alias = "url")]
    pub url: String,
    #[serde(rename = "m", alias = "mime_type")]
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

    fn hydrate(&self, _my_user_id: Option<UserId>) -> Self::ContentType {
        GiphyContent {
            caption: self.caption.clone(),
            title: self.title.clone(),
            desktop: GiphyImageVariant::from(&self.desktop),
            mobile: GiphyImageVariant::from(&self.mobile),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ProposalContentInternal {
    #[serde(rename = "g", alias = "governance_canister_id")]
    pub governance_canister_id: CanisterId,
    #[serde(rename = "p", alias = "proposal")]
    pub proposal: Proposal,
    #[serde(rename = "v", alias = "votes", default, skip_serializing_if = "is_empty_hashmap")]
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

    fn hydrate(&self, my_user_id: Option<UserId>) -> Self::ContentType {
        ProposalContent {
            governance_canister_id: self.governance_canister_id,
            proposal: self.proposal.clone(),
            my_vote: my_user_id.and_then(|u| self.votes.get(&u)).copied(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PrizeContentInternal {
    #[serde(rename = "p", default, skip_serializing_if = "is_empty_slice")]
    pub prizes_remaining: Vec<Tokens>,
    #[serde(rename = "r", default, skip_serializing_if = "is_empty_hashset")]
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
}

impl PrizeContentInternal {
    pub fn new(content: PrizeContentInitial, transaction: CompletedCryptoTransaction) -> PrizeContentInternal {
        PrizeContentInternal {
            prizes_remaining: content.prizes,
            reservations: HashSet::new(),
            winners: HashSet::new(),
            transaction,
            end_date: content.end_date,
            caption: content.caption,
            diamond_only: content.diamond_only,
        }
    }

    pub fn prize_refund(&self, sender: UserId, memo: &[u8], now_nanos: TimestampNanos) -> Option<PendingCryptoTransaction> {
        let fee = self.transaction.fee();
        let unclaimed = self.prizes_remaining.iter().map(|t| (t.e8s() as u128) + fee).sum::<u128>();
        if unclaimed > 0 {
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

    fn hydrate(&self, _my_user_id: Option<UserId>) -> Self::ContentType {
        PrizeContent {
            prizes_remaining: self.prizes_remaining.len() as u32,
            prizes_pending: self.reservations.len() as u32,
            winners: self.winners.iter().copied().collect(),
            token: self.transaction.token(),
            end_date: self.end_date,
            caption: self.caption.clone(),
            diamond_only: self.diamond_only,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PrizeWinnerContentInternal {
    #[serde(rename = "w", alias = "winner")]
    pub winner: UserId,
    #[serde(rename = "t", alias = "transaction")]
    pub transaction: CompletedCryptoTransaction,
    #[serde(rename = "m", alias = "prize_message")]
    pub prize_message: MessageIndex,
}

impl From<PrizeWinnerContent> for PrizeWinnerContentInternal {
    fn from(value: PrizeWinnerContent) -> Self {
        PrizeWinnerContentInternal {
            winner: value.winner,
            transaction: value.transaction,
            prize_message: value.prize_message,
        }
    }
}

impl MessageContentInternalSubtype for PrizeWinnerContentInternal {
    type ContentType = PrizeWinnerContent;

    fn hydrate(&self, _my_user_id: Option<UserId>) -> Self::ContentType {
        PrizeWinnerContent {
            winner: self.winner,
            transaction: self.transaction.clone(),
            prize_message: self.prize_message,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MessageReminderCreatedContentInternal {
    #[serde(rename = "i", alias = "reminder_id")]
    pub reminder_id: u64,
    #[serde(rename = "r", alias = "remind_at")]
    pub remind_at: TimestampMillis,
    #[serde(rename = "n", alias = "notes", default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(rename = "h", alias = "hidden", default, skip_serializing_if = "is_default")]
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

    fn hydrate(&self, _my_user_id: Option<UserId>) -> Self::ContentType {
        MessageReminderCreatedContent {
            reminder_id: self.reminder_id,
            remind_at: self.remind_at,
            notes: self.notes.clone(),
            hidden: self.hidden,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MessageReminderContentInternal {
    #[serde(rename = "i", alias = "reminder_id")]
    pub reminder_id: u64,
    #[serde(rename = "n", alias = "notes", default, skip_serializing_if = "Option::is_none")]
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

    fn hydrate(&self, _my_user_id: Option<UserId>) -> Self::ContentType {
        MessageReminderContent {
            reminder_id: self.reminder_id,
            notes: self.notes.clone(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ReportedMessageInternal {
    #[serde(rename = "r", alias = "reports")]
    pub reports: Vec<MessageReport>,
}

impl From<ReportedMessage> for ReportedMessageInternal {
    fn from(value: ReportedMessage) -> Self {
        ReportedMessageInternal { reports: value.reports }
    }
}

impl MessageContentInternalSubtype for ReportedMessageInternal {
    type ContentType = ReportedMessage;

    fn hydrate(&self, _my_user_id: Option<UserId>) -> Self::ContentType {
        ReportedMessage {
            reports: self.reports.iter().take(10).cloned().collect(),
            count: self.reports.len() as u32,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CustomContentInternal {
    #[serde(rename = "k", alias = "kind")]
    pub kind: String,
    #[serde(rename = "d", alias = "data", with = "serde_bytes")]
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

    fn hydrate(&self, _my_user_id: Option<UserId>) -> Self::ContentType {
        CustomContent {
            kind: self.kind.clone(),
            data: self.data.clone(),
        }
    }
}
