use crate::{CanisterId, TimestampNanos, UserId};
use candid::{CandidType, Principal};
use ic_ledger_types::Subaccount;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq, Hash)]
pub enum Cryptocurrency {
    InternetComputer,
    SNS1,
    CKBTC,
    CHAT,
    KINIC,
    Other(String),
}

impl Cryptocurrency {
    pub fn token_symbol(&self) -> &str {
        match self {
            Cryptocurrency::InternetComputer => "ICP",
            Cryptocurrency::SNS1 => "SNS1",
            Cryptocurrency::CKBTC => "ckBTC",
            Cryptocurrency::CHAT => "CHAT",
            Cryptocurrency::KINIC => "KINIC",
            Cryptocurrency::Other(symbol) => symbol,
        }
    }

    pub fn decimals(&self) -> Option<usize> {
        match self {
            Cryptocurrency::InternetComputer => Some(8),
            Cryptocurrency::SNS1 => Some(8),
            Cryptocurrency::CKBTC => Some(8),
            Cryptocurrency::CHAT => Some(8),
            Cryptocurrency::KINIC => Some(8),
            Cryptocurrency::Other(_) => None,
        }
    }

    pub fn fee(&self) -> Option<u128> {
        match self {
            Cryptocurrency::InternetComputer => Some(10_000),
            Cryptocurrency::SNS1 => Some(1_000),
            Cryptocurrency::CKBTC => Some(10),
            Cryptocurrency::CHAT => Some(100_000),
            Cryptocurrency::KINIC => Some(100_000),
            Cryptocurrency::Other(_) => None,
        }
    }

