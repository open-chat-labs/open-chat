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

pub type TransactionHash = [u8; 32];

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CryptoAmount {
    pub token: Cryptocurrency,
    pub amount: Tokens,
}
