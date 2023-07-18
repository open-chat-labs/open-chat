use crate::{CanisterId, TimestampNanos, UserId};
use candid::{CandidType, Principal};
use ic_ledger_types::Subaccount;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug, Eq, PartialEq, Hash)]
pub enum Cryptocurrency {
    InternetComputer,
    SNS1,
    CKBTC,
    CHAT,
    KINIC,
}

impl Cryptocurrency {
    pub const fn token_symbol(&self) -> &'static str {
        match self {
            Cryptocurrency::InternetComputer => "ICP",
            Cryptocurrency::SNS1 => "SNS1",
            Cryptocurrency::CKBTC => "ckBTC",
            Cryptocurrency::CHAT => "CHAT",
            Cryptocurrency::KINIC => "KINIC",
        }
    }

    pub const fn decimals(&self) -> usize {
        match self {
            Cryptocurrency::InternetComputer => 8,
            Cryptocurrency::SNS1 => 8,
            Cryptocurrency::CKBTC => 8,
            Cryptocurrency::CHAT => 8,
            Cryptocurrency::KINIC => 8,
        }
    }

    pub const fn fee(&self) -> u128 {
        match self {
            Cryptocurrency::InternetComputer => 10_000,
            Cryptocurrency::SNS1 => 1_000,
            Cryptocurrency::CKBTC => 10,
            Cryptocurrency::CHAT => 100_000,
            Cryptocurrency::KINIC => 100_000,
        }
    }

    pub fn ledger_canister_id(&self) -> CanisterId {
        match self {
            Cryptocurrency::InternetComputer => Principal::from_text("ryjl3-tyaaa-aaaaa-aaaba-cai").unwrap(),
            Cryptocurrency::SNS1 => Principal::from_text("zfcdd-tqaaa-aaaaq-aaaga-cai").unwrap(),
            Cryptocurrency::CKBTC => Principal::from_text("mxzaz-hqaaa-aaaar-qaada-cai").unwrap(),
            Cryptocurrency::CHAT => Principal::from_text("2ouva-viaaa-aaaaq-aaamq-cai").unwrap(),
            Cryptocurrency::KINIC => Principal::from_text("73mez-iiaaa-aaaaq-aaasq-cai").unwrap(),
        }
    }
}