    pub fn ledger_canister_id(&self) -> Option<CanisterId> {
        match self {
            Cryptocurrency::InternetComputer => Some(Principal::from_text("ryjl3-tyaaa-aaaaa-aaaba-cai").unwrap()),
            Cryptocurrency::SNS1 => Some(Principal::from_text("zfcdd-tqaaa-aaaaq-aaaga-cai").unwrap()),
            Cryptocurrency::CKBTC => Some(Principal::from_text("mxzaz-hqaaa-aaaar-qaada-cai").unwrap()),
            Cryptocurrency::CHAT => Some(Principal::from_text("2ouva-viaaa-aaaaq-aaamq-cai").unwrap()),
            Cryptocurrency::KINIC => Some(Principal::from_text("73mez-iiaaa-aaaaq-aaasq-cai").unwrap()),
            Cryptocurrency::Other(_) => None,
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
    ICRC1(icrc1::PendingCryptoTransaction),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
#[serde(from = "CompletedCryptoTransactionPrevious")]
pub enum CompletedCryptoTransaction {
    NNS(nns::CompletedCryptoTransaction),
    ICRC1(icrc1::CompletedCryptoTransaction),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CompletedCryptoTransactionPrevious {
    NNS(nns::CompletedCryptoTransaction),
    SNS(sns::CompletedCryptoTransaction),
    ICRC1(icrc1::CompletedCryptoTransaction),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum FailedCryptoTransaction {
    NNS(nns::FailedCryptoTransaction),
    ICRC1(icrc1::FailedCryptoTransaction),
}

impl CryptoTransaction {
    pub fn ledger_canister_id(&self) -> CanisterId {
        match self {
            CryptoTransaction::Pending(p) => p.ledger_canister_id(),
            CryptoTransaction::Completed(c) => c.ledger_canister_id(),
            CryptoTransaction::Failed(f) => f.ledger_canister_id(),
        }
    }

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
    pub fn ledger_canister_id(&self) -> CanisterId {
        match self {
            PendingCryptoTransaction::NNS(t) => t.ledger,
            PendingCryptoTransaction::ICRC1(t) => t.ledger,
        }
    }

    pub fn token(&self) -> Cryptocurrency {
        match self {
            PendingCryptoTransaction::NNS(t) => t.token.clone(),
            PendingCryptoTransaction::ICRC1(t) => t.token.clone(),
        }
    }

    pub fn is_zero(&self) -> bool {
        self.units() == 0
    }

    pub fn units(&self) -> u128 {
        match self {
            PendingCryptoTransaction::NNS(t) => t.amount.e8s().into(),
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
            PendingCryptoTransaction::ICRC1(t) => {
                t.to.owner == user_id.into() && t.to.subaccount.map_or(true, |s| s == *DEFAULT_SUBACCOUNT)
            }
        }
    }
}

impl CompletedCryptoTransaction {
    pub fn ledger_canister_id(&self) -> CanisterId {
        match self {
            CompletedCryptoTransaction::NNS(t) => t.ledger,
            CompletedCryptoTransaction::ICRC1(t) => t.ledger,
        }
    }

    pub fn token(&self) -> Cryptocurrency {
        match self {
            CompletedCryptoTransaction::NNS(t) => t.token.clone(),
            CompletedCryptoTransaction::ICRC1(t) => t.token.clone(),
        }
    }

    pub fn units(&self) -> u128 {
        match self {
            CompletedCryptoTransaction::NNS(t) => t.amount.e8s().into(),
            CompletedCryptoTransaction::ICRC1(t) => t.amount,
        }
    }
}

impl FailedCryptoTransaction {
    pub fn ledger_canister_id(&self) -> CanisterId {
        match self {
            FailedCryptoTransaction::NNS(t) => t.ledger,
            FailedCryptoTransaction::ICRC1(t) => t.ledger,
        }
    }

    pub fn token(&self) -> Cryptocurrency {
        match self {
            FailedCryptoTransaction::NNS(t) => t.token.clone(),
            FailedCryptoTransaction::ICRC1(t) => t.token.clone(),
        }
    }

    pub fn error_message(&self) -> &str {
        match self {
            FailedCryptoTransaction::NNS(t) => &t.error_message,
            FailedCryptoTransaction::ICRC1(t) => &t.error_message,
        }
    }

    pub fn units(&self) -> u128 {
        match self {
            FailedCryptoTransaction::NNS(t) => t.amount.e8s().into(),
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
    pub struct CompletedCryptoTransaction {
        pub ledger: CanisterId,
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
        pub ledger: CanisterId,
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
    use ic_ledger_types::{BlockIndex, Memo, Tokens};

    pub type CryptoAccount = icrc1::CryptoAccount;
    pub type Account = icrc1::Account;

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct CompletedCryptoTransaction {
        pub ledger: CanisterId,
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
    pub struct CompletedCryptoTransaction {
        pub ledger: CanisterId,
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
    pub struct FailedCryptoTransaction {
        pub ledger: CanisterId,
        pub token: Cryptocurrency,
        pub amount: u128,
        pub fee: u128,
        pub from: CryptoAccount,
        pub to: CryptoAccount,
        pub memo: Option<Memo>,
        pub created: TimestampNanos,
        pub error_message: String,
    }
}

impl From<CompletedCryptoTransactionPrevious> for CompletedCryptoTransaction {
    fn from(value: CompletedCryptoTransactionPrevious) -> Self {
        match value {
            CompletedCryptoTransactionPrevious::NNS(t) => CompletedCryptoTransaction::NNS(t),
            CompletedCryptoTransactionPrevious::SNS(t) => CompletedCryptoTransaction::ICRC1(t.into()),
            CompletedCryptoTransactionPrevious::ICRC1(t) => CompletedCryptoTransaction::ICRC1(t),
        }
    }
}

impl From<sns::CompletedCryptoTransaction> for icrc1::CompletedCryptoTransaction {
    fn from(value: sns::CompletedCryptoTransaction) -> Self {
        icrc1::CompletedCryptoTransaction {
            ledger: value.ledger,
            token: value.token,
            amount: value.amount.e8s() as u128,
            from: value.from,
            to: value.to,
            fee: value.fee.e8s() as u128,
            memo: value.memo.map(|m| m.0.into()),
            created: value.created,
            block_index: value.block_index,
        }
    }
}
