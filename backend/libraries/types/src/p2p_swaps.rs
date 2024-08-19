use crate::{Chat, MessageId, MessageIndex, P2PSwapContent, TimestampMillis, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_optional::ts_optional;
use ts_rs::TS;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
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
pub type CancelP2PSwapResult = UpdateP2PSwapResult<u32>;

pub struct ReserveP2PSwapSuccess {
    pub content: P2PSwapContent,
    pub created: TimestampMillis,
    pub created_by: UserId,
}

#[ts_optional]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
pub struct P2PSwapCancelled {
    pub token0_txn_out: Option<u64>,
}

pub type P2PSwapExpired = P2PSwapCancelled;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
pub struct P2PSwapReserved {
    pub reserved_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
pub struct P2PSwapAccepted {
    pub accepted_by: UserId,
    pub token1_txn_in: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
pub struct P2PSwapCompleted {
    pub accepted_by: UserId,
    pub token1_txn_in: u64,
    pub token0_txn_out: u64,
    pub token1_txn_out: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
pub struct AcceptSwapSuccess {
    pub token1_txn_in: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
pub enum SwapStatusError {
    Reserved(SwapStatusErrorReserved),
    Accepted(SwapStatusErrorAccepted),
    Completed(SwapStatusErrorCompleted),
    Expired(SwapStatusErrorExpired),
    Cancelled(SwapStatusErrorCancelled),
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
pub struct SwapStatusErrorReserved {
    pub reserved_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
pub struct SwapStatusErrorAccepted {
    pub accepted_by: UserId,
    pub token1_txn_in: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
pub struct SwapStatusErrorCompleted {
    pub accepted_by: UserId,
    pub token1_txn_in: u64,
    pub token0_txn_out: u64,
    pub token1_txn_out: u64,
}

#[ts_optional]
#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
pub struct SwapStatusErrorExpired {
    pub token0_txn_out: Option<u64>,
}

#[ts_optional]
#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
pub struct SwapStatusErrorCancelled {
    pub token0_txn_out: Option<u64>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
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

#[derive(Serialize)]
pub struct P2PSwapCompletedEventPayload {
    pub chat_type: String,
    pub chat_id: String,
    pub token0: String,
    pub token0_amount: u128,
    pub token1: String,
    pub token1_amount: u128,
}

pub mod swap_location {
    use super::*;

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
    pub struct Message {
        pub chat: Chat,
        pub thread_root_message_index: Option<MessageIndex>,
        pub message_id: MessageId,
    }
}

impl From<P2PSwapStatus> for SwapStatusError {
    fn from(value: P2PSwapStatus) -> Self {
        match value {
            P2PSwapStatus::Open => unreachable!(),
            P2PSwapStatus::Cancelled(s) => SwapStatusError::Cancelled(SwapStatusErrorCancelled {
                token0_txn_out: s.token0_txn_out,
            }),
            P2PSwapStatus::Expired(s) => SwapStatusError::Expired(SwapStatusErrorExpired {
                token0_txn_out: s.token0_txn_out,
            }),
            P2PSwapStatus::Reserved(s) => SwapStatusError::Reserved(SwapStatusErrorReserved {
                reserved_by: s.reserved_by,
            }),
            P2PSwapStatus::Accepted(s) => SwapStatusError::Accepted(SwapStatusErrorAccepted {
                accepted_by: s.accepted_by,
                token1_txn_in: s.token1_txn_in,
            }),
            P2PSwapStatus::Completed(s) => SwapStatusError::Completed(SwapStatusErrorCompleted {
                accepted_by: s.accepted_by,
                token1_txn_in: s.token1_txn_in,
                token0_txn_out: s.token0_txn_out,
                token1_txn_out: s.token1_txn_out,
            }),
        }
    }
}
