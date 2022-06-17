use crate::{Cryptocurrency, TimestampMillis, TransactionHash, UserId};
use candid::CandidType;
use ic_ledger_types::{AccountIdentifier, BlockIndex, Memo, Tokens, DEFAULT_SUBACCOUNT};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CryptoTransaction {
    Pending(PendingCryptoTransaction),
    Completed(CompletedCryptoTransaction),
    Failed(FailedCryptoTransaction),
}

impl CryptoTransaction {
    pub fn token(&self) -> Cryptocurrency {
        match self {
            CryptoTransaction::Pending(t) => t.token,
            CryptoTransaction::Completed(t) => t.token,
            CryptoTransaction::Failed(t) => t.token,
        }
    }

    pub fn amount(&self) -> Tokens {
        match self {
            CryptoTransaction::Pending(t) => t.amount,
            CryptoTransaction::Completed(t) => t.amount,
            CryptoTransaction::Failed(t) => t.amount,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PendingCryptoTransaction {
    pub token: Cryptocurrency,
    pub amount: Tokens,
    pub to: CryptoAccount,
    pub fee: Option<Tokens>,
    pub memo: Option<Memo>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CompletedCryptoTransaction {
    pub token: Cryptocurrency,
    pub amount: Tokens,
    pub fee: Tokens,
    pub from: CryptoAccountFull,
    pub to: CryptoAccountFull,
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
    pub from: CryptoAccountFull,
    pub to: CryptoAccountFull,
    pub memo: Memo,
    pub created: TimestampMillis,
    pub transaction_hash: TransactionHash,
    pub error_message: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CryptoAccountFull {
    Mint,
    User(UserId, AccountIdentifier),
    UserIndex(AccountIdentifier),
    Named(String, AccountIdentifier),
    Unknown(AccountIdentifier),
}

impl CryptoAccountFull {
    pub fn user(user_id: UserId) -> CryptoAccountFull {
        CryptoAccountFull::User(user_id, AccountIdentifier::new(&user_id.into(), &DEFAULT_SUBACCOUNT))
    }

    pub fn user_id(&self) -> Option<UserId> {
        if let CryptoAccountFull::User(user_id, _) = self {
            Some(*user_id)
        } else {
            None
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CryptoAccount {
    Mint,
    User(UserId),
    Account(AccountIdentifier),
}

impl CryptoAccount {
    pub fn user_id(&self) -> Option<UserId> {
        if let CryptoAccount::User(user_id) = self {
            Some(*user_id)
        } else {
            None
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CryptoTransactionInternal {
    Pending(PendingCryptoTransaction),
    Completed(CompletedCryptoTransactionInternal),
    Failed(FailedCryptoTransactionInternal),
}

impl CryptoTransactionInternal {
    pub fn token(&self) -> Cryptocurrency {
        match self {
            CryptoTransactionInternal::Pending(t) => t.token,
            CryptoTransactionInternal::Completed(t) => t.token,
            CryptoTransactionInternal::Failed(t) => t.token,
        }
    }

    pub fn amount(&self) -> Tokens {
        match self {
            CryptoTransactionInternal::Pending(t) => t.amount,
            CryptoTransactionInternal::Completed(t) => t.amount,
            CryptoTransactionInternal::Failed(t) => t.amount,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CompletedCryptoTransactionInternal {
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
pub struct FailedCryptoTransactionInternal {
    pub token: Cryptocurrency,
    pub amount: Tokens,
    pub fee: Tokens,
    pub from: CryptoAccount,
    pub to: CryptoAccount,
    pub memo: Memo,
    pub created: TimestampMillis,
    pub transaction_hash: TransactionHash,
    pub error: String,
}

impl From<CryptoTransaction> for CryptoTransactionInternal {
    fn from(ct: CryptoTransaction) -> Self {
        match ct {
            CryptoTransaction::Pending(t) => CryptoTransactionInternal::Pending(t),
            CryptoTransaction::Completed(t) => CryptoTransactionInternal::Completed(t.into()),
            CryptoTransaction::Failed(t) => CryptoTransactionInternal::Failed(t.into()),
        }
    }
}

impl From<CompletedCryptoTransaction> for CompletedCryptoTransactionInternal {
    fn from(t: CompletedCryptoTransaction) -> Self {
        CompletedCryptoTransactionInternal {
            token: t.token,
            amount: t.amount,
            fee: t.fee,
            from: t.from.into(),
            to: t.to.into(),
            memo: t.memo,
            created: t.created,
            transaction_hash: t.transaction_hash,
            block_index: t.block_index,
        }
    }
}

impl From<FailedCryptoTransaction> for FailedCryptoTransactionInternal {
    fn from(t: FailedCryptoTransaction) -> Self {
        FailedCryptoTransactionInternal {
            token: t.token,
            amount: t.amount,
            fee: t.fee,
            from: t.from.into(),
            to: t.to.into(),
            memo: t.memo,
            created: t.created,
            transaction_hash: t.transaction_hash,
            error: t.error_message,
        }
    }
}

impl From<CryptoAccountFull> for CryptoAccount {
    fn from(a: CryptoAccountFull) -> Self {
        match a {
            CryptoAccountFull::Mint => CryptoAccount::Mint,
            CryptoAccountFull::User(u, _) => CryptoAccount::User(u),
            CryptoAccountFull::UserIndex(a) | CryptoAccountFull::Named(_, a) | CryptoAccountFull::Unknown(a) => {
                CryptoAccount::Account(a)
            }
        }
    }
}
