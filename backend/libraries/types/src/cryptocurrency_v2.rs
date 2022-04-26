use crate::UserId;
use candid::CandidType;
use ic_ledger_types::{AccountIdentifier, BlockIndex, Memo, Tokens};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug, Eq, PartialEq)]
pub enum Cryptocurrency {
    InternetComputer,
}

impl Cryptocurrency {
    pub fn ticker(&self) -> String {
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

impl From<crate::CryptocurrencyTransaction> for CryptocurrencyTransaction {
    fn from(transaction: crate::CryptocurrencyTransaction) -> Self {
        match transaction {
            crate::CryptocurrencyTransaction::Deposit(d) => CryptocurrencyTransaction::Deposit(d.into()),
            crate::CryptocurrencyTransaction::Withdrawal(w) => CryptocurrencyTransaction::Withdrawal(w.into()),
            crate::CryptocurrencyTransaction::Transfer(t) => CryptocurrencyTransaction::Transfer(t.into()),
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CryptocurrencyDeposit {
    Completed(CompletedCryptocurrencyDeposit),
}

impl From<crate::CryptocurrencyDeposit> for CryptocurrencyDeposit {
    fn from(deposit: crate::CryptocurrencyDeposit) -> Self {
        match deposit {
            crate::CryptocurrencyDeposit::ICP(crate::ICPDeposit::Completed(d)) => {
                CryptocurrencyDeposit::Completed(CompletedCryptocurrencyDeposit {
                    token: Cryptocurrency::InternetComputer,
                    from_address: d.from_address,
                    amount: d.amount,
                    fee: d.fee,
                    memo: d.memo,
                    block_index: d.block_index,
                })
            }
            _ => unreachable!(),
        }
    }
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

impl From<crate::CryptocurrencyWithdrawal> for CryptocurrencyWithdrawal {
    fn from(withdrawal: crate::CryptocurrencyWithdrawal) -> Self {
        match withdrawal {
            crate::CryptocurrencyWithdrawal::ICP(icp) => match icp {
                crate::ICPWithdrawal::Pending(w) => CryptocurrencyWithdrawal::Pending(PendingCryptocurrencyWithdrawal {
                    token: Cryptocurrency::InternetComputer,
                    to: w.to,
                    amount: w.amount,
                    fee: w.fee,
                    memo: w.memo,
                }),
                crate::ICPWithdrawal::Completed(w) => CryptocurrencyWithdrawal::Completed(CompletedCryptocurrencyWithdrawal {
                    token: Cryptocurrency::InternetComputer,
                    to: w.to,
                    amount: w.amount,
                    fee: w.fee,
                    memo: w.memo,
                    block_index: w.block_index,
                    transaction_hash: w.transaction_hash,
                }),
                crate::ICPWithdrawal::Failed(w) => CryptocurrencyWithdrawal::Failed(FailedCryptocurrencyWithdrawal {
                    token: Cryptocurrency::InternetComputer,
                    to: w.to,
                    amount: w.amount,
                    fee: w.fee,
                    memo: w.memo,
                    error_message: w.error_message,
                }),
            },
            _ => unreachable!(),
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

impl From<crate::CryptocurrencyTransfer> for CryptocurrencyTransfer {
    fn from(transfer: crate::CryptocurrencyTransfer) -> Self {
        if let crate::CryptocurrencyTransfer::ICP(icp) = transfer {
            match icp {
                crate::ICPTransfer::Pending(t) => CryptocurrencyTransfer::Pending(PendingCryptocurrencyTransfer {
                    token: Cryptocurrency::InternetComputer,
                    recipient: t.recipient,
                    amount: t.amount,
                    fee: t.fee,
                    memo: t.memo,
                }),
                crate::ICPTransfer::Completed(t) => CryptocurrencyTransfer::Completed(CompletedCryptocurrencyTransfer {
                    token: Cryptocurrency::InternetComputer,
                    sender: t.sender,
                    recipient: t.recipient,
                    amount: t.amount,
                    fee: t.fee,
                    memo: t.memo,
                    block_index: t.block_index,
                    transaction_hash: t.transaction_hash,
                }),
                crate::ICPTransfer::Failed(t) => CryptocurrencyTransfer::Failed(FailedCryptocurrencyTransfer {
                    token: Cryptocurrency::InternetComputer,
                    recipient: t.recipient,
                    amount: t.amount,
                    fee: t.fee,
                    memo: t.memo,
                    error_message: t.error_message,
                }),
            }
        } else {
            unreachable!()
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
