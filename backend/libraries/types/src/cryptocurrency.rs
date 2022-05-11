use crate::UserId;
use candid::CandidType;
use ic_ledger_types::{AccountIdentifier, BlockIndex, Memo, Tokens};
use serde::{Deserialize, Serialize};
use std::str::FromStr;

#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug, Eq, PartialEq, Hash)]
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

impl FromStr for Cryptocurrency {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "ICP" => Ok(Cryptocurrency::InternetComputer),
            _ => Err(()),
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CryptocurrencyTransaction {
    Deposit(CryptocurrencyDeposit),
    Withdrawal(CryptocurrencyWithdrawal),
    Transfer(CryptocurrencyTransfer),
}

impl CryptocurrencyTransaction {
    pub fn token(&self) -> Cryptocurrency {
        match self {
            CryptocurrencyTransaction::Deposit(t) => t.token(),
            CryptocurrencyTransaction::Withdrawal(t) => t.token(),
            CryptocurrencyTransaction::Transfer(t) => t.token(),
        }
    }

    pub fn block_index(&self) -> Option<BlockIndex> {
        match self {
            CryptocurrencyTransaction::Deposit(t) => Some(t.block_index()),
            CryptocurrencyTransaction::Withdrawal(t) => t.block_index(),
            CryptocurrencyTransaction::Transfer(t) => t.block_index(),
        }
    }

    pub fn transaction_hash(&self) -> Option<TransactionHash> {
        match self {
            CryptocurrencyTransaction::Deposit(t) => Some(t.transaction_hash()),
            CryptocurrencyTransaction::Withdrawal(t) => t.transaction_hash(),
            CryptocurrencyTransaction::Transfer(t) => t.transaction_hash(),
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CryptocurrencyDeposit {
    Completed(CompletedCryptocurrencyDeposit),
}

impl CryptocurrencyDeposit {
    pub fn token(&self) -> Cryptocurrency {
        match self {
            CryptocurrencyDeposit::Completed(d) => d.token,
        }
    }

    pub fn block_index(&self) -> BlockIndex {
        match self {
            CryptocurrencyDeposit::Completed(d) => d.block_index,
        }
    }

    pub fn transaction_hash(&self) -> TransactionHash {
        match self {
            CryptocurrencyDeposit::Completed(d) => d.transaction_hash,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CompletedCryptocurrencyDeposit {
    pub token: Cryptocurrency,
    pub from: AccountIdentifier,
    pub amount: Tokens,
    pub fee: Tokens,
    pub memo: Memo,
    pub block_index: BlockIndex,
    pub transaction_hash: TransactionHash,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CryptocurrencyWithdrawal {
    Pending(PendingCryptocurrencyWithdrawal),
    Completed(CompletedCryptocurrencyWithdrawal),
    Failed(FailedCryptocurrencyWithdrawal),
}

impl CryptocurrencyWithdrawal {
    pub fn token(&self) -> Cryptocurrency {
        match self {
            CryptocurrencyWithdrawal::Pending(w) => w.token,
            CryptocurrencyWithdrawal::Completed(w) => w.token,
            CryptocurrencyWithdrawal::Failed(w) => w.token,
        }
    }

    pub fn block_index(&self) -> Option<BlockIndex> {
        match self {
            CryptocurrencyWithdrawal::Pending(_) => None,
            CryptocurrencyWithdrawal::Completed(w) => Some(w.block_index),
            CryptocurrencyWithdrawal::Failed(_) => None,
        }
    }

    pub fn transaction_hash(&self) -> Option<TransactionHash> {
        match self {
            CryptocurrencyWithdrawal::Pending(_) => None,
            CryptocurrencyWithdrawal::Completed(w) => Some(w.transaction_hash),
            CryptocurrencyWithdrawal::Failed(_) => None,
        }
    }
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

    pub fn block_index(&self) -> Option<BlockIndex> {
        match self {
            CryptocurrencyTransfer::Pending(_) => None,
            CryptocurrencyTransfer::Completed(t) => Some(t.block_index),
            CryptocurrencyTransfer::Failed(_) => None,
        }
    }

    pub fn transaction_hash(&self) -> Option<TransactionHash> {
        match self {
            CryptocurrencyTransfer::Pending(_) => None,
            CryptocurrencyTransfer::Completed(t) => Some(t.transaction_hash),
            CryptocurrencyTransfer::Failed(_) => None,
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
