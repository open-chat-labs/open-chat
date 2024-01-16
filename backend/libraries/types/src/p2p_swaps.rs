use crate::{Chat, MessageId, MessageIndex, P2PSwapContent, TimestampMillis, TransactionId, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum P2PSwapStatus {
    Open,
    Cancelled(P2PSwapCancelled),
    Expired(P2PSwapExpired),
    Reserved(P2PSwapReserved),
    Accepted(P2PSwapAccepted),
    Completed(P2PSwapCompleted),
}

pub enum UpdateP2PSwapResult<T> {
    Success(T),
    Failure(P2PSwapStatus),
    SwapNotFound,
}

pub type ReserveP2PSwapResult = UpdateP2PSwapResult<ReserveP2PSwapSuccess>;
pub type AcceptP2PSwapResult = UpdateP2PSwapResult<P2PSwapAccepted>;
pub type CompleteP2PSwapResult = UpdateP2PSwapResult<P2PSwapCompleted>;

pub struct ReserveP2PSwapSuccess {
    pub content: P2PSwapContent,
    pub created: TimestampMillis,
    pub created_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct P2PSwapCancelled {
    pub token0_txn_out: Option<TransactionId>,
}

pub type P2PSwapExpired = P2PSwapCancelled;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct P2PSwapReserved {
    pub reserved_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct P2PSwapAccepted {
    pub accepted_by: UserId,
    pub token1_txn_in: TransactionId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct P2PSwapCompleted {
    pub accepted_by: UserId,
    pub token1_txn_in: TransactionId,
    pub token0_txn_out: TransactionId,
    pub token1_txn_out: TransactionId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct AcceptSwapSuccess {
    pub token1_txn_in: TransactionId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum AcceptSwapStatusError {
    AlreadyReserved(AcceptSwapAlreadyReserved),
    AlreadyAccepted(AcceptSwapAlreadyAccepted),
    AlreadyCompleted(AcceptSwapAlreadyCompleted),
    SwapExpired(AcceptSwapExpired),
    SwapCancelled(AcceptSwapCancelled),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct AcceptSwapAlreadyReserved {
    pub reserved_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct AcceptSwapAlreadyAccepted {
    pub accepted_by: UserId,
    pub token1_txn_in: TransactionId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct AcceptSwapAlreadyCompleted {
    pub accepted_by: UserId,
    pub token1_txn_in: TransactionId,
    pub token0_txn_out: TransactionId,
    pub token1_txn_out: TransactionId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct AcceptSwapExpired {
    pub token0_txn_out: Option<TransactionId>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct AcceptSwapCancelled {
    pub token0_txn_out: Option<TransactionId>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum P2PSwapLocation {
    Message(swap_location::Message),
}

impl P2PSwapLocation {
    pub fn from_message(chat: Chat, thread_root_message_index: Option<MessageIndex>, message_id: MessageId) -> P2PSwapLocation {
        P2PSwapLocation::Message(swap_location::Message {
            chat,
            thread_root_message_index,
            message_id,
        })
    }
}

pub mod swap_location {
    use super::*;

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct Message {
        pub chat: Chat,
        pub thread_root_message_index: Option<MessageIndex>,
        pub message_id: MessageId,
    }
}

impl From<P2PSwapStatus> for AcceptSwapStatusError {
    fn from(value: P2PSwapStatus) -> Self {
        match value {
            P2PSwapStatus::Open => unreachable!(),
            P2PSwapStatus::Cancelled(s) => AcceptSwapStatusError::SwapCancelled(AcceptSwapCancelled {
                token0_txn_out: s.token0_txn_out,
            }),
            P2PSwapStatus::Expired(s) => AcceptSwapStatusError::SwapExpired(AcceptSwapExpired {
                token0_txn_out: s.token0_txn_out,
            }),
            P2PSwapStatus::Reserved(s) => AcceptSwapStatusError::AlreadyReserved(AcceptSwapAlreadyReserved {
                reserved_by: s.reserved_by,
            }),
            P2PSwapStatus::Accepted(s) => AcceptSwapStatusError::AlreadyAccepted(AcceptSwapAlreadyAccepted {
                accepted_by: s.accepted_by,
                token1_txn_in: s.token1_txn_in,
            }),
            P2PSwapStatus::Completed(s) => AcceptSwapStatusError::AlreadyCompleted(AcceptSwapAlreadyCompleted {
                accepted_by: s.accepted_by,
                token1_txn_in: s.token1_txn_in,
                token0_txn_out: s.token0_txn_out,
                token1_txn_out: s.token1_txn_out,
            }),
        }
    }
}
