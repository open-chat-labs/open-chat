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

    // Whether only the owner of the account the funds come from can submit the transaction. The
    // ledger makes an NNS or ICRC1 transfer from the caller's own account, whereas an ICRC2 transfer
    // is pulled by a spender the owner approved, and a certified transfer has already been made. So
    // a canister which doesn't hold a user's funds can only submit the latter two for them.
    pub fn must_be_submitted_by_account_owner(&self) -> bool {
        match self {
            PendingCryptoTransaction::NNS(_) | PendingCryptoTransaction::ICRC1(_) => true,
            PendingCryptoTransaction::ICRC2(_) | PendingCryptoTransaction::Certified(_) => false,
        }
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

    // Sends the transfer to the wallet of the user it is for, returning false if it isn't for them,
    // in which case it must not be made. `wallet` must be where the user actually holds their funds,
    // taken from the canister's own data or a lookup, never from a caller's claim.
    //
    // A client only knows the principal of its own user, so it addresses a transfer to the account of
    // the recipient's user id. That is the wallet of a user alone in their canister, but for a user
    // in a MultiUser canister, who holds their funds under their principal, it is an account no one
    // can spend from. So a transfer addressed to either is sent to the wallet, and one addressed
    // anywhere else is refused. A certified transfer has been made already, so can only be accepted
    // if it was made to the wallet.
    #[must_use]
    pub fn send_to_wallet(&mut self, user_id: UserId, wallet: icrc1::Account) -> bool {
        if self.is_to(wallet.into()) {
            return true;
        }
        if !self.is_to(icrc1::Account::legacy_for_user(user_id).into()) {
            return false;
        }
        match self {
            PendingCryptoTransaction::NNS(t) => t.to = UserOrAccount::Account(crate::account_identifier(wallet.into())),
            PendingCryptoTransaction::ICRC1(t) => t.to = wallet,
            PendingCryptoTransaction::ICRC2(t) => t.to = wallet,
            PendingCryptoTransaction::Certified(_) => return false,
        }
        true
    }

    // Whether the transfer is to an account of the id of a user in a MultiUser canister (see
    // `UserId::is_indexed`), under any subaccount. No one can sign as such an id, so anything sent
    // there can never be spent, the user holding their funds under the principal they sign in with.
    //
    // An ICP account identifier is a hash of the account, so its owner can't be read from it. It is
    // instead compared with the default accounts of `known_user_ids`, which is the account a client
    // addresses a user's id as (see `icrc1::Account::legacy_for_user`).
    pub fn is_to_indexed_user_id(&self, known_user_ids: impl IntoIterator<Item = UserId>) -> bool {
        let to = match self {
            PendingCryptoTransaction::NNS(t) => {
                let UserOrAccount::Account(to) = t.to;
                return known_user_ids
                    .into_iter()
                    .filter(UserId::is_indexed)
                    .any(|user_id| crate::account_identifier(icrc1::Account::legacy_for_user(user_id).into()) == to);
            }
            PendingCryptoTransaction::ICRC1(t) => t.to,
            PendingCryptoTransaction::ICRC2(t) => t.to,
            PendingCryptoTransaction::Certified(t) => t.to,
        };
        UserId::from(to.owner).is_indexed()
    }

    // Checks the transfer is to exactly `account`. The whole account, not just the owner, since once
    // a canister holds many users the owner alone is satisfied by a transfer destined for any of them.
    pub fn is_to(&self, account: Account) -> bool {
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

    fn icrc2_transfer_to(to: icrc1::Account) -> PendingCryptoTransaction {
        PendingCryptoTransaction::ICRC2(icrc2::PendingCryptoTransaction {
            ledger: CanisterId::from_slice(&[1; 10]),
            token_symbol: "CHAT".to_string(),
            amount: 1,
            from: Principal::from_slice(&[8; 29]).into(),
            to,
            fee: 0,
            memo: None,
            created: 0,
        })
    }

    fn nns_transfer_to(to: AccountIdentifier) -> PendingCryptoTransaction {
        PendingCryptoTransaction::NNS(nns::PendingCryptoTransaction {
            ledger: CanisterId::from_slice(&[1; 10]),
            token_symbol: "ICP".to_string(),
            amount: nns::Tokens::from_e8s(1),
            to: UserOrAccount::Account(to),
            fee: None,
            memo: None,
            created: 0,
        })
    }

    fn certified_transfer_to(to: icrc1::Account) -> PendingCryptoTransaction {
        PendingCryptoTransaction::Certified(certified::PendingCryptoTransaction {
            ledger: CanisterId::from_slice(&[1; 10]),
            token_symbol: "CHAT".to_string(),
            amount: 1,
            to,
            fee: 0,
            memo: None,
            created: 0,
            call: certified::CertifiedCall {
                arg: Vec::new(),
                ingress_expiry: 0,
                nonce: None,
                certificate: Vec::new(),
            },
        })
    }

    fn indexed_user() -> UserId {
        UserId::new_indexed(canister_user().canister_id(), 7)
    }

    // Whether the transfer was sent to the user's wallet
    fn sent_to_wallet(mut transfer: PendingCryptoTransaction, recipient: UserIdAndPrincipal) -> bool {
        transfer.send_to_wallet(recipient.user_id, recipient.into()) && transfer.is_to(Account::from(recipient))
    }

    #[test]
    fn transfer_to_user_alone_in_their_canister_is_to_their_user_id() {
        let recipient = UserIdAndPrincipal::new(canister_user(), principal());

        assert!(sent_to_wallet(
            icrc1_transfer_to(canister_user().as_principal().into()),
            recipient
        ));
        assert!(!sent_to_wallet(icrc1_transfer_to(principal().into()), recipient));
    }

    #[test]
    fn transfer_to_indexed_user_is_to_their_principal() {
        let recipient = UserIdAndPrincipal::new(indexed_user(), principal());

        assert!(sent_to_wallet(icrc1_transfer_to(principal().into()), recipient));
        assert!(sent_to_wallet(icrc2_transfer_to(principal().into()), recipient));
        assert!(sent_to_wallet(nns_transfer_to(AccountIdentifier::from(recipient)), recipient));
        assert!(sent_to_wallet(certified_transfer_to(principal().into()), recipient));
    }

    #[test]
    fn transfer_addressed_to_indexed_users_id_is_sent_to_their_principal_instead() {
        let user_id = indexed_user();
        let recipient = UserIdAndPrincipal::new(user_id, principal());
        let addressed_to_user_id = icrc1::Account::legacy_for_user(user_id);

        assert!(sent_to_wallet(icrc1_transfer_to(addressed_to_user_id), recipient));
        assert!(sent_to_wallet(icrc2_transfer_to(addressed_to_user_id), recipient));
        assert!(sent_to_wallet(
            nns_transfer_to(crate::account_identifier(addressed_to_user_id.into())),
            recipient
        ));
    }

    #[test]
    fn certified_transfer_addressed_to_indexed_users_id_is_refused() {
        let user_id = indexed_user();
        let recipient = UserIdAndPrincipal::new(user_id, principal());
        let mut transfer = certified_transfer_to(icrc1::Account::legacy_for_user(user_id));

        assert!(!transfer.send_to_wallet(user_id, recipient.into()));
        assert!(transfer.is_to(icrc1::Account::legacy_for_user(user_id).into()));
    }

    #[test]
    fn transfer_addressed_to_anyone_else_is_refused() {
        let user_id = indexed_user();
        let recipient = UserIdAndPrincipal::new(user_id, principal());
        let someone_else: icrc1::Account = Principal::from_slice(&[7; 29]).into();
        let subaccount_of_wallet = icrc1::Account {
            owner: principal(),
            subaccount: Some([1; 32]),
        };

        for to in [someone_else, subaccount_of_wallet] {
            for mut transfer in [icrc1_transfer_to(to), icrc2_transfer_to(to), certified_transfer_to(to)] {
                assert!(!transfer.send_to_wallet(user_id, recipient.into()));
                assert!(transfer.is_to(to.into()));
            }
        }
    }

    #[test]
    fn transfer_to_any_account_of_an_indexed_user_id_is_detected() {
        let user_id = indexed_user();
        let default_account = icrc1::Account::legacy_for_user(user_id);
        let subaccount = icrc1::Account {
            subaccount: Some([1; 32]),
            ..default_account
        };

        for to in [default_account, subaccount] {
            for transfer in [icrc1_transfer_to(to), icrc2_transfer_to(to), certified_transfer_to(to)] {
                assert!(transfer.is_to_indexed_user_id([]));
            }
        }
    }

    #[test]
    fn transfer_to_a_wallet_is_not_to_an_indexed_user_id() {
        // A user alone in their canister holds their funds in the account of their user id
        let wallets = [canister_user().as_principal().into(), principal().into()];

        for to in wallets {
            for transfer in [icrc1_transfer_to(to), icrc2_transfer_to(to), certified_transfer_to(to)] {
                assert!(!transfer.is_to_indexed_user_id([indexed_user(), canister_user()]));
            }
            let nns_transfer = nns_transfer_to(crate::account_identifier(to.into()));
            assert!(!nns_transfer.is_to_indexed_user_id([indexed_user(), canister_user()]));
        }
    }

    #[test]
    fn nns_transfer_to_an_indexed_user_id_is_only_detected_if_the_id_is_known() {
        let user_id = indexed_user();
        let transfer = nns_transfer_to(crate::account_identifier(icrc1::Account::legacy_for_user(user_id).into()));

        assert!(transfer.is_to_indexed_user_id([canister_user(), user_id]));
        assert!(!transfer.is_to_indexed_user_id([canister_user()]));
    }

    #[test]
    fn nns_transfer_to_recipients_account_identifier_is_accepted() {
        let recipient = UserIdAndPrincipal::new(canister_user(), principal());

        assert!(sent_to_wallet(nns_transfer_to(AccountIdentifier::from(recipient)), recipient));
        assert!(!sent_to_wallet(
            nns_transfer_to(AccountIdentifier::new(&principal(), &Subaccount([0; 32]))),
            recipient
        ));
    }
}
