#![expect(deprecated)]
use crate::nns::UserOrAccount;
use crate::{CanisterId, TimestampNanos, UserId, UserIdAndPrincipal};
use candid::{CandidType, Principal};
use ic_ledger_types::{AccountIdentifier, Subaccount};
use icrc_ledger_types::icrc1::account::Account;
use serde::{Deserialize, Deserializer, Serialize};
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

#[expect(deprecated)]
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
    Certified(certified::PendingCryptoTransaction),
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
            PendingCryptoTransaction::Certified(t) => t.ledger,
        }
    }

    pub fn token_symbol(&self) -> &str {
        match self {
            PendingCryptoTransaction::NNS(t) => t.token_symbol.as_str(),
            PendingCryptoTransaction::ICRC1(t) => t.token_symbol.as_str(),
            PendingCryptoTransaction::ICRC2(t) => t.token_symbol.as_str(),
            PendingCryptoTransaction::Certified(t) => t.token_symbol.as_str(),
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
            PendingCryptoTransaction::Certified(t) => t.amount,
        }
    }

    pub fn fee(&self) -> u128 {
        match self {
            PendingCryptoTransaction::NNS(_) => ICP_FEE,
            PendingCryptoTransaction::ICRC1(t) => t.fee,
            PendingCryptoTransaction::ICRC2(t) => t.fee,
            PendingCryptoTransaction::Certified(t) => t.fee,
        }
    }

    // Checks the transfer is to the recipient's wallet. `recipient` must hold their actual principal,
    // from the canister's own data or a lookup, never a caller's claim.
    pub fn validate_recipient(&self, recipient: UserIdAndPrincipal) -> bool {
        // The whole account, not just the owner. Once a canister holds many users the owner alone
        // is satisfied by a transfer destined for any of them.
        let account = Account::from(recipient);
        let account_identifier = crate::account_identifier(account);
        match self {
            PendingCryptoTransaction::NNS(t) => match t.to {
                UserOrAccount::Account(a) => a == account_identifier,
            },
            PendingCryptoTransaction::ICRC1(t) => Account::from(t.to) == account,
            PendingCryptoTransaction::ICRC2(t) => Account::from(t.to) == account,
            PendingCryptoTransaction::Certified(t) => Account::from(t.to) == account,
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
            PendingCryptoTransaction::Certified(_) => {
                panic!("A certified transfer has already been made so its recipient cannot be changed")
            }
        }
    }

    pub fn created(&self) -> TimestampNanos {
        match self {
            PendingCryptoTransaction::NNS(t) => t.created,
            PendingCryptoTransaction::ICRC1(t) => t.created,
            PendingCryptoTransaction::ICRC2(t) => t.created,
            PendingCryptoTransaction::Certified(t) => t.created,
        }
    }

    pub fn set_created(&mut self, created: TimestampNanos) {
        match self {
            PendingCryptoTransaction::NNS(t) => t.created = created,
            PendingCryptoTransaction::ICRC1(t) => t.created = created,
            PendingCryptoTransaction::ICRC2(t) => t.created = created,
            // The transfer has already been made, so when it was created is fixed
            PendingCryptoTransaction::Certified(_) => {}
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
            // The transfer has already been made with the memo the canister verifying it requires
            PendingCryptoTransaction::Certified(_) => {}
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
            CompletedCryptoTransaction::NNS(t) => t.token_symbol.as_str(),
            CompletedCryptoTransaction::ICRC1(t) => t.token_symbol.as_str(),
            CompletedCryptoTransaction::ICRC2(t) => t.token_symbol.as_str(),
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
            FailedCryptoTransaction::NNS(t) => t.token_symbol.as_str(),
            FailedCryptoTransaction::ICRC1(t) => t.token_symbol.as_str(),
            FailedCryptoTransaction::ICRC2(t) => t.token_symbol.as_str(),
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
    #[derive(CandidType, Serialize, Clone, Debug)]
    pub struct CryptoAmount {
        pub token_symbol: String,
        pub amount: Tokens,
    }

    impl<'de> Deserialize<'de> for CryptoAmount {
        fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
        where
            D: Deserializer<'de>,
        {
            #[derive(Deserialize)]
            struct Inner {
                token: Option<Cryptocurrency>,
                token_symbol: Option<String>,
                amount: Tokens,
            }

            let inner = Inner::deserialize(deserializer)?;
            Ok(CryptoAmount {
                token_symbol: inner
                    .token_symbol
                    .unwrap_or_else(|| inner.token.unwrap().token_symbol().to_string()),
                amount: inner.amount,
            })
        }
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
    // Only an account, which an ICP withdrawal to a legacy account identifier needs. Users are paid
    // via ICRC1 or ICRC2 transfers instead.
    pub enum UserOrAccount {
        Account(#[ts(as = "[u8; 32]")] AccountIdentifier),
    }

    #[ts_export]
    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    #[ts(rename = "PendingCryptoTransactionNNS")]
    pub struct PendingCryptoTransaction {
        pub ledger: CanisterId,
        pub token_symbol: String,
        pub amount: Tokens,
        pub to: UserOrAccount,
        pub fee: Option<Tokens>,
        pub memo: Option<u64>,
        pub created: TimestampNanos,
    }

    #[ts_export]
    #[derive(CandidType, Serialize, Clone, Debug)]
    #[ts(rename = "CompletedCryptoTransactionNNS")]
    pub struct CompletedCryptoTransaction {
        pub ledger: CanisterId,
        pub token_symbol: String,
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

    impl<'de> Deserialize<'de> for CompletedCryptoTransaction {
        fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
        where
            D: Deserializer<'de>,
        {
            #[derive(Deserialize)]
            struct Inner {
                ledger: CanisterId,
                token: Option<Cryptocurrency>,
                token_symbol: Option<String>,
                amount: Tokens,
                from: CryptoAccount,
                to: CryptoAccount,
                fee: Tokens,
                memo: u64,
                created: TimestampNanos,
                transaction_hash: TransactionHash,
                block_index: u64,
            }

            let inner = Inner::deserialize(deserializer)?;
            Ok(CompletedCryptoTransaction {
                ledger: inner.ledger,
                token_symbol: inner
                    .token_symbol
                    .unwrap_or_else(|| inner.token.unwrap().token_symbol().to_string()),
                amount: inner.amount,
                from: inner.from,
                to: inner.to,
                fee: inner.fee,
                memo: inner.memo,
                created: inner.created,
                block_index: inner.block_index,
                transaction_hash: inner.transaction_hash,
            })
        }
    }

    #[ts_export]
    #[derive(CandidType, Serialize, Clone, Debug)]
    #[ts(rename = "FailedCryptoTransactionNNS")]
    pub struct FailedCryptoTransaction {
        pub ledger: CanisterId,
        pub token_symbol: String,
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

    impl<'de> Deserialize<'de> for FailedCryptoTransaction {
        fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
        where
            D: Deserializer<'de>,
        {
            #[derive(Deserialize)]
            struct Inner {
                ledger: CanisterId,
                token: Option<Cryptocurrency>,
                token_symbol: Option<String>,
                amount: Tokens,
                fee: Tokens,
                from: CryptoAccount,
                to: CryptoAccount,
                memo: u64,
                created: TimestampNanos,
                transaction_hash: TransactionHash,
                error_message: String,
            }

            let inner = Inner::deserialize(deserializer)?;
            Ok(FailedCryptoTransaction {
                ledger: inner.ledger,
                token_symbol: inner
                    .token_symbol
                    .unwrap_or_else(|| inner.token.unwrap().token_symbol().to_string()),
                amount: inner.amount,
                fee: inner.fee,
                from: inner.from,
                to: inner.to,
                memo: inner.memo,
                created: inner.created,
                transaction_hash: inner.transaction_hash,
                error_message: inner.error_message,
            })
        }
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

    // The default account of a principal. A user's wallet comes from `From<UserIdAndPrincipal>`.
    impl From<Principal> for Account {
        fn from(value: Principal) -> Self {
            Account {
                owner: value,
                subaccount: None,
            }
        }
    }

    impl From<UserIdAndPrincipal> for Account {
        fn from(value: UserIdAndPrincipal) -> Self {
            icrc_ledger_types::icrc1::account::Account::from(value).into()
        }
    }

    impl From<icrc_ledger_types::icrc1::account::Account> for Account {
        fn from(value: icrc_ledger_types::icrc1::account::Account) -> Self {
            Account {
                owner: value.owner,
                subaccount: value.subaccount,
            }
        }
    }

    impl Account {
        // The account of the user's id, for where their principal isn't known yet. It is the user's
        // wallet if they are alone in their canister, but no one's if they are in a MultiUser
        // canister, since nobody can sign for an indexed user id.
        // TODO: Use `From<UserIdAndPrincipal>` instead, once the user's principal is known
        pub fn legacy_for_user(user_id: UserId) -> Account {
            user_id.as_principal().into()
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
    #[ts(rename = "PendingCryptoTransactionICRC1")]
    pub struct PendingCryptoTransaction {
        pub ledger: CanisterId,
        pub token_symbol: String,
        pub amount: u128,
        pub to: Account,
        pub fee: u128,
        #[ts(as = "Option::<ts_export::TSBytes>")]
        pub memo: Option<Memo>,
        pub created: TimestampNanos,
    }

    #[ts_export]
    #[derive(CandidType, Serialize, Clone, Debug)]
    #[ts(rename = "CompletedCryptoTransactionICRC1")]
    pub struct CompletedCryptoTransaction {
        pub ledger: CanisterId,
        pub token_symbol: String,
        pub amount: u128,
        pub from: CryptoAccount,
        pub to: CryptoAccount,
        pub fee: u128,
        #[ts(as = "Option::<ts_export::TSBytes>")]
        pub memo: Option<Memo>,
        pub created: TimestampNanos,
        pub block_index: u64,
    }

    impl<'de> Deserialize<'de> for CompletedCryptoTransaction {
        fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
        where
            D: Deserializer<'de>,
        {
            #[derive(Deserialize)]
            struct Inner {
                ledger: CanisterId,
                token: Option<Cryptocurrency>,
                #[serde(default)]
                token_symbol: String,
                amount: u128,
                from: CryptoAccount,
                to: CryptoAccount,
                fee: u128,
                memo: Option<Memo>,
                created: TimestampNanos,
                block_index: u64,
            }

            let inner = Inner::deserialize(deserializer)?;
            Ok(CompletedCryptoTransaction {
                ledger: inner.ledger,
                token_symbol: if inner.token_symbol.is_empty() {
                    inner.token.unwrap().token_symbol().to_string()
                } else {
                    inner.token_symbol
                },
                amount: inner.amount,
                from: inner.from,
                to: inner.to,
                fee: inner.fee,
                memo: inner.memo,
                created: inner.created,
                block_index: inner.block_index,
            })
        }
    }

    #[ts_export]
    #[derive(CandidType, Serialize, Clone, Debug)]
    #[ts(rename = "FailedCryptoTransactionICRC1")]
    pub struct FailedCryptoTransaction {
        pub ledger: CanisterId,
        pub token_symbol: String,
        pub amount: u128,
        pub fee: u128,
        pub from: CryptoAccount,
        pub to: CryptoAccount,
        #[ts(as = "Option::<ts_export::TSBytes>")]
        pub memo: Option<Memo>,
        pub created: TimestampNanos,
        pub error_message: String,
    }

    impl<'de> Deserialize<'de> for FailedCryptoTransaction {
        fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
        where
            D: Deserializer<'de>,
        {
            #[derive(Deserialize)]
            struct Inner {
                pub ledger: CanisterId,
                pub token: Option<Cryptocurrency>,
                pub token_symbol: Option<String>,
                pub amount: u128,
                pub fee: u128,
                pub from: CryptoAccount,
                pub to: CryptoAccount,
                pub memo: Option<Memo>,
                pub created: TimestampNanos,
                pub error_message: String,
            }

            let inner = Inner::deserialize(deserializer)?;
            Ok(FailedCryptoTransaction {
                ledger: inner.ledger,
                token_symbol: inner
                    .token_symbol
                    .unwrap_or_else(|| inner.token.unwrap().token_symbol().to_string()),
                amount: inner.amount,
                fee: inner.fee,
                from: inner.from,
                to: inner.to,
                memo: inner.memo,
                created: inner.created,
                error_message: inner.error_message,
            })
        }
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
    use icrc_ledger_types::icrc1::transfer::Memo;
    use icrc1::Account;

    #[ts_export]
    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    #[ts(rename = "PendingCryptoTransactionICRC2")]
    pub struct PendingCryptoTransaction {
        pub ledger: CanisterId,
        pub token_symbol: String,
        pub amount: u128,
        pub from: Account,
        pub to: Account,
        pub fee: u128,
        #[ts(as = "Option::<ts_export::TSBytes>")]
        pub memo: Option<Memo>,
        pub created: TimestampNanos,
    }

    #[ts_export]
    #[derive(CandidType, Serialize, Clone, Debug)]
    #[ts(rename = "CompletedCryptoTransactionICRC2")]
    pub struct CompletedCryptoTransaction {
        pub ledger: CanisterId,
        pub token_symbol: String,
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

    impl<'de> Deserialize<'de> for CompletedCryptoTransaction {
        fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
        where
            D: Deserializer<'de>,
        {
            #[derive(Deserialize)]
            struct Inner {
                ledger: CanisterId,
                token: Option<Cryptocurrency>,
                token_symbol: Option<String>,
                amount: u128,
                spender: UserId,
                from: icrc1::CryptoAccount,
                to: icrc1::CryptoAccount,
                fee: u128,
                memo: Option<Memo>,
                created: TimestampNanos,
                block_index: u64,
            }

            let inner = Inner::deserialize(deserializer)?;
            Ok(CompletedCryptoTransaction {
                ledger: inner.ledger,
                token_symbol: inner
                    .token_symbol
                    .unwrap_or_else(|| inner.token.unwrap().token_symbol().to_string()),
                amount: inner.amount,
                spender: inner.spender,
                from: inner.from,
                to: inner.to,
                fee: inner.fee,
                memo: inner.memo,
                created: inner.created,
                block_index: inner.block_index,
            })
        }
    }

    #[ts_export]
    #[derive(CandidType, Serialize, Clone, Debug)]
    #[ts(rename = "FailedCryptoTransactionICRC2")]
    pub struct FailedCryptoTransaction {
        pub ledger: CanisterId,
        pub token_symbol: String,
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

    impl<'de> Deserialize<'de> for FailedCryptoTransaction {
        fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
        where
            D: Deserializer<'de>,
        {
            #[derive(Deserialize)]
            struct Inner {
                ledger: CanisterId,
                token: Option<Cryptocurrency>,
                token_symbol: Option<String>,
                amount: u128,
                fee: u128,
                spender: UserId,
                from: icrc1::CryptoAccount,
                to: icrc1::CryptoAccount,
                memo: Option<Memo>,
                created: TimestampNanos,
                error_message: String,
            }

            let inner = Inner::deserialize(deserializer)?;
            Ok(FailedCryptoTransaction {
                ledger: inner.ledger,
                token_symbol: inner
                    .token_symbol
                    .unwrap_or_else(|| inner.token.unwrap().token_symbol().to_string()),
                amount: inner.amount,
                fee: inner.fee,
                spender: inner.spender,
                from: inner.from,
                to: inner.to,
                memo: inner.memo,
                created: inner.created,
                error_message: inner.error_message,
            })
        }
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

pub mod certified {
    use super::*;
    use icrc_ledger_types::icrc1::transfer::Memo;
    use icrc1::Account;
    use serde_bytes::ByteBuf;

    // An ICRC1 transfer the user has already made from their own principal's account by calling
    // `icrc1_transfer` on the ledger themselves. Rather than making the transfer, the canister
    // verifies `call` proves the ledger accepted it, then treats it as a completed ICRC1 transfer.
    // `amount`, `to`, `fee`, `memo` and `created` repeat what is in the call's arg, and the
    // verification fails unless they match.
    #[ts_export]
    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    #[ts(rename = "PendingCryptoTransactionCertified")]
    pub struct PendingCryptoTransaction {
        pub ledger: CanisterId,
        pub token_symbol: String,
        pub amount: u128,
        pub to: Account,
        pub fee: u128,
        #[ts(as = "Option::<ts_export::TSBytes>")]
        pub memo: Option<Memo>,
        pub created: TimestampNanos,
        pub call: CertifiedCall,
    }

    // The content of the user's call to `icrc1_transfer`, from which its request id is computed,
    // along with a certificate from the ledger's subnet holding the reply to that request id. The
    // sender and canister id are not included, since they must be the caller and the ledger.
    #[ts_export]
    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub struct CertifiedCall {
        #[serde(with = "serde_bytes")]
        pub arg: Vec<u8>,
        pub ingress_expiry: u64,
        #[ts(as = "Option::<ts_export::TSBytes>")]
        pub nonce: Option<ByteBuf>,
        #[serde(with = "serde_bytes")]
        pub certificate: Vec<u8>,
    }
}

fn u64_from_bytes(bytes: &[u8]) -> u64 {
    assert!(bytes.len() <= 8);
    let mut u64_bytes = [0u8; 8];
    u64_bytes[(8 - bytes.len())..].copy_from_slice(bytes);
    u64::from_be_bytes(u64_bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn icrc1_transfer_to(to: icrc1::Account) -> PendingCryptoTransaction {
        PendingCryptoTransaction::ICRC1(icrc1::PendingCryptoTransaction {
            ledger: CanisterId::from_slice(&[1; 10]),
            token_symbol: "CHAT".to_string(),
            amount: 1,
            to,
            fee: 0,
            memo: None,
            created: 0,
        })
    }

    fn canister_user() -> UserId {
        UserId::new(Principal::from_slice(&[0, 0, 0, 0, 2, 0, 0, 5, 1, 1]))
    }

    fn principal() -> Principal {
        Principal::from_slice(&[9; 29])
    }

    #[test]
    fn transfer_to_user_alone_in_their_canister_is_to_their_user_id() {
        let recipient = UserIdAndPrincipal::new(canister_user(), principal());

        assert!(icrc1_transfer_to(canister_user().as_principal().into()).validate_recipient(recipient));
        assert!(!icrc1_transfer_to(principal().into()).validate_recipient(recipient));
    }

    #[test]
    fn transfer_to_indexed_user_is_to_their_principal() {
        let user_id = UserId::new_indexed(canister_user().canister_id(), 7);
        let recipient = UserIdAndPrincipal::new(user_id, principal());

        assert!(icrc1_transfer_to(principal().into()).validate_recipient(recipient));
        assert!(!icrc1_transfer_to(icrc1::Account::legacy_for_user(user_id)).validate_recipient(recipient));
    }

    #[test]
    fn nns_transfer_to_recipients_account_identifier_is_accepted() {
        let recipient = UserIdAndPrincipal::new(canister_user(), principal());
        let transfer = |to| {
            PendingCryptoTransaction::NNS(nns::PendingCryptoTransaction {
                ledger: CanisterId::from_slice(&[1; 10]),
                token_symbol: "ICP".to_string(),
                amount: nns::Tokens::from_e8s(1),
                to: UserOrAccount::Account(to),
                fee: None,
                memo: None,
                created: 0,
            })
        };

        assert!(transfer(AccountIdentifier::from(recipient)).validate_recipient(recipient));
        assert!(!transfer(AccountIdentifier::new(&principal(), &Subaccount([0; 32]))).validate_recipient(recipient));
    }
}
