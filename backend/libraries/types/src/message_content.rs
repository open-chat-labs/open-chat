use crate::polls::{InvalidPollReason, PollConfig, PollVotes};
use crate::{
    CanisterId, CryptoTransaction, Cryptocurrency, ProposalContent, ProposalContentInternal, TimestampMillis, TotalVotes,
    UserId, VoteOperation,
};
use candid::CandidType;
use ic_ledger_types::Tokens;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt::{Debug, Formatter};

pub const MAX_TEXT_LENGTH: u32 = 5_000;
pub const MAX_TEXT_LENGTH_USIZE: usize = MAX_TEXT_LENGTH as usize;

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
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum MessageContentInternal {
    Text(TextContent),
    Image(ImageContent),
    Video(VideoContent),
    Audio(AudioContent),
    File(FileContent),
    Poll(PollContentInternal),
    Crypto(CryptoContent),
    Deleted(DeletedBy),
    Giphy(GiphyContent),
    GovernanceProposal(ProposalContentInternal),
    Prize(PrizeContentInternal),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ContentValidationError {
    Empty,
    TextTooLong(u32),
    InvalidPoll(InvalidPollReason),
    TransferCannotBeZero,
    TransferLimitExceeded(u128),
    InvalidTypeForForwarding,
    PrizeEndDateInThePast,
}

impl MessageContentInitial {
    // Determines if the content is valid for a new message, this should not be called on existing
    // messages
    pub fn validate_for_new_message(
        &self,
        is_direct_chat: bool,
        forwarding: bool,
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
                } else if c.transfer.exceeds_transfer_limit() {
                    return Err(ContentValidationError::TransferLimitExceeded(
                        c.transfer.token().transfer_limit(),
                    ));
                }
            }
            MessageContentInitial::Prize(p) => {
                if p.end_date <= now {
                    return Err(ContentValidationError::PrizeEndDateInThePast);
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
            | MessageContentInitial::GovernanceProposal(_) => false,
        };

        if is_empty {
            Err(ContentValidationError::Empty)
        // Allow GovernanceProposal messages to exceed the max length since they are collapsed on the UI
        // TODO only allow GovernanceProposal messages which are sent by the proposals_bot
        } else if self.text_length() > MAX_TEXT_LENGTH_USIZE && !matches!(self, MessageContentInitial::GovernanceProposal(_)) {
            Err(ContentValidationError::TextTooLong(MAX_TEXT_LENGTH))
        } else {
            Ok(())
        }
    }

    // This must only be called on the content of new messages, this is because for polls it will
    // set the votes to empty
    pub fn new_content_into_internal(self) -> MessageContentInternal {
        match self {
            MessageContentInitial::Text(t) => MessageContentInternal::Text(t),
            MessageContentInitial::Image(i) => MessageContentInternal::Image(i),
            MessageContentInitial::Video(v) => MessageContentInternal::Video(v),
            MessageContentInitial::Audio(a) => MessageContentInternal::Audio(a),
            MessageContentInitial::File(f) => MessageContentInternal::File(f),
            MessageContentInitial::Poll(p) => MessageContentInternal::Poll(PollContentInternal {
                config: p.config,
                votes: HashMap::new(),
                ended: false,
            }),
            MessageContentInitial::Crypto(c) => MessageContentInternal::Crypto(c),
            MessageContentInitial::Deleted(d) => MessageContentInternal::Deleted(d),
            MessageContentInitial::Giphy(g) => MessageContentInternal::Giphy(g),
            MessageContentInitial::GovernanceProposal(p) => {
                MessageContentInternal::GovernanceProposal(ProposalContentInternal {
                    governance_canister_id: p.governance_canister_id,
                    proposal: p.proposal,
                    votes: HashMap::new(),
                })
            }
            MessageContentInitial::Prize(p) => MessageContentInternal::Prize(PrizeContentInternal {
                prizes: p.prizes,
                winners: Vec::new(),
                token: p.token,
                end_date: p.end_date,
                caption: p.caption,
            }),
        }
    }

    fn text_length(&self) -> usize {
        match self {
            MessageContentInitial::Text(t) => t.text.len(),
            MessageContentInitial::Image(i) => i.caption.as_ref().map_or(0, |t| t.len()),
            MessageContentInitial::Video(v) => v.caption.as_ref().map_or(0, |t| t.len()),
            MessageContentInitial::Audio(a) => a.caption.as_ref().map_or(0, |t| t.len()),
            MessageContentInitial::File(f) => f.caption.as_ref().map_or(0, |t| t.len()),
            MessageContentInitial::Poll(p) => p.config.text.as_ref().map_or(0, |t| t.len()),
            MessageContentInitial::Crypto(c) => c.caption.as_ref().map_or(0, |t| t.len()),
            MessageContentInitial::Deleted(_) => 0,
            MessageContentInitial::Giphy(g) => g.caption.as_ref().map_or(0, |t| t.len()),
            MessageContentInitial::GovernanceProposal(p) => p.proposal.summary().len(),
            MessageContentInitial::Prize(p) => p.caption.as_ref().map_or(0, |t| t.len()),
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
                prizes: c.prizes.len() as u32,
                winners: Vec::new(),
                token: c.token,
                end_date: c.end_date,
                caption: c.caption,
            }),
        }
    }
}

impl MessageContentInternal {
    pub fn hydrate(&self, my_user_id: Option<UserId>) -> MessageContent {
        match self {
            MessageContentInternal::Text(t) => MessageContent::Text(t.clone()),
            MessageContentInternal::Image(i) => MessageContent::Image(i.clone()),
            MessageContentInternal::Video(v) => MessageContent::Video(v.clone()),
            MessageContentInternal::Audio(a) => MessageContent::Audio(a.clone()),
            MessageContentInternal::File(f) => MessageContent::File(f.clone()),
            MessageContentInternal::Poll(p) => MessageContent::Poll(p.hydrate(my_user_id)),
            MessageContentInternal::Crypto(c) => MessageContent::Crypto(c.clone()),
            MessageContentInternal::Deleted(d) => MessageContent::Deleted(d.clone()),
            MessageContentInternal::Giphy(g) => MessageContent::Giphy(g.clone()),
            MessageContentInternal::GovernanceProposal(p) => MessageContent::GovernanceProposal(ProposalContent {
                governance_canister_id: p.governance_canister_id,
                proposal: p.proposal.clone(),
                my_vote: my_user_id.and_then(|u| p.votes.get(&u)).copied(),
            }),
            MessageContentInternal::Prize(p) => MessageContent::Prize(PrizeContent {
                prizes: p.prizes.len() as u32,
                winners: p.winners.clone(),
                token: p.token,
                end_date: p.end_date,
                caption: p.caption.clone(),
            }),
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
            | MessageContentInternal::Prize(_) => {}
        }

        references
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
    pub token: Cryptocurrency,
    pub end_date: TimestampMillis,
    pub caption: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PrizeContentInternal {
    pub prizes: Vec<Tokens>,
    pub winners: Vec<UserId>,
    pub token: Cryptocurrency,
    pub end_date: TimestampMillis,
    pub caption: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PrizeContent {
    pub prizes: u32,
    pub winners: Vec<UserId>,
    pub token: Cryptocurrency,
    pub end_date: TimestampMillis,
    pub caption: Option<String>,
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

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct ThumbnailData(String);

impl Debug for ThumbnailData {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ThumbnailData").field("byte_length", &self.0.len()).finish()
    }
}
