use candid::Principal;
use ic_ledger_types::{AccountIdentifier, DEFAULT_SUBACCOUNT, Subaccount};
use oc_error_codes::{OCError, OCErrorCode};
use sha2::{Digest, Sha256};
use types::{
    C2CError, CanisterId, CompletedCryptoTransaction, FailedCryptoTransaction, PendingCryptoTransaction, TimestampNanos,
    UserId, UserIdAndPrincipal,
};
pub use user_accounts::{deposit_to_accept_p2p_swap, icrc2_transfer_from, validate_from_account};

pub mod certified;
pub mod icrc1;
pub mod icrc2;
pub mod nns;
mod user_accounts;

pub fn create_pending_transaction(
    token_symbol: String,
    ledger: CanisterId,
    amount: u128,
    fee: u128,
    to: types::icrc1::Account,
    memo: Option<&[u8]>,
    now_nanos: TimestampNanos,
) -> PendingCryptoTransaction {
    PendingCryptoTransaction::ICRC1(types::icrc1::PendingCryptoTransaction {
        ledger,
        fee,
        token_symbol: token_symbol.clone(),
        amount,
        to,
        memo: memo.map(|bytes| bytes.to_vec().into()),
        created: now_nanos,
    })
}

pub async fn process_transaction(
    transaction: PendingCryptoTransaction,
    sender: Option<UserIdAndPrincipal>,
    retry_if_bad_fee: bool,
) -> Result<Result<CompletedCryptoTransaction, (FailedCryptoTransaction, OCError)>, C2CError> {
    match transaction {
        PendingCryptoTransaction::NNS(t) => match nns::process_transaction(t, sender).await {
            Ok(Ok(c)) => Ok(Ok(c)),
            Ok(Err(c)) => {
                let error = OCErrorCode::TransferFailed.with_message(c.error_message());
                Ok(Err((c, error)))
            }
            Err(e) => Err(e),
        },
        PendingCryptoTransaction::ICRC1(t) => match icrc1::process_transaction(t, sender, retry_if_bad_fee).await {
            Ok(Ok(c)) => Ok(Ok(c.into())),
            Ok(Err(c)) => {
                let error = OCErrorCode::TransferFailed.with_message(&c.error_message);
                Ok(Err((c.into(), error)))
            }
            Err(e) => Err(e),
        },
        PendingCryptoTransaction::ICRC2(t) => match icrc2::process_transaction(t, sender).await {
            Ok(Ok(c)) => Ok(Ok(c.into())),
            Ok(Err((c, error))) => Ok(Err((c.into(), error))),
            Err(e) => Err(e),
        },
        // The user has already made the transfer themselves, so there is nothing to process. It
        // must instead be checked using `certified::verify_certified_transfer`.
        PendingCryptoTransaction::Certified(t) => {
            let error = OCErrorCode::InvalidRequest.with_message("Certified transfers are not supported here");
            let failed = types::icrc1::FailedCryptoTransaction {
                ledger: t.ledger,
                token_symbol: t.token_symbol,
                amount: t.amount,
                fee: t.fee,
                from: sender_account(resolve_sender(sender)).into(),
                to: t.to.into(),
                memo: t.memo,
                created: t.created,
                error_message: error.message().unwrap_or_default().to_string(),
            };
            Ok(Err((failed.into(), error)))
        }
    }
}

// The sender of a transfer, which is this canister when there is no user it is transferring for
pub(crate) fn resolve_sender(sender: Option<UserIdAndPrincipal>) -> UserIdAndPrincipal {
    sender.unwrap_or_else(UserIdAndPrincipal::this_canister)
}

// The account a transfer is made from, which is always this canister's own, since the ledger takes
// the owner from the caller. So the sender must be this canister or its user, whose wallet it is -
// a user in a MultiUser canister holds their own funds, which the canister can't transfer.
pub(crate) fn sender_account(sender: UserIdAndPrincipal) -> types::icrc1::Account {
    let account = types::icrc1::Account::from(sender);
    let canister_id = ic_cdk::api::canister_self();
    assert_eq!(
        account.owner, canister_id,
        "The wallet of {} is not this canister's account",
        sender.user_id
    );
    account
}

// The subaccount of a canister holding approvals made for many users, such as a Group or Community,
// which `user_id` must name as the spender's when approving that canister to pull their funds. The
// canister only spends an approval under the subaccount of the user it is acting for, so no one can
// spend an approval someone else made.
pub fn spender_subaccount(user_id: UserId) -> [u8; 32] {
    convert_to_subaccount(&user_id.as_principal()).0
}

pub fn default_ledger_account(principal: Principal) -> AccountIdentifier {
    AccountIdentifier::new(&principal, &DEFAULT_SUBACCOUNT)
}

pub fn convert_to_subaccount(principal: &Principal) -> Subaccount {
    let mut subaccount = [0; size_of::<Subaccount>()];
    let bytes = principal.as_slice();
    subaccount[0] = bytes.len().try_into().unwrap();
    subaccount[1..1 + bytes.len()].copy_from_slice(bytes);
    Subaccount(subaccount)
}

pub fn format_crypto_amount_with_symbol(units: u128, decimals: u8, symbol: &str) -> String {
    format!("{} {symbol}", format_crypto_amount(units, decimals))
}

pub fn format_crypto_amount(units: u128, decimals: u8) -> String {
    let subdividable_by = 10u128.pow(decimals as u32);
    let whole_units = units / subdividable_by;
    let fractional = units % subdividable_by;

    format!("{whole_units}.{fractional:0decimals$}", decimals = decimals as usize)
        .trim_end_matches('0')
        .trim_end_matches('.')
        .to_string()
}

pub fn compute_neuron_staking_subaccount_bytes(controller: Principal, nonce: u64) -> [u8; 32] {
    const DOMAIN: &[u8] = b"neuron-stake";
    const DOMAIN_LENGTH: [u8; 1] = [0x0c];

    let mut hasher = Sha256::new();
    hasher.update(DOMAIN_LENGTH);
    hasher.update(DOMAIN);
    hasher.update(controller.as_slice());
    hasher.update(nonce.to_be_bytes());
    hasher.finalize().into()
}

#[cfg(test)]
mod tests {
    use test_case::test_case;

    #[test_case(1000000, 8, "0.01")]
    #[test_case(321000000, 8, "3.21")]
    #[test_case(9876543210, 6, "9876.54321")]
    #[test_case(123456789, 8, "1.23456789")]
    fn format(units: u128, decimals: u8, expected: &str) {
        let formatted = super::format_crypto_amount(units, decimals);
        assert_eq!(formatted, expected);
    }
}
