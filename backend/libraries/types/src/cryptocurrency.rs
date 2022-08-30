use crate::nns::UserOrAccount;
use crate::{TimestampMillis, UserId};
use candid::CandidType;
use ic_ledger_types::{AccountIdentifier, Tokens, DEFAULT_SUBACCOUNT};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug, Eq, PartialEq)]
pub enum Cryptocurrency {
    InternetComputer,
}

impl Cryptocurrency {
    pub fn token_symbol(&self) -> String {
        match self {
            Cryptocurrency::InternetComputer => "ICP".to_string(),
        }
    }
}

pub type TransactionHash = [u8; 32];

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CryptoAmount {
    pub token: Cryptocurrency,
    pub amount: Tokens,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CryptoTransaction {
    Pending(PendingCryptoTransaction),
    Completed(CompletedCryptoTransaction),
    Failed(FailedCryptoTransaction),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum PendingCryptoTransaction {
    NNS(nns::PendingCryptoTransaction),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CompletedCryptoTransaction {
    NNS(nns::CompletedCryptoTransaction),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum FailedCryptoTransaction {
    NNS(nns::FailedCryptoTransaction),
}

impl CryptoTransaction {
    pub fn token(&self) -> Cryptocurrency {
        match self {
            CryptoTransaction::Pending(PendingCryptoTransaction::NNS(t)) => t.token,
            CryptoTransaction::Completed(CompletedCryptoTransaction::NNS(t)) => t.token,
            CryptoTransaction::Failed(FailedCryptoTransaction::NNS(t)) => t.token,
        }
    }

    pub fn is_zero(&self) -> bool {
        match self {
            CryptoTransaction::Pending(PendingCryptoTransaction::NNS(t)) => t.amount == Tokens::ZERO,
            CryptoTransaction::Completed(CompletedCryptoTransaction::NNS(t)) => t.amount == Tokens::ZERO,
            CryptoTransaction::Failed(FailedCryptoTransaction::NNS(t)) => t.amount == Tokens::ZERO,
        }
    }
}

impl PendingCryptoTransaction {
    pub fn is_user_recipient(&self, user_id: UserId) -> bool {
        match self {
            PendingCryptoTransaction::NNS(t) => match t.to {
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