pub type TransactionHash = [u8; 32];
pub const DEFAULT_SUBACCOUNT: &[u8; 32] = &[0; 32];

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
    ICRC1(icrc1::PendingCryptoTransaction),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CompletedCryptoTransaction {
    NNS(nns::CompletedCryptoTransaction),
    SNS(sns::CompletedCryptoTransaction),
    ICRC1(icrc1::CompletedCryptoTransaction),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum FailedCryptoTransaction {
    NNS(nns::FailedCryptoTransaction),
    SNS(sns::FailedCryptoTransaction),
    ICRC1(icrc1::FailedCryptoTransaction),
}

impl CryptoTransaction {
    pub fn token(&self) -> Cryptocurrency {
        match self {
            CryptoTransaction::Pending(p) => p.token(),
            CryptoTransaction::Completed(c) => c.token(),
            CryptoTransaction::Failed(f) => f.token(),
        }
    }

    pub fn is_zero(&self) -> bool {
        self.units() == 0
    }

    pub fn units(&self) -> u128 {
        match self {
            CryptoTransaction::Pending(p) => p.units(),
            CryptoTransaction::Completed(c) => c.units(),
            CryptoTransaction::Failed(f) => f.units(),
        }
    }
}

impl PendingCryptoTransaction {
    pub fn token(&self) -> Cryptocurrency {
        match self {
            PendingCryptoTransaction::NNS(t) => t.token,
            PendingCryptoTransaction::SNS(t) => t.token,
            PendingCryptoTransaction::ICRC1(t) => t.token,
        }
    }

    pub fn is_zero(&self) -> bool {
        self.units() == 0
    }

    pub fn units(&self) -> u128 {
        match self {
            PendingCryptoTransaction::NNS(t) => t.amount.e8s().into(),
            PendingCryptoTransaction::SNS(t) => t.amount.e8s().into(),
            PendingCryptoTransaction::ICRC1(t) => t.amount,
        }
    }

    pub fn is_user_recipient(&self, user_id: UserId) -> bool {
        match self {
            PendingCryptoTransaction::NNS(t) => match t.to {
                nns::UserOrAccount::User(u) => u == user_id,
                nns::UserOrAccount::Account(a) => {
                    a == ic_ledger_types::AccountIdentifier::new(&user_id.into(), &Subaccount(*DEFAULT_SUBACCOUNT))
                }
            },
            PendingCryptoTransaction::SNS(t) => {
                t.to.owner == user_id.into() && t.to.subaccount.map_or(true, |s| s == *DEFAULT_SUBACCOUNT)
            }
            PendingCryptoTransaction::ICRC1(t) => {
                t.to.owner == user_id.into() && t.to.subaccount.map_or(true, |s| s == *DEFAULT_SUBACCOUNT)
            }
        }
    }
}

impl CompletedCryptoTransaction {
    pub fn token(&self) -> Cryptocurrency {
        match self {
            CompletedCryptoTransaction::NNS(t) => t.token,
            CompletedCryptoTransaction::SNS(t) => t.token,
            CompletedCryptoTransaction::ICRC1(t) => t.token,
        }
    }

    pub fn units(&self) -> u128 {
        match self {
            CompletedCryptoTransaction::NNS(t) => t.amount.e8s().into(),
            CompletedCryptoTransaction::SNS(t) => t.amount.e8s().into(),
            CompletedCryptoTransaction::ICRC1(t) => t.amount,
        }
    }
}

impl FailedCryptoTransaction {
    pub fn token(&self) -> Cryptocurrency {
        match self {
            FailedCryptoTransaction::NNS(t) => t.token,
            FailedCryptoTransaction::SNS(t) => t.token,
            FailedCryptoTransaction::ICRC1(t) => t.token,
        }
    }

    pub fn error_message(&self) -> &str {
        match self {
            FailedCryptoTransaction::NNS(t) => &t.error_message,
            FailedCryptoTransaction::SNS(t) => &t.error_message,
            FailedCryptoTransaction::ICRC1(t) => &t.error_message,
        }
    }

    pub fn units(&self) -> u128 {
        match self {
            FailedCryptoTransaction::NNS(t) => t.amount.e8s().into(),
            FailedCryptoTransaction::SNS(t) => t.amount.e8s().into(),
            FailedCryptoTransaction::ICRC1(t) => t.amount,
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
    #[serde(from = "PendingCryptoTransactionPrevious")]
    pub struct PendingCryptoTransaction {
        pub ledger: CanisterId,
        pub token: Cryptocurrency,
        pub amount: Tokens,
        pub to: UserOrAccount,
        pub fee: Option<Tokens>,
        pub memo: Option<Memo>,
        pub created: TimestampNanos,
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    // #[serde(from = "CompletedCryptoTransactionPrevious")]
    pub struct CompletedCryptoTransaction {
        // pub ledger: CanisterId,
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
    // #[serde(from = "FailedCryptoTransactionPrevious")]
    pub struct FailedCryptoTransaction {
        // pub ledger: CanisterId,
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

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct PendingCryptoTransactionPrevious {
        pub token: Cryptocurrency,
        pub amount: Tokens,
        pub to: UserOrAccount,
        pub fee: Option<Tokens>,
        pub memo: Option<Memo>,
        pub created: TimestampNanos,
    }

    // #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    // pub struct CompletedCryptoTransactionPrevious {
    //     pub token: Cryptocurrency,
    //     pub amount: Tokens,
    //     pub fee: Tokens,
    //     pub from: CryptoAccount,
    //     pub to: CryptoAccount,
    //     pub memo: Memo,
    //     pub created: TimestampNanos,
    //     pub transaction_hash: TransactionHash,
    //     pub block_index: BlockIndex,
    // }
    //
    // #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    // pub struct FailedCryptoTransactionPrevious {
    //     pub token: Cryptocurrency,
    //     pub amount: Tokens,
    //     pub fee: Tokens,
    //     pub from: CryptoAccount,
    //     pub to: CryptoAccount,
    //     pub memo: Memo,
    //     pub created: TimestampNanos,
    //     pub transaction_hash: TransactionHash,
    //     pub error_message: String,
    // }

    impl From<PendingCryptoTransactionPrevious> for PendingCryptoTransaction {
        fn from(value: PendingCryptoTransactionPrevious) -> Self {
            PendingCryptoTransaction {
                ledger: value.token.ledger_canister_id(),
                token: value.token,
                amount: value.amount,
                to: value.to,
                fee: value.fee,
                memo: value.memo,
                created: value.created,
            }
        }
    }

    // impl From<CompletedCryptoTransactionPrevious> for CompletedCryptoTransaction {
    //     fn from(value: CompletedCryptoTransactionPrevious) -> Self {
    //         CompletedCryptoTransaction {
    //             ledger: value.token.ledger_canister_id(),
    //             token: value.token,
    //             amount: value.amount,
    //             from: value.from,
    //             to: value.to,
    //             fee: value.fee,
    //             memo: value.memo,
    //             created: value.created,
    //             transaction_hash: value.transaction_hash,
    //             block_index: value.block_index,
    //         }
    //     }
    // }
    //
    // impl From<FailedCryptoTransactionPrevious> for FailedCryptoTransaction {
    //     fn from(value: FailedCryptoTransactionPrevious) -> Self {
    //         FailedCryptoTransaction {
    //             ledger: value.token.ledger_canister_id(),
    //             token: value.token,
    //             amount: value.amount,
    //             fee: value.fee,
    //             from: value.from,
    //             to: value.to,
    //             memo: value.memo,
    //             created: value.created,
    //             transaction_hash: value.transaction_hash,
    //             error_message: value.error_message,
    //         }
    //     }
    // }
}

pub mod sns {
    use super::*;
    use ic_ledger_types::{BlockIndex, Memo, Tokens};

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub enum CryptoAccount {
        Mint,
        Account(Account),
    }

    pub type Account = icrc1::Account;

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    #[serde(from = "PendingCryptoTransactionPrevious")]
    pub struct PendingCryptoTransaction {
        pub ledger: CanisterId,
        pub token: Cryptocurrency,
        pub amount: Tokens,
        pub to: Account,
        pub fee: Tokens,
        pub memo: Option<Memo>,
        pub created: TimestampNanos,
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    // #[serde(from = "CompletedCryptoTransactionPrevious")]
    pub struct CompletedCryptoTransaction {
        // pub ledger: CanisterId,
        pub token: Cryptocurrency,
        pub amount: Tokens,
        pub fee: Tokens,
        pub from: CryptoAccount,
        pub to: CryptoAccount,
        pub memo: Option<Memo>,
        pub created: TimestampNanos,
        #[serde(default)]
        pub transaction_hash: TransactionHash,
        pub block_index: BlockIndex,
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    // #[serde(from = "FailedCryptoTransactionPrevious")]
    pub struct FailedCryptoTransaction {
        // pub ledger: CanisterId,
        pub token: Cryptocurrency,
        pub amount: Tokens,
        pub fee: Tokens,
        pub from: CryptoAccount,
        pub to: CryptoAccount,
        pub memo: Option<Memo>,
        pub created: TimestampNanos,
        #[serde(default)]
        pub transaction_hash: TransactionHash,
        pub error_message: String,
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct PendingCryptoTransactionPrevious {
        pub token: Cryptocurrency,
        pub amount: Tokens,
        pub to: Account,
        pub fee: Tokens,
        pub memo: Option<Memo>,
        pub created: TimestampNanos,
    }

    // #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    // pub struct CompletedCryptoTransactionPrevious {
    //     pub token: Cryptocurrency,
    //     pub amount: Tokens,
    //     pub fee: Tokens,
    //     pub from: CryptoAccount,
    //     pub to: CryptoAccount,
    //     pub memo: Option<Memo>,
    //     pub created: TimestampNanos,
    //     pub transaction_hash: TransactionHash,
    //     pub block_index: BlockIndex,
    // }
    //
    // #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    // pub struct FailedCryptoTransactionPrevious {
    //     pub token: Cryptocurrency,
    //     pub amount: Tokens,
    //     pub fee: Tokens,
    //     pub from: CryptoAccount,
    //     pub to: CryptoAccount,
    //     pub memo: Option<Memo>,
    //     pub created: TimestampNanos,
    //     pub transaction_hash: TransactionHash,
    //     pub error_message: String,
    // }

    impl From<PendingCryptoTransactionPrevious> for PendingCryptoTransaction {
        fn from(value: PendingCryptoTransactionPrevious) -> Self {
            PendingCryptoTransaction {
                ledger: value.token.ledger_canister_id(),
                token: value.token,
                amount: value.amount,
                to: value.to,
                fee: value.fee,
                memo: value.memo,
                created: value.created,
            }
        }
    }

    // impl From<CompletedCryptoTransactionPrevious> for CompletedCryptoTransaction {
    //     fn from(value: CompletedCryptoTransactionPrevious) -> Self {
    //         CompletedCryptoTransaction {
    //             ledger: value.token.ledger_canister_id(),
    //             token: value.token,
    //             amount: value.amount,
    //             from: value.from,
    //             to: value.to,
    //             fee: value.fee,
    //             memo: value.memo,
    //             created: value.created,
    //             transaction_hash: value.transaction_hash,
    //             block_index: value.block_index,
    //         }
    //     }
    // }
    //
    // impl From<FailedCryptoTransactionPrevious> for FailedCryptoTransaction {
    //     fn from(value: FailedCryptoTransactionPrevious) -> Self {
    //         FailedCryptoTransaction {
    //             ledger: value.token.ledger_canister_id(),
    //             token: value.token,
    //             amount: value.amount,
    //             fee: value.fee,
    //             from: value.from,
    //             to: value.to,
    //             memo: value.memo,
    //             created: value.created,
    //             transaction_hash: value.transaction_hash,
    //             error_message: value.error_message,
    //         }
    //     }
    // }
}

pub mod icrc1 {
    use super::*;
    use candid::Nat;
    use serde_bytes::ByteBuf;

    pub type Subaccount = [u8; 32];

    // Account representation of ledgers supporting the ICRC1 standard
    #[derive(Serialize, CandidType, Deserialize, Clone, Debug, Copy)]
    pub struct Account {
        pub owner: Principal,
        pub subaccount: Option<Subaccount>,
    }

    impl From<Principal> for Account {
        fn from(value: Principal) -> Self {
            Account {
                owner: value,
                subaccount: None,
            }
        }
    }

    #[derive(Serialize, Deserialize, CandidType, Clone, Debug, Default)]
    #[serde(transparent)]
    pub struct Memo(pub ByteBuf);

    impl From<u64> for Memo {
        fn from(num: u64) -> Self {
            Self(ByteBuf::from(num.to_be_bytes().to_vec()))
        }
    }

    impl From<ByteBuf> for Memo {
        fn from(b: ByteBuf) -> Self {
            Self(b)
        }
    }

    impl From<Vec<u8>> for Memo {
        fn from(v: Vec<u8>) -> Self {
            Self::from(ByteBuf::from(v))
        }
    }

    impl From<Memo> for ByteBuf {
        fn from(memo: Memo) -> Self {
            memo.0
        }
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub enum CryptoAccount {
        Mint,
        Account(Account),
    }

    pub type NumTokens = Nat;
    pub type BlockIndex = Nat;

    #[derive(CandidType, Deserialize, Clone, Debug)]
    pub struct TransferArg {
        #[serde(default)]
        pub from_subaccount: Option<Subaccount>,
        pub to: Account,
        #[serde(default)]
        pub fee: Option<NumTokens>,
        #[serde(default)]
        pub created_at_time: Option<u64>,
        #[serde(default)]
        pub memo: Option<Memo>,
        pub amount: NumTokens,
    }

    #[derive(CandidType, Deserialize, Clone, Debug)]
    pub enum TransferError {
        BadFee { expected_fee: NumTokens },
        BadBurn { min_burn_amount: NumTokens },
        InsufficientFunds { balance: NumTokens },
        TooOld,
        CreatedInFuture { ledger_time: u64 },
        TemporarilyUnavailable,
        Duplicate { duplicate_of: BlockIndex },
        GenericError { error_code: Nat, message: String },
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    #[serde(from = "PendingCryptoTransactionPrevious")]
    pub struct PendingCryptoTransaction {
        pub ledger: CanisterId,
        pub token: Cryptocurrency,
        pub amount: u128,
        pub to: Account,
        pub fee: u128,
        pub memo: Option<Memo>,
        pub created: TimestampNanos,
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    // #[serde(from = "CompletedCryptoTransactionPrevious")]
    pub struct CompletedCryptoTransaction {
        // pub ledger: CanisterId,
        pub token: Cryptocurrency,
        pub amount: u128,
        pub from: CryptoAccount,
        pub to: CryptoAccount,
        pub fee: u128,
        pub memo: Option<Memo>,
        pub created: TimestampNanos,
        pub block_index: u64,
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    // #[serde(from = "FailedCryptoTransactionPrevious")]
    pub struct FailedCryptoTransaction {
        // pub ledger: CanisterId,
        pub token: Cryptocurrency,
        pub amount: u128,
        pub fee: u128,
        pub from: CryptoAccount,
        pub to: CryptoAccount,
        pub memo: Option<Memo>,
        pub created: TimestampNanos,
        pub error_message: String,
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct PendingCryptoTransactionPrevious {
        pub token: Cryptocurrency,
        pub amount: u128,
        pub to: Account,
        pub fee: u128,
        pub memo: Option<Memo>,
        pub created: TimestampNanos,
    }

    // #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    // pub struct CompletedCryptoTransactionPrevious {
    //     pub token: Cryptocurrency,
    //     pub amount: u128,
    //     pub from: CryptoAccount,
    //     pub to: CryptoAccount,
    //     pub fee: u128,
    //     pub memo: Option<Memo>,
    //     pub created: TimestampNanos,
    //     pub block_index: u64,
    // }
    //
    // #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    // pub struct FailedCryptoTransactionPrevious {
    //     pub token: Cryptocurrency,
    //     pub amount: u128,
    //     pub fee: u128,
    //     pub from: CryptoAccount,
    //     pub to: CryptoAccount,
    //     pub memo: Option<Memo>,
    //     pub created: TimestampNanos,
    //     pub error_message: String,
    // }

    impl From<PendingCryptoTransactionPrevious> for PendingCryptoTransaction {
        fn from(value: PendingCryptoTransactionPrevious) -> Self {
            PendingCryptoTransaction {
                ledger: value.token.ledger_canister_id(),
                token: value.token,
                amount: value.amount,
                to: value.to,
                fee: value.fee,
                memo: value.memo,
                created: value.created,
            }
        }
    }

    // impl From<CompletedCryptoTransactionPrevious> for CompletedCryptoTransaction {
    //     fn from(value: CompletedCryptoTransactionPrevious) -> Self {
    //         CompletedCryptoTransaction {
    //             ledger: value.token.ledger_canister_id(),
    //             token: value.token,
    //             amount: value.amount,
    //             from: value.from,
    //             to: value.to,
    //             fee: value.fee,
    //             memo: value.memo,
    //             created: value.created,
    //             block_index: value.block_index,
    //         }
    //     }
    // }
    //
    // impl From<FailedCryptoTransactionPrevious> for FailedCryptoTransaction {
    //     fn from(value: FailedCryptoTransactionPrevious) -> Self {
    //         FailedCryptoTransaction {
    //             ledger: value.token.ledger_canister_id(),
    //             token: value.token,
    //             amount: value.amount,
    //             fee: value.fee,
    //             from: value.from,
    //             to: value.to,
    //             memo: value.memo,
    //             created: value.created,
    //             error_message: value.error_message,
    //         }
    //     }
    // }
}
