mod ledger_types;

pub use ledger_types::*;

use candid::{CandidType, Principal};
use ic_cdk::api::call::CallResult;
use ic_ledger_types::{AccountIdentifier, BlockIndex, Memo, Subaccount, Timestamp, Tokens, TransferArgs, DEFAULT_SUBACCOUNT};
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use types::{CanisterId, TransactionHash, UserId};

pub fn default_ledger_account(principal: Principal) -> AccountIdentifier {
    AccountIdentifier::new(&principal, &DEFAULT_SUBACCOUNT)
}

pub fn convert_to_subaccount(principal: &Principal) -> Subaccount {
    let mut subaccount = [0; std::mem::size_of::<Subaccount>()];
    let bytes = principal.as_slice();
    subaccount[0] = bytes.len().try_into().unwrap();
    subaccount[1..1 + bytes.len()].copy_from_slice(bytes);
    Subaccount(subaccount)
}

pub fn calculate_transaction_hash(sender: UserId, args: &TransferArgs) -> TransactionHash {
    let from = default_ledger_account(sender.into());

    let transaction = Transaction {
        operation: Operation::Transfer {
            from: from.to_string(),
            to: args.to.to_string(),
            amount: args.amount,
            fee: args.fee,
        },
        memo: args.memo,
        // 'args.created_at_time' must be set otherwise the hash won't match
        created_at_time: args.created_at_time.unwrap(),
    };

    transaction.hash()
}

pub async fn latest_block_index(ledger_canister_id: CanisterId) -> CallResult<BlockIndex> {
    let response = query_blocks(ledger_canister_id, GetBlocksArgs { start: 0, length: 0 }).await?;

    Ok(response.chain_length)
}

pub async fn blocks_since(ledger_canister_id: CanisterId, start: BlockIndex, length: usize) -> CallResult<Vec<CandidBlock>> {
    let response = query_blocks(ledger_canister_id, GetBlocksArgs { start, length }).await?;

    if response.archived_blocks.is_empty() {
        Ok(response.blocks)
    } else {
        async fn get_blocks(range: ArchivedBlocksRange) -> CallResult<GetBlocksResult> {
            let args = GetBlocksArgs {
                start: range.start,
                length: range.length as usize,
            };
            let (response,) = ic_cdk::call(range.callback.canister_id, &range.callback.method, (args,)).await?;
            Ok(response)
        }

        // Get the transactions from the archive canisters
        let futures: Vec<_> = response
            .archived_blocks
            .into_iter()
            .sorted_by_key(|a| a.start)
            .map(get_blocks)
            .collect();

        let archive_responses = futures::future::join_all(futures).await;

        let results = archive_responses.into_iter().collect::<CallResult<Vec<_>>>()?;

        Ok(results
            .into_iter()
            .flat_map(|r| r.unwrap().blocks)
            .chain(response.blocks)
            .collect())
    }
}

pub async fn query_blocks(ledger_canister_id: CanisterId, args: GetBlocksArgs) -> CallResult<QueryBlocksResponse> {
    let (result,) = ic_cdk::call(ledger_canister_id, "query_blocks", (args,)).await?;
    Ok(result)
}

/// An operation which modifies account balances
#[derive(Serialize, Deserialize, CandidType, Clone, Hash, Debug, PartialEq, Eq, PartialOrd, Ord)]
enum Operation {
    Burn {
        from: String,
        amount: Tokens,
    },
    Mint {
        to: String,
        amount: Tokens,
    },
    Transfer {
        from: String,
        to: String,
        amount: Tokens,
        fee: Tokens,
    },
}

/// An operation with the metadata the client generated attached to it
#[derive(Serialize, Deserialize, CandidType, Clone, Hash, Debug, PartialEq, Eq, PartialOrd, Ord)]
struct Transaction {
    pub operation: Operation,
    pub memo: Memo,

    /// The time this transaction was created.
    pub created_at_time: Timestamp,
}

impl Transaction {
    pub fn hash(&self) -> TransactionHash {
        let mut hash = Sha256::new();
        hash.update(&serde_cbor::ser::to_vec_packed(&self).unwrap());
        hash.finalize().into()
    }
}
