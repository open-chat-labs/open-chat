use candid::Principal;
use ic_cdk::api::call::CallResult;
use ic_ledger_types::{
    AccountIdentifier, ArchivedBlocksRange, Block, BlockIndex, GetBlocksArgs, GetBlocksResult, Subaccount, DEFAULT_SUBACCOUNT,
};
use itertools::Itertools;
use types::CanisterId;

pub use transaction_hash::calculate_transaction_hash;

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

pub async fn blocks_since(ledger_canister_id: CanisterId, start: BlockIndex, length: usize) -> CallResult<Vec<Block>> {
    let response = ic_ledger_types::query_blocks(ledger_canister_id, GetBlocksArgs { start, length }).await?;

    if response.archived_blocks.is_empty() {
        Ok(response.blocks)
    } else {
        async fn get_blocks_from_archive(range: ArchivedBlocksRange) -> CallResult<GetBlocksResult> {
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
            .map(get_blocks_from_archive)
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

mod transaction_hash {
    use crate::default_ledger_account;
    use ic_ledger_types::{Memo, Timestamp, Tokens, TransferArgs};
    use serde::Serialize;
    use sha2::{Digest, Sha256};
    use types::{TransactionHash, UserId};

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

    #[derive(Serialize)]
    struct Transaction {
        operation: Operation,
        memo: Memo,
        created_at_time: Timestamp,
    }

    impl Transaction {
        pub fn hash(&self) -> TransactionHash {
            let mut hash = Sha256::new();
            hash.update(&serde_cbor::ser::to_vec_packed(&self).unwrap());
            hash.finalize().into()
        }
    }

    #[derive(Serialize)]
    enum Operation {
        Transfer {
            from: String,
            to: String,
            amount: Tokens,
            fee: Tokens,
        },
    }
}
