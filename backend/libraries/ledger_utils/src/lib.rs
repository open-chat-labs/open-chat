#![allow(deprecated)]
use candid::Principal;
use ic_cdk::api::call::CallResult;
use ic_ledger_types::{AccountIdentifier, Subaccount, DEFAULT_SUBACCOUNT};
use sha2::{Digest, Sha256};
use types::{
    CanisterId, CompletedCryptoTransaction, FailedCryptoTransaction, PendingCryptoTransaction, TimestampNanos, UserId,
};

pub mod icrc1;
pub mod icrc2;
pub mod nns;

pub fn create_pending_transaction(
    token_symbol: String,
    ledger: CanisterId,
    amount: u128,
    fee: u128,
    user_id: UserId,
    memo: Option<&[u8]>,
    now_nanos: TimestampNanos,
) -> PendingCryptoTransaction {
    PendingCryptoTransaction::ICRC1(types::icrc1::PendingCryptoTransaction {
        ledger,
        fee,
        token_symbol,
        amount,
        to: user_id.into(),
        memo: memo.map(|bytes| bytes.to_vec().into()),
        created: now_nanos,
    })
}

pub async fn process_transaction(
    transaction: PendingCryptoTransaction,
    sender: CanisterId,
    retry_if_bad_fee: bool,
) -> CallResult<Result<CompletedCryptoTransaction, FailedCryptoTransaction>> {
    match transaction {
        PendingCryptoTransaction::NNS(t) => nns::process_transaction(t, sender).await,
        PendingCryptoTransaction::ICRC1(t) => match icrc1::process_transaction(t, sender, retry_if_bad_fee).await {
            Ok(Ok(c)) => Ok(Ok(c.into())),
            Ok(Err(c)) => Ok(Err(c.into())),
            Err(e) => Err(e),
        },
        PendingCryptoTransaction::ICRC2(t) => match icrc2::process_transaction(t, sender).await {
            Ok(Ok(c)) => Ok(Ok(c.into())),
            Ok(Err(c)) => Ok(Err(c.into())),
            Err(e) => Err(e),
        },
    }
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
