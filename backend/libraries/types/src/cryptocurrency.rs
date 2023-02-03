use crate::{TimestampNanos, UserId};
use candid::{CandidType, Principal};
use ic_ledger_types::Tokens;
use serde::{Deserialize, Serialize};

const E8S_PER_TOKEN: u64 = 100_000_000;

#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug, Eq, PartialEq, Hash)]
pub enum Cryptocurrency {
    InternetComputer,
    SNS1,
    CKBTC,
    CHAT,
}

impl Cryptocurrency {
    pub fn token_symbol(&self) -> String {
        match self {
            Cryptocurrency::InternetComputer => "ICP".to_string(),
            Cryptocurrency::SNS1 => "SNS1".to_string(),
            Cryptocurrency::CKBTC => "ckBTC".to_string(),
            Cryptocurrency::CHAT => "CHAT".to_string(),
        }
    }

    pub fn decimals(&self) -> usize {
        match self {
            Cryptocurrency::InternetComputer => 8,
            Cryptocurrency::SNS1 => 8,
            Cryptocurrency::CKBTC => 8,
            Cryptocurrency::CHAT => 8,
        }
    }

    pub fn transfer_limit(&self) -> u128 {
        match self {
            Cryptocurrency::InternetComputer => (50 * E8S_PER_TOKEN).into(),
            Cryptocurrency::SNS1 => (10 * E8S_PER_TOKEN).into(),
            Cryptocurrency::CKBTC => (E8S_PER_TOKEN / 100).into(),
            Cryptocurrency::CHAT => (1_000 * E8S_PER_TOKEN).into(),
        }
    }

    pub fn fee(&self) -> u128 {
        match self {
            Cryptocurrency::InternetComputer => 10_000,
            Cryptocurrency::SNS1 => 1_000,
            Cryptocurrency::CKBTC => 10,
            Cryptocurrency::CHAT => 100_000,
        }
    }
}

pub type TransactionHash = [u8; 32];

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CryptoTransaction {
    Pending(PendingCryptoTransaction),
    Completed(CompletedCryptoTransaction),
    Failed(FailedCryptoTransaction),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum PendingCryptoTransaction {
    NNS(nns::PendingCryptoTransaction),
    SNS(sns::PendingCryptoTransaction),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CompletedCryptoTransaction {
    NNS(nns::CompletedCryptoTransaction),
    SNS(sns::CompletedCryptoTransaction),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum FailedCryptoTransaction {
    NNS(nns::FailedCryptoTransaction),
    SNS(sns::FailedCryptoTransaction),
}

impl CryptoTransaction {
    pub fn token(&self) -> Cryptocurrency {
        match self {
            CryptoTransaction::Pending(p) => p.token(),
            CryptoTransaction::Completed(c) => match c {
                CompletedCryptoTransaction::NNS(t) => t.token,
                CompletedCryptoTransaction::SNS(t) => t.token,
            },
            CryptoTransaction::Failed(f) => match f {
                FailedCryptoTransaction::NNS(t) => t.token,
                FailedCryptoTransaction::SNS(t) => t.token,
            },
        }
    }

    pub fn is_zero(&self) -> bool {
        self.units() == 0
    }

    pub fn units(&self) -> u128 {
        match self {
            CryptoTransaction::Pending(p) => p.units(),
            CryptoTransaction::Completed(c) => match c {
                CompletedCryptoTransaction::NNS(t) => t.amount.e8s().into(),
                CompletedCryptoTransaction::SNS(t) => t.amount.e8s().into(),
            },
            CryptoTransaction::Failed(f) => match f {
                FailedCryptoTransaction::NNS(t) => t.amount.e8s().into(),
                FailedCryptoTransaction::SNS(t) => t.amount.e8s().into(),
            },
        }
    }

    pub fn exceeds_transfer_limit(&self) -> bool {
        if let CryptoTransaction::Pending(t) = self {
            t.units() > t.token().transfer_limit()
        } else {
            false
        }
    }
}

impl PendingCryptoTransaction {
    pub fn token(&self) -> Cryptocurrency {
        match self {
            PendingCryptoTransaction::NNS(t) => t.token,
            PendingCryptoTransaction::SNS(t) => t.token,
        }
    }

    pub fn units(&self) -> u128 {
        match self {
            PendingCryptoTransaction::NNS(t) => t.amount.e8s().into(),
            PendingCryptoTransaction::SNS(t) => t.amount.e8s().into(),
        }
    }

    pub fn is_user_recipient(&self, user_id: UserId) -> bool {
        match self {
            PendingCryptoTransaction::NNS(t) => match t.to {
                nns::UserOrAccount::User(u) => u == user_id,
                nns::UserOrAccount::Account(a) => {
                    a == ic_ledger_types::AccountIdentifier::new(&user_id.into(), &ic_ledger_types::DEFAULT_SUBACCOUNT)
                }
            },
            PendingCryptoTransaction::SNS(t) => {
                t.to.owner == Principal::from(user_id).into()
                    && t.to.subaccount.map_or(true, |s| s == *ic_icrc1::DEFAULT_SUBACCOUNT)
            }
        }
    }
}

impl FailedCryptoTransaction {
    pub fn error_message(&self) -> &str {
        match self {
            FailedCryptoTransaction::NNS(t) => &t.error_message,
            FailedCryptoTransaction::SNS(t) => &t.error_message,
        }
    }

    pub fn amount(&self) -> Tokens {
        match self {
            FailedCryptoTransaction::NNS(t) => t.amount,
            FailedCryptoTransaction::SNS(t) => t.amount,
        }
    }
}

pub mod nns {
    use super::*;
    use ic_ledger_types::{AccountIdentifier, BlockIndex, Memo, Tokens};

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct CryptoAmount {
        pub token: Cryptocurrency,
        pub amount: Tokens,
    }

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
        pub created: TimestampNanos,
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
        pub created: TimestampNanos,
        pub transaction_hash: TransactionHash,
        pub error_message: String,
    }
}

pub mod sns {
    use super::*;
    use ic_icrc1::Account;
    use ic_ledger_types::{BlockIndex, Memo, Tokens};

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub enum CryptoAccount {
        Mint,
        Account(Account),
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct PendingCryptoTransaction {
        pub token: Cryptocurrency,
        pub amount: Tokens,
        pub to: Account,
        pub fee: Tokens,
        pub memo: Option<Memo>,
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct CompletedCryptoTransaction {
        pub token: Cryptocurrency,
        pub amount: Tokens,
        pub fee: Tokens,
        pub from: CryptoAccount,
        pub to: CryptoAccount,
        pub memo: Option<Memo>,
        pub created: TimestampNanos,
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
        pub memo: Option<Memo>,
        pub created: TimestampNanos,
        pub transaction_hash: TransactionHash,
        pub error_message: String,
    }
}
