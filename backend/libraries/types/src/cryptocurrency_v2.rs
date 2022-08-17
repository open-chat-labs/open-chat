use crate::nns::UserOrAccount;
use crate::{Cryptocurrency, TimestampMillis, TransactionHash, UserId};
use candid::CandidType;
use ic_ledger_types::{AccountIdentifier, Tokens, DEFAULT_SUBACCOUNT};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CryptoTransactionV2 {
    Pending(PendingCryptoTransactionV2),
    Completed(CompletedCryptoTransactionV2),
    Failed(FailedCryptoTransactionV2),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum PendingCryptoTransactionV2 {
    NNS(nns::PendingCryptoTransaction),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CompletedCryptoTransactionV2 {
    NNS(nns::CompletedCryptoTransaction),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum FailedCryptoTransactionV2 {
    NNS(nns::FailedCryptoTransaction),
}

impl CryptoTransactionV2 {
    pub fn token(&self) -> Cryptocurrency {
        match self {
            CryptoTransactionV2::Pending(PendingCryptoTransactionV2::NNS(t)) => t.token,
            CryptoTransactionV2::Completed(CompletedCryptoTransactionV2::NNS(t)) => t.token,
            CryptoTransactionV2::Failed(FailedCryptoTransactionV2::NNS(t)) => t.token,
        }
    }

    pub fn is_zero(&self) -> bool {
        match self {
            CryptoTransactionV2::Pending(PendingCryptoTransactionV2::NNS(t)) => t.amount == Tokens::ZERO,
            CryptoTransactionV2::Completed(CompletedCryptoTransactionV2::NNS(t)) => t.amount == Tokens::ZERO,
            CryptoTransactionV2::Failed(FailedCryptoTransactionV2::NNS(t)) => t.amount == Tokens::ZERO,
        }
    }
}

impl PendingCryptoTransactionV2 {
    pub fn is_user_recipient(&self, user_id: UserId) -> bool {
        match self {
            PendingCryptoTransactionV2::NNS(t) => match t.to {
                UserOrAccount::User(u) => u == user_id,
                UserOrAccount::Account(a) => a == AccountIdentifier::new(&user_id.into(), &DEFAULT_SUBACCOUNT),
            },
        }
    }
}

pub mod nns {
    use super::*;
    use ic_ledger_types::{AccountIdentifier, BlockIndex, Memo};

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub enum CryptoAccount {
        Mint,
        Account(AccountIdentifier),
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub enum UserOrAccount {
        User(UserId),
        Account(AccountIdentifier),
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct PendingCryptoTransaction {
        pub token: Cryptocurrency,
        pub amount: Tokens,
        pub to: UserOrAccount,
        pub fee: Option<Tokens>,
        pub memo: Option<Memo>,
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct CompletedCryptoTransaction {
        pub token: Cryptocurrency,
        pub amount: Tokens,
        pub fee: Tokens,
        pub from: CryptoAccount,
        pub to: CryptoAccount,
        pub memo: Memo,
        pub created: TimestampMillis,
        pub transaction_hash: TransactionHash,
        pub block_index: BlockIndex,
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct FailedCryptoTransaction {
        pub token: Cryptocurrency,
        pub amount: Tokens,
        pub fee: Tokens,
        pub from: CryptoAccount,
        pub to: CryptoAccount,
        pub memo: Memo,
        pub created: TimestampMillis,
        pub transaction_hash: TransactionHash,
        pub error_message: String,
    }
}
