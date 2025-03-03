#![allow(deprecated)]
use crate::nns::{Tokens, UserOrAccount};
use crate::{CanisterId, TimestampNanos, UserId};
use candid::{CandidType, Principal};
use ic_ledger_types::{AccountIdentifier, Subaccount};
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

const ICP_FEE: u128 = 10_000;

#[deprecated]
#[ts_export]
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
}

#[allow(deprecated)]
impl From<String> for Cryptocurrency {
    fn from(value: String) -> Self {
        match value.as_str() {
            "ICP" => Cryptocurrency::InternetComputer,
            "ckBTC" => Cryptocurrency::CKBTC,
            "CHAT" => Cryptocurrency::CHAT,
            "KINIC" => Cryptocurrency::KINIC,
            _ => Cryptocurrency::Other(value),
        }
    }
}

pub type TransactionHash = [u8; 32];

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CryptoTransaction {
    Pending(PendingCryptoTransaction),
    Completed(CompletedCryptoTransaction),
    Failed(FailedCryptoTransaction),
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum PendingCryptoTransaction {
    NNS(nns::PendingCryptoTransaction),
    ICRC1(icrc1::PendingCryptoTransaction),
    ICRC2(icrc2::PendingCryptoTransaction),
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CompletedCryptoTransaction {
    NNS(nns::CompletedCryptoTransaction),
    ICRC1(icrc1::CompletedCryptoTransaction),
    ICRC2(icrc2::CompletedCryptoTransaction),
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum FailedCryptoTransaction {
    NNS(nns::FailedCryptoTransaction),
    ICRC1(icrc1::FailedCryptoTransaction),
    ICRC2(icrc2::FailedCryptoTransaction),
}

impl CryptoTransaction {
    pub fn ledger_canister_id(&self) -> CanisterId {
        match self {
            CryptoTransaction::Pending(p) => p.ledger_canister_id(),
            CryptoTransaction::Completed(c) => c.ledger_canister_id(),
            CryptoTransaction::Failed(f) => f.ledger_canister_id(),
        }
    }

    pub fn token_symbol(&self) -> &str {
        match self {
            CryptoTransaction::Pending(p) => p.token_symbol(),
            CryptoTransaction::Completed(c) => c.token_symbol(),
            CryptoTransaction::Failed(f) => f.token_symbol(),
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

    pub fn fee(&self) -> u128 {
        match self {
            CryptoTransaction::Pending(p) => p.fee(),
            CryptoTransaction::Completed(c) => c.fee(),
            CryptoTransaction::Failed(f) => f.fee(),
        }
    }
}

impl PendingCryptoTransaction {
    pub fn ledger_canister_id(&self) -> CanisterId {
        match self {
            PendingCryptoTransaction::NNS(t) => t.ledger,
            PendingCryptoTransaction::ICRC1(t) => t.ledger,
            PendingCryptoTransaction::ICRC2(t) => t.ledger,
        }
    }

    pub fn token_symbol(&self) -> &str {
        match self {
            PendingCryptoTransaction::NNS(t) => t.token_symbol.as_str(),
            PendingCryptoTransaction::ICRC1(t) => t.token_symbol.as_str(),
            PendingCryptoTransaction::ICRC2(t) => t.token_symbol.as_str(),
        }
    }

    pub fn is_zero(&self) -> bool {
        self.units() == 0
    }

    pub fn units(&self) -> u128 {
        match self {
            PendingCryptoTransaction::NNS(t) => t.amount.e8s().into(),
            PendingCryptoTransaction::ICRC1(t) => t.amount,
            PendingCryptoTransaction::ICRC2(t) => t.amount,
        }
    }

    pub fn fee(&self) -> u128 {
        match self {
            PendingCryptoTransaction::NNS(_) => ICP_FEE,
            PendingCryptoTransaction::ICRC1(t) => t.fee,
            PendingCryptoTransaction::ICRC2(t) => t.fee,
        }
    }

    pub fn user_id(&self) -> Option<UserId> {
        match self {
            PendingCryptoTransaction::NNS(t) => {
                if let UserOrAccount::User(u) = t.to {
                    Some(u)
                } else {
                    None
                }
            }
            PendingCryptoTransaction::ICRC1(t) => {
                if t.to.subaccount.unwrap_or_default() == [0; 32] {
                    Some(t.to.owner.into())
                } else {
                    None
                }
            }
            PendingCryptoTransaction::ICRC2(t) => {
                if t.to.subaccount.unwrap_or_default() == ic_ledger_types::DEFAULT_SUBACCOUNT.0 {
                    Some(t.to.owner.into())
                } else {
                    None
                }
            }
        }
    }

    pub fn validate_recipient(&self, recipient: UserId) -> bool {
        match self {
            PendingCryptoTransaction::NNS(t) => match t.to {
                UserOrAccount::Account(a) => {
                    a == AccountIdentifier::new(&recipient.into(), &ic_ledger_types::DEFAULT_SUBACCOUNT)
                }
                UserOrAccount::User(u) => u == recipient,
            },
            PendingCryptoTransaction::ICRC1(t) => t.to.owner == recipient.into(),
            PendingCryptoTransaction::ICRC2(t) => t.to.owner == recipient.into(),
        }
    }

    pub fn set_recipient(&mut self, owner: Principal, subaccount: Subaccount) {
        match self {
            PendingCryptoTransaction::NNS(t) => t.to = UserOrAccount::Account(AccountIdentifier::new(&owner, &subaccount)),
            PendingCryptoTransaction::ICRC1(t) => {
                t.to.owner = owner;
                t.to.subaccount = Some(subaccount.0)
            }
            PendingCryptoTransaction::ICRC2(t) => {
                t.to.owner = owner;
                t.to.subaccount = Some(subaccount.0)
            }
        }
    }

    pub fn created(&self) -> TimestampNanos {
        match self {
            PendingCryptoTransaction::NNS(t) => t.created,
            PendingCryptoTransaction::ICRC1(t) => t.created,
            PendingCryptoTransaction::ICRC2(t) => t.created,
        }
    }

    pub fn set_created(&mut self, created: TimestampNanos) {
        match self {
            PendingCryptoTransaction::NNS(t) => t.created = created,
            PendingCryptoTransaction::ICRC1(t) => t.created = created,
            PendingCryptoTransaction::ICRC2(t) => t.created = created,
        }
    }

    pub fn set_memo(mut self, memo: &[u8]) -> Self {
        match &mut self {
            PendingCryptoTransaction::NNS(t) => {
                t.memo = Some(u64_from_bytes(memo));
            }
            PendingCryptoTransaction::ICRC1(t) => {
                assert!(memo.len() <= 32);
                t.memo = Some(memo.to_vec().into());
            }
            PendingCryptoTransaction::ICRC2(t) => {
                assert!(memo.len() <= 32);
                t.memo = Some(memo.to_vec().into());
            }
        }
        self
    }
}

impl CompletedCryptoTransaction {
    pub fn ledger_canister_id(&self) -> CanisterId {
        match self {
            CompletedCryptoTransaction::NNS(t) => t.ledger,
            CompletedCryptoTransaction::ICRC1(t) => t.ledger,
            CompletedCryptoTransaction::ICRC2(t) => t.ledger,
        }
    }

    pub fn token_symbol(&self) -> &str {
        match self {
            CompletedCryptoTransaction::NNS(t) => t.token.token_symbol(),
            CompletedCryptoTransaction::ICRC1(t) => t.token.token_symbol(),
            CompletedCryptoTransaction::ICRC2(t) => t.token.token_symbol(),
        }
    }

    pub fn units(&self) -> u128 {
        match self {
            CompletedCryptoTransaction::NNS(t) => t.amount.e8s().into(),
            CompletedCryptoTransaction::ICRC1(t) => t.amount,
            CompletedCryptoTransaction::ICRC2(t) => t.amount,
        }
    }

    pub fn fee(&self) -> u128 {
        match self {
            CompletedCryptoTransaction::NNS(_) => ICP_FEE,
            CompletedCryptoTransaction::ICRC1(t) => t.fee,
            CompletedCryptoTransaction::ICRC2(t) => t.fee,
        }
    }

    pub fn index(&self) -> u64 {
        match self {
            CompletedCryptoTransaction::NNS(t) => t.block_index,
            CompletedCryptoTransaction::ICRC1(t) => t.block_index,
            CompletedCryptoTransaction::ICRC2(t) => t.block_index,
        }
    }
}

impl FailedCryptoTransaction {
    pub fn ledger_canister_id(&self) -> CanisterId {
        match self {
            FailedCryptoTransaction::NNS(t) => t.ledger,
            FailedCryptoTransaction::ICRC1(t) => t.ledger,
            FailedCryptoTransaction::ICRC2(t) => t.ledger,
        }
    }

    pub fn token_symbol(&self) -> &str {
        match self {
            FailedCryptoTransaction::NNS(t) => t.token.token_symbol(),
            FailedCryptoTransaction::ICRC1(t) => t.token.token_symbol(),
            FailedCryptoTransaction::ICRC2(t) => t.token.token_symbol(),
        }
    }

    pub fn error_message(&self) -> &str {
        match self {
            FailedCryptoTransaction::NNS(t) => &t.error_message,
            FailedCryptoTransaction::ICRC1(t) => &t.error_message,
            FailedCryptoTransaction::ICRC2(t) => &t.error_message,
        }
    }

    pub fn units(&self) -> u128 {
        match self {
            FailedCryptoTransaction::NNS(t) => t.amount.e8s().into(),
            FailedCryptoTransaction::ICRC1(t) => t.amount,
            FailedCryptoTransaction::ICRC2(t) => t.amount,
        }
    }

    pub fn fee(&self) -> u128 {
        match self {
            FailedCryptoTransaction::NNS(_) => ICP_FEE,
            FailedCryptoTransaction::ICRC1(t) => t.fee,
            FailedCryptoTransaction::ICRC2(t) => t.fee,
        }
    }
}

pub mod nns {
    use super::*;
    use ic_ledger_types::AccountIdentifier;

    #[ts_export]
    #[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
    pub struct Tokens {
        e8s: u64,
    }

    impl Tokens {
        pub const fn from_e8s(e8s: u64) -> Self {
            Self { e8s }
        }

        pub const fn e8s(&self) -> u64 {
            self.e8s
        }

        pub const DEFAULT_FEE: Tokens = Tokens { e8s: 10_000 };
    }

    impl From<Tokens> for ic_ledger_types::Tokens {
        fn from(value: Tokens) -> Self {
            ic_ledger_types::Tokens::from_e8s(value.e8s)
        }
    }

    impl From<ic_ledger_types::Tokens> for Tokens {
        fn from(value: ic_ledger_types::Tokens) -> Self {
            Tokens::from_e8s(value.e8s())
        }
    }

    #[ts_export]
    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    #[ts(rename = "AccountNNS")]
    pub struct Account {
        pub owner: Principal,
        #[ts(as = "Option<[u8; 32]>")]
        pub subaccount: Option<Subaccount>,
    }

    #[ts_export]
    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct CryptoAmount {
        pub token: Cryptocurrency,
        pub amount: Tokens,
    }

    #[ts_export]
    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    #[ts(rename = "CryptoAccountNNS")]
    pub enum CryptoAccount {
        Mint,
        Account(#[ts(as = "[u8; 32]")] AccountIdentifier),
    }

    #[ts_export]
    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub enum UserOrAccount {
        User(UserId),
        Account(#[ts(as = "[u8; 32]")] AccountIdentifier),
    }

    #[ts_export]
    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    #[serde(from = "PendingCryptoTransactionCombined")]
    #[ts(rename = "PendingCryptoTransactionNNS")]
    pub struct PendingCryptoTransaction {
        pub ledger: CanisterId,
        pub token_symbol: String,
        pub token: Cryptocurrency,
        pub amount: Tokens,
        pub to: UserOrAccount,
        pub fee: Option<Tokens>,
        pub memo: Option<u64>,
        pub created: TimestampNanos,
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    struct PendingCryptoTransactionCombined {
        ledger: CanisterId,
        token_symbol: Option<String>,
        token: Option<Cryptocurrency>,
        amount: Tokens,
        to: UserOrAccount,
        fee: Option<Tokens>,
        memo: Option<u64>,
        created: TimestampNanos,
    }

    impl From<PendingCryptoTransactionCombined> for PendingCryptoTransaction {
        fn from(value: PendingCryptoTransactionCombined) -> Self {
            let token_symbol = value
                .token_symbol
                .unwrap_or_else(|| value.token.unwrap().token_symbol().to_string());

            PendingCryptoTransaction {
                ledger: value.ledger,
                token_symbol: token_symbol.clone(),
                token: token_symbol.into(),
                amount: value.amount,
                to: value.to,
                fee: value.fee,
                memo: value.memo,
                created: value.created,
            }
        }
    }

    #[ts_export]
    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    #[ts(rename = "CompletedCryptoTransactionNNS")]
    pub struct CompletedCryptoTransaction {
        pub ledger: CanisterId,
        pub token: Cryptocurrency,
        pub amount: Tokens,
        pub fee: Tokens,
        pub from: CryptoAccount,
        pub to: CryptoAccount,
        pub memo: u64,
        pub created: TimestampNanos,
        #[serde(default)]
        pub transaction_hash: TransactionHash,
        pub block_index: u64,
    }

    #[ts_export]
    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    #[ts(rename = "FailedCryptoTransactionNNS")]
    pub struct FailedCryptoTransaction {
        pub ledger: CanisterId,
        pub token: Cryptocurrency,
        pub amount: Tokens,
        pub fee: Tokens,
        pub from: CryptoAccount,
        pub to: CryptoAccount,
        pub memo: u64,
        pub created: TimestampNanos,
        #[serde(default)]
        pub transaction_hash: TransactionHash,
        pub error_message: String,
    }
}

pub mod icrc1 {
    use super::*;
    use icrc_ledger_types::icrc1::transfer::Memo;

    #[ts_export]
    #[derive(CandidType, Serialize, Deserialize, Clone, Debug, Copy)]
    #[ts(rename = "AccountICRC1")]
    pub struct Account {
        pub owner: Principal,
        pub subaccount: Option<[u8; 32]>,
    }

    impl<T: Into<Principal>> From<T> for Account {
        fn from(value: T) -> Self {
            Account {
                owner: value.into(),
                subaccount: None,
            }
        }
    }

    impl From<Account> for icrc_ledger_types::icrc1::account::Account {
        fn from(value: Account) -> Self {
            icrc_ledger_types::icrc1::account::Account {
                owner: value.owner,
                subaccount: value.subaccount,
            }
        }
    }

    #[ts_export]
    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    #[ts(rename = "CryptoAccountICRC1")]
    pub enum CryptoAccount {
        Mint,
        Account(Account),
    }

    #[ts_export]
    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    #[serde(from = "PendingCryptoTransactionCombined")]
    #[ts(rename = "PendingCryptoTransactionICRC1")]
    pub struct PendingCryptoTransaction {
        pub ledger: CanisterId,
        pub token_symbol: String,
        pub token: Cryptocurrency,
        pub amount: u128,
        pub to: Account,
        pub fee: u128,
        #[ts(as = "Option::<ts_export::TSBytes>")]
        pub memo: Option<Memo>,
        pub created: TimestampNanos,
    }

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    struct PendingCryptoTransactionCombined {
        ledger: CanisterId,
        token: Option<Cryptocurrency>,
        token_symbol: Option<String>,
        amount: u128,
        to: Account,
        fee: u128,
        memo: Option<Memo>,
        created: TimestampNanos,
    }

    impl From<PendingCryptoTransactionCombined> for PendingCryptoTransaction {
        fn from(value: PendingCryptoTransactionCombined) -> Self {
            let token_symbol = value
                .token_symbol
                .unwrap_or_else(|| value.token.unwrap().token_symbol().to_string());

            PendingCryptoTransaction {
                ledger: value.ledger,
                token_symbol: token_symbol.clone(),
                token: token_symbol.into(),
                amount: value.amount,
                to: value.to,
                fee: value.fee,
                memo: value.memo,
                created: value.created,
            }
        }
    }

    #[ts_export]
    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    #[ts(rename = "CompletedCryptoTransactionICRC1")]
    pub struct CompletedCryptoTransaction {
        pub ledger: CanisterId,
        pub token: Cryptocurrency,
        pub amount: u128,
        pub from: CryptoAccount,
        pub to: CryptoAccount,
        pub fee: u128,
        #[ts(as = "Option::<ts_export::TSBytes>")]
        pub memo: Option<Memo>,
        pub created: TimestampNanos,
        pub block_index: u64,
    }

    #[ts_export]
    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    #[ts(rename = "FailedCryptoTransactionICRC1")]
    pub struct FailedCryptoTransaction {
        pub ledger: CanisterId,
        pub token: Cryptocurrency,
        pub amount: u128,
        pub fee: u128,
        pub from: CryptoAccount,
        pub to: CryptoAccount,
        #[ts(as = "Option::<ts_export::TSBytes>")]
        pub memo: Option<Memo>,
        pub created: TimestampNanos,
        pub error_message: String,
    }

    impl From<CompletedCryptoTransaction> for super::CompletedCryptoTransaction {
        fn from(value: CompletedCryptoTransaction) -> Self {
            super::CompletedCryptoTransaction::ICRC1(value)
        }
    }

    impl From<FailedCryptoTransaction> for super::FailedCryptoTransaction {
        fn from(value: FailedCryptoTransaction) -> Self {
            super::FailedCryptoTransaction::ICRC1(value)
        }
    }

    impl From<Account> for CryptoAccount {
        fn from(value: Account) -> Self {
            CryptoAccount::Account(value)
        }
    }
}

pub mod icrc2 {
    use super::*;
    use icrc1::Account;
    use icrc_ledger_types::icrc1::transfer::Memo;

    #[ts_export]
    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    #[serde(from = "PendingCryptoTransactionCombined")]
    #[ts(rename = "PendingCryptoTransactionICRC2")]
    pub struct PendingCryptoTransaction {
        pub ledger: CanisterId,
        pub token_symbol: String,
        pub token: Cryptocurrency,
        pub amount: u128,
        pub from: Account,
        pub to: Account,
        pub fee: u128,
        #[ts(as = "Option::<ts_export::TSBytes>")]
        pub memo: Option<Memo>,
        pub created: TimestampNanos,
    }

    #[derive(Serialize, Deserialize, Clone, Debug)]
    struct PendingCryptoTransactionCombined {
        ledger: CanisterId,
        token_symbol: Option<String>,
        token: Option<Cryptocurrency>,
        amount: u128,
        from: Account,
        to: Account,
        fee: u128,
        memo: Option<Memo>,
        created: TimestampNanos,
    }

    impl From<PendingCryptoTransactionCombined> for PendingCryptoTransaction {
        fn from(value: PendingCryptoTransactionCombined) -> Self {
            let token_symbol = value
                .token_symbol
                .unwrap_or_else(|| value.token.unwrap().token_symbol().to_string());

            PendingCryptoTransaction {
                ledger: value.ledger,
                token_symbol: token_symbol.clone(),
                token: token_symbol.into(),
                amount: value.amount,
                from: value.from,
                to: value.to,
                fee: value.fee,
                memo: value.memo,
                created: value.created,
            }
        }
    }

    #[ts_export]
    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    #[ts(rename = "CompletedCryptoTransactionICRC2")]
    pub struct CompletedCryptoTransaction {
        pub ledger: CanisterId,
        pub token: Cryptocurrency,
        pub amount: u128,
        pub spender: UserId,
        pub from: icrc1::CryptoAccount,
        pub to: icrc1::CryptoAccount,
        pub fee: u128,
        #[ts(as = "Option::<ts_export::TSBytes>")]
        pub memo: Option<Memo>,
        pub created: TimestampNanos,
        pub block_index: u64,
    }

    #[ts_export]
    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    #[ts(rename = "FailedCryptoTransactionICRC2")]
    pub struct FailedCryptoTransaction {
        pub ledger: CanisterId,
        pub token: Cryptocurrency,
        pub amount: u128,
        pub fee: u128,
        pub spender: UserId,
        pub from: icrc1::CryptoAccount,
        pub to: icrc1::CryptoAccount,
        #[ts(as = "Option::<ts_export::TSBytes>")]
        pub memo: Option<Memo>,
        pub created: TimestampNanos,
        pub error_message: String,
    }

    impl From<CompletedCryptoTransaction> for super::CompletedCryptoTransaction {
        fn from(value: CompletedCryptoTransaction) -> Self {
            super::CompletedCryptoTransaction::ICRC2(value)
        }
    }

    impl From<FailedCryptoTransaction> for super::FailedCryptoTransaction {
        fn from(value: FailedCryptoTransaction) -> Self {
            super::FailedCryptoTransaction::ICRC2(value)
        }
    }

    #[ts_export]
    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub enum ApproveError {
        BadFee { expected_fee: u128 },
        // The caller does not have enough funds to pay the approval fee.
        InsufficientFunds { balance: u128 },
        // The caller specified the [expected_allowance] field, and the current
        // allowance did not match the given value.
        AllowanceChanged { current_allowance: u128 },
        // The approval request expired before the ledger had a chance to apply it.
        Expired { ledger_time: u64 },
        TooOld,
        CreatedInFuture { ledger_time: u64 },
        Duplicate { duplicate_of: u128 },
        TemporarilyUnavailable,
        GenericError { error_code: u128, message: String },
    }

    #[ts_export]
    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub enum TransferFromError {
        BadFee { expected_fee: u128 },
        BadBurn { min_burn_amount: u128 },
        // The [from] account does not hold enough funds for the transfer.
        InsufficientFunds { balance: u128 },
        // The caller exceeded its allowance.
        InsufficientAllowance { allowance: u128 },
        TooOld,
        CreatedInFuture { ledger_time: u64 },
        Duplicate { duplicate_of: u128 },
        TemporarilyUnavailable,
        GenericError { error_code: u128, message: String },
    }
}

impl From<icrc1::PendingCryptoTransaction> for nns::PendingCryptoTransaction {
    fn from(value: icrc1::PendingCryptoTransaction) -> Self {
        nns::PendingCryptoTransaction {
            ledger: value.ledger,
            token_symbol: value.token_symbol,
            token: value.token,
            amount: Tokens::from_e8s(value.amount.try_into().unwrap()),
            to: UserOrAccount::Account(AccountIdentifier::new(
                &value.to.owner,
                &Subaccount(value.to.subaccount.unwrap_or_default()),
            )),
            fee: Some(Tokens::from_e8s(value.fee.try_into().unwrap())),
            memo: value.memo.map(|m| u64_from_bytes(m.0.as_slice())),
            created: value.created,
        }
    }
}

fn u64_from_bytes(bytes: &[u8]) -> u64 {
    assert!(bytes.len() <= 8);
    let mut u64_bytes = [0u8; 8];
    u64_bytes[(8 - bytes.len())..].copy_from_slice(bytes);
    u64::from_be_bytes(u64_bytes)
}
