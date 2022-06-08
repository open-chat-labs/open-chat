use crate::UserId;
use candid::CandidType;
use ic_ledger_types::{AccountIdentifier, BlockIndex, Memo, Tokens};
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

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CryptocurrencyTransaction {
    Deposit(CryptocurrencyDeposit),
    Withdrawal(CryptocurrencyWithdrawal),
    Transfer(CryptocurrencyTransfer),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CryptocurrencyDeposit {
    Completed(CompletedCryptocurrencyDeposit),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CompletedCryptocurrencyDeposit {
    pub token: Cryptocurrency,
    pub from_address: AccountIdentifier,
    pub amount: Tokens,
    pub fee: Tokens,
    pub memo: Memo,
    pub block_index: BlockIndex,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CryptocurrencyWithdrawal {
    Pending(PendingCryptocurrencyWithdrawal),
    Completed(CompletedCryptocurrencyWithdrawal),
    Failed(FailedCryptocurrencyWithdrawal),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PendingCryptocurrencyWithdrawal {
    pub token: Cryptocurrency,
    pub to: AccountIdentifier,
    pub amount: Tokens,
    pub fee: Option<Tokens>,
    pub memo: Option<Memo>,
}

impl PendingCryptocurrencyWithdrawal {
    pub fn completed(
        &self,
        fee: Tokens,
        memo: Memo,
        block_index: BlockIndex,
        transaction_hash: TransactionHash,
    ) -> CompletedCryptocurrencyWithdrawal {
        CompletedCryptocurrencyWithdrawal {
            token: self.token,
            to: self.to,
            amount: self.amount,
            fee,
            memo,
            block_index,
            transaction_hash,
        }
    }

    pub fn failed(&self, fee: Tokens, memo: Memo, error_message: String) -> FailedCryptocurrencyWithdrawal {
        FailedCryptocurrencyWithdrawal {
            token: self.token,
            to: self.to,
            amount: self.amount,
            fee,
            memo,
            error_message,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CompletedCryptocurrencyWithdrawal {
    pub token: Cryptocurrency,
    pub to: AccountIdentifier,
    pub amount: Tokens,
    pub fee: Tokens,
    pub memo: Memo,
    pub block_index: BlockIndex,
    pub transaction_hash: TransactionHash,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct FailedCryptocurrencyWithdrawal {
    pub token: Cryptocurrency,
    pub to: AccountIdentifier,
    pub amount: Tokens,
    pub fee: Tokens,
    pub memo: Memo,
    pub error_message: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CryptocurrencyTransfer {
    Pending(PendingCryptocurrencyTransfer),
    Completed(CompletedCryptocurrencyTransfer),
    Failed(FailedCryptocurrencyTransfer),
}

impl CryptocurrencyTransfer {
    pub fn token(&self) -> Cryptocurrency {
        match self {
            CryptocurrencyTransfer::Pending(t) => t.token,
            CryptocurrencyTransfer::Completed(t) => t.token,
            CryptocurrencyTransfer::Failed(t) => t.token,
        }
    }

    pub fn recipient(&self) -> UserId {
        match self {
            Self::Pending(t) => t.recipient,
            Self::Completed(t) => t.recipient,
            Self::Failed(t) => t.recipient,
        }
    }

    pub fn amount(&self) -> Tokens {
        match self {
            Self::Pending(t) => t.amount,
            Self::Completed(t) => t.amount,
            Self::Failed(t) => t.amount,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PendingCryptocurrencyTransfer {
    pub token: Cryptocurrency,
    pub recipient: UserId,
    pub amount: Tokens,
    pub fee: Option<Tokens>,
    pub memo: Option<Memo>,
}

impl PendingCryptocurrencyTransfer {
    pub fn completed(
        &self,
        sender: UserId,
        fee: Tokens,
        memo: Memo,
        block_index: BlockIndex,
        transaction_hash: TransactionHash,
    ) -> CompletedCryptocurrencyTransfer {
        CompletedCryptocurrencyTransfer {
            token: self.token,
            sender,
            recipient: self.recipient,
            amount: self.amount,
            fee,
            memo,
            block_index,
            transaction_hash,
        }
    }

    pub fn failed(&self, fee: Tokens, memo: Memo, error_message: String) -> FailedCryptocurrencyTransfer {
        FailedCryptocurrencyTransfer {
            token: self.token,
            recipient: self.recipient,
            amount: self.amount,
            fee,
            memo,
            error_message,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CompletedCryptocurrencyTransfer {
    pub token: Cryptocurrency,
    pub sender: UserId,
    pub recipient: UserId,
    pub amount: Tokens,
    pub fee: Tokens,
    pub memo: Memo,
    pub block_index: BlockIndex,
    pub transaction_hash: TransactionHash,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct FailedCryptocurrencyTransfer {
    pub token: Cryptocurrency,
    pub recipient: UserId,
    pub amount: Tokens,
    pub fee: Tokens,
    pub memo: Memo,
    pub error_message: String,
}

pub type TransactionHash = [u8; 32];

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CryptoAmount {
    pub token: Cryptocurrency,
    pub amount: Tokens,
}
