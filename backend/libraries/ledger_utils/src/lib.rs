use candid::{CandidType, Principal};
use ic_ledger_types::{AccountIdentifier, Memo, Subaccount, Timestamp, Tokens, TransferArgs, DEFAULT_SUBACCOUNT};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use types::{TransactionHash, UserId};

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
