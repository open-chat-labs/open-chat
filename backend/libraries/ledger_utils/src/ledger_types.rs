use candid::{CandidType, Principal};
use ic_ledger_types::{AccountIdentifier, BlockIndex, Memo, Timestamp, Tokens};
use serde::{Deserialize, Serialize};
use types::CanisterId;

#[derive(Serialize, Deserialize, CandidType)]
pub struct GetBlocksArgs {
    pub start: BlockIndex,
    pub length: usize,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(try_from = "candid::types::reference::Func")]
pub struct QueryArchiveFn {
    pub canister_id: CanisterId,
    pub method: String,
}

impl From<QueryArchiveFn> for candid::types::reference::Func {
    fn from(archive_fn: QueryArchiveFn) -> Self {
        Self {
            principal: Principal::from_slice(archive_fn.canister_id.as_ref()),
            method: archive_fn.method,
        }
    }
}

impl TryFrom<candid::types::reference::Func> for QueryArchiveFn {
    type Error = String;
    fn try_from(func: candid::types::reference::Func) -> Result<Self, Self::Error> {
        let canister_id =
            CanisterId::try_from(func.principal.as_slice()).map_err(|e| format!("principal is not a canister id: {}", e))?;
        Ok(QueryArchiveFn {
            canister_id,
            method: func.method,
        })
    }
}

impl CandidType for QueryArchiveFn {
    fn _ty() -> candid::types::Type {
        candid::types::Type::Func(candid::types::Function {
            modes: vec![candid::parser::types::FuncMode::Query],
            args: vec![GetBlocksArgs::_ty()],
            rets: vec![GetBlocksResult::_ty()],
        })
    }

    fn idl_serialize<S>(&self, serializer: S) -> Result<(), S::Error>
    where
        S: candid::types::Serializer,
    {
        candid::types::reference::Func::from(self.clone()).idl_serialize(serializer)
    }
}

#[derive(Debug, CandidType, Deserialize)]
pub struct ArchivedBlocksRange {
    pub start: BlockIndex,
    pub length: u64,
    pub callback: QueryArchiveFn,
}

#[derive(Debug, CandidType, Deserialize)]
pub struct QueryBlocksResponse {
    pub chain_length: u64,
    pub certificate: Option<serde_bytes::ByteBuf>,
    pub blocks: Vec<CandidBlock>,
    pub first_block_index: BlockIndex,
    pub archived_blocks: Vec<ArchivedBlocksRange>,
}

/// An operation which modifies account balances
#[derive(Serialize, Deserialize, CandidType, Clone, Hash, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum CandidOperation {
    Burn {
        from: AccountIdentifier,
        amount: Tokens,
    },
    Mint {
        to: AccountIdentifier,
        amount: Tokens,
    },
    Transfer {
        from: AccountIdentifier,
        to: AccountIdentifier,
        amount: Tokens,
        fee: Tokens,
    },
}

/// An operation with the metadata the client generated attached to it
#[derive(Serialize, Deserialize, CandidType, Clone, Hash, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct CandidTransaction {
    pub operation: CandidOperation,
    pub memo: Memo,
    pub created_at_time: Timestamp,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct CandidBlock {
    pub parent_hash: Option<[u8; 32]>,
    pub transaction: CandidTransaction,
    pub timestamp: Timestamp,
}

#[derive(Serialize, Deserialize, CandidType, Debug)]
pub struct BlockRange {
    pub blocks: Vec<CandidBlock>,
}

pub type GetBlocksResult = Result<BlockRange, GetBlocksError>;

#[derive(Debug, PartialEq, Eq, Serialize, Deserialize, CandidType)]
pub enum GetBlocksError {
    BadFirstBlockIndex {
        requested_index: BlockIndex,
        first_valid_index: BlockIndex,
    },
    Other {
        error_code: u64,
        error_message: String,
    },
}
