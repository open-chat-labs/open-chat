use crate::polls::{InvalidPollReason, PollConfig, PollVotes};
use crate::ContentValidationError::*;
use crate::RegisterVoteResult::SuccessNoChange;
use crate::{
    CanisterId, CompletedCryptoTransaction, CryptoAccountFull, CryptoTransaction, CryptoTransactionInternal, ProposalContent,
    TimestampMillis, TotalVotes, UserId, VoteOperation,
};
use candid::CandidType;
use ic_ledger_types::Tokens;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt::{Debug, Formatter};

const E8S_PER_TOKEN: u64 = 100_000_000;
pub const MAX_TEXT_LENGTH: u32 = 5_000;
pub const MAX_TEXT_LENGTH_USIZE: usize = MAX_TEXT_LENGTH as usize;
pub const ICP_TRANSFER_LIMIT: Tokens = Tokens::from_e8s(10 * E8S_PER_TOKEN);

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum MessageContent {
    Text(TextContent),
    Image(ImageContent),
    Video(VideoContent),
    Audio(AudioContent),
    File(FileContent),
    Poll(PollContent),
    Cryptocurrency(CryptocurrencyContent),
    Deleted(DeletedBy),
    Giphy(GiphyContent),
    GovernanceProposal(ProposalContent),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum MessageContentInternal {
    Text(TextContent),
    Image(ImageContent),
    Video(VideoContent),
    Audio(AudioContent),
    File(FileContent),
    Poll(PollContentInternal),
    Cryptocurrency(CryptocurrencyContentInternal),
    Deleted(DeletedBy),
    Giphy(GiphyContent),
    GovernanceProposal(ProposalContent),
}

pub enum ContentValidationError {
    Empty,
    TextTooLong(u32),
    InvalidPoll(InvalidPollReason),
    TransferCannotBeZero,
    TransferLimitExceeded(u64),
    InvalidTypeForForwarding,
}

impl MessageContent {
    // Determines if the content is valid for a new message, this should not be called on existing
    // messages
    pub fn validate_for_new_message(&self, forwarding: bool, now: TimestampMillis) -> Result<(), ContentValidationError> {
        if forwarding {
            match self {
                MessageContent::Poll(_) | MessageContent::Cryptocurrency(_) | MessageContent::Deleted(_) => {
                    return Err(InvalidTypeForForwarding);
                }
                _ => {}
            };
        }

        match self {
            MessageContent::Poll(p) => {
                if let Err(reason) = p.config.validate(now) {
                    return Err(InvalidPoll(reason));
                }
            }
            MessageContent::Cryptocurrency(c) => {
                let amount = c.transfer.amount();
                if amount == Tokens::ZERO {
                    return Err(TransferCannotBeZero);
                }
                if amount > ICP_TRANSFER_LIMIT {
                    return Err(TransferLimitExceeded(ICP_TRANSFER_LIMIT.e8s()));
                }
            }
            _ => {}
        };

        let is_empty = match self {
            MessageContent::Text(t) => t.text.is_empty(),
            MessageContent::Image(i) => i.blob_reference.is_none(),
            MessageContent::Video(v) => v.video_blob_reference.is_none(),
            MessageContent::Audio(a) => a.blob_reference.is_none(),
            MessageContent::File(f) => f.blob_reference.is_none(),
            MessageContent::Poll(p) => p.config.options.is_empty(),
            MessageContent::Cryptocurrency(c) => c.transfer.amount() == Tokens::ZERO,
            MessageContent::Deleted(_) => true,
            MessageContent::Giphy(_) => false,
            MessageContent::GovernanceProposal(_) => false,
        };

        if is_empty {
            Err(Empty)
        } else if self.text_length() > MAX_TEXT_LENGTH_USIZE {
            Err(TextTooLong(MAX_TEXT_LENGTH))
        } else {
            Ok(())
        }
    }

    // This must only be called on the content of new messages, this is because for polls it will
    // set the votes to empty
    pub fn new_content_into_internal(self) -> MessageContentInternal {
        match self {
            MessageContent::Text(t) => MessageContentInternal::Text(t),
            MessageContent::Image(i) => MessageContentInternal::Image(i),
            MessageContent::Video(v) => MessageContentInternal::Video(v),
            MessageContent::Audio(a) => MessageContentInternal::Audio(a),
            MessageContent::File(f) => MessageContentInternal::File(f),
            MessageContent::Poll(p) => MessageContentInternal::Poll(PollContentInternal {
                config: p.config,
                votes: HashMap::new(),
                ended: false,
            }),
            MessageContent::Cryptocurrency(c) => MessageContentInternal::Cryptocurrency(c.into()),
            MessageContent::Deleted(d) => MessageContentInternal::Deleted(d),
            MessageContent::Giphy(g) => MessageContentInternal::Giphy(g),
            MessageContent::GovernanceProposal(p) => MessageContentInternal::GovernanceProposal(p),
        }
    }

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
            | MessageContent::Cryptocurrency(_)
            | MessageContent::Deleted(_)
            | MessageContent::Giphy(_)
            | MessageContent::GovernanceProposal(_) => {}
        }

        references
    }

    fn text_length(&self) -> usize {
        match self {
            MessageContent::Text(t) => t.text.len(),
            MessageContent::Image(i) => i.caption.as_ref().map_or(0, |t| t.len()),
            MessageContent::Video(v) => v.caption.as_ref().map_or(0, |t| t.len()),
            MessageContent::Audio(a) => a.caption.as_ref().map_or(0, |t| t.len()),
            MessageContent::File(f) => f.caption.as_ref().map_or(0, |t| t.len()),
            MessageContent::Poll(p) => p.config.text.as_ref().map_or(0, |t| t.len()),
            MessageContent::Cryptocurrency(c) => c.caption.as_ref().map_or(0, |t| t.len()),
            MessageContent::Deleted(_) => 0,
            MessageContent::Giphy(g) => g.caption.as_ref().map_or(0, |t| t.len()),
            MessageContent::GovernanceProposal(p) => p.proposal.summary().len(),
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
            MessageContentInternal::Cryptocurrency(c) => MessageContent::Cryptocurrency(CryptocurrencyContent {
                transfer: match &c.transfer {
                    CryptoTransactionInternal::Pending(t) => CryptoTransaction::Pending(t.clone()),
                    CryptoTransactionInternal::Completed(t) => CryptoTransaction::Completed(CompletedCryptoTransaction {
                        token: t.token,
                        amount: t.amount,
                        fee: t.fee,
                        from: CryptoAccountFull::user(t.from.user_id().unwrap()),
                        to: CryptoAccountFull::user(t.to.user_id().unwrap()),
                        memo: t.memo,
                        created: t.created,
                        block_index: t.block_index,
                        transaction_hash: t.transaction_hash,
                    }),
                    _ => unreachable!(),
                },
                caption: c.caption.clone(),
            }),
            MessageContentInternal::Deleted(d) => MessageContent::Deleted(d.clone()),
            MessageContentInternal::Giphy(g) => MessageContent::Giphy(g.clone()),
            MessageContentInternal::GovernanceProposal(p) => MessageContent::GovernanceProposal(p.clone()),
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
                        return SuccessNoChange;
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
pub struct CryptocurrencyContent {
    pub transfer: CryptoTransaction,
    pub caption: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CryptocurrencyContentInternal {
    pub transfer: CryptoTransactionInternal,
    pub caption: Option<String>,
}

impl From<CryptocurrencyContent> for CryptocurrencyContentInternal {
    fn from(c: CryptocurrencyContent) -> Self {
        CryptocurrencyContentInternal {
            transfer: c.transfer.into(),
            caption: c.caption,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct DeletedBy {
    pub deleted_by: UserId,
    pub timestamp: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
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
