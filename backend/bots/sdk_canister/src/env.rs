use candid::Principal;
use oc_bots_sdk::types::{Hash, Nanoseconds, TimestampMillis, TimestampNanos};
use sha2::{Digest, Sha256};

const NANOS_PER_MILLISECOND: Nanoseconds = 1_000_000;

pub fn now() -> TimestampMillis {
    now_nanos() / NANOS_PER_MILLISECOND
}

pub fn now_nanos() -> TimestampNanos {
    ic_cdk::api::time()
}

pub fn canister_id() -> Principal {
    ic_cdk::id()
}

pub fn caller() -> Principal {
    ic_cdk::caller()
}

pub fn cycles_balance() -> u128 {
    ic_cdk::api::canister_balance128()
}

pub fn arg_data_raw() -> Vec<u8> {
    ic_cdk::api::call::arg_data_raw()
}

pub fn entropy() -> Hash {
    let mut bytes = Vec::new();

    bytes.extend(canister_id().as_slice());
    bytes.extend(caller().as_slice());
    bytes.extend(now_nanos().to_ne_bytes());
    bytes.extend(cycles_balance().to_ne_bytes());
    bytes.extend(arg_data_raw());

    sha256(&bytes)
}

fn sha256(bytes: &[u8]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hasher.finalize().into()
}
