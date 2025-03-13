use crate::NNS_INTERNET_IDENTITY_CANISTER_ID;
use candid::Principal;
use rand::{Rng, RngCore};
use types::CanisterId;

pub fn random_principal<R: RngCore>(rng: &mut R) -> Principal {
    random_from_principal(rng)
}

pub fn random_from_principal<R: RngCore, T: From<Principal>>(rng: &mut R) -> T {
    let random_bytes = rng.next_u64().to_ne_bytes();

    Principal::from_slice(&random_bytes).into()
}

pub fn random_internet_identity_principal<R: RngCore>(rng: &mut R) -> (Principal, Vec<u8>) {
    random_delegated_principal(rng, NNS_INTERNET_IDENTITY_CANISTER_ID)
}

pub fn random_delegated_principal<R: RngCore>(rng: &mut R, originating_canister_id: CanisterId) -> (Principal, Vec<u8>) {
    let algorithm_bytes = [48u8, 60, 48, 12, 6, 10, 43, 6, 1, 4, 1, 131, 184, 67, 1, 2, 3, 44, 0];
    let random_bytes: [u8; 32] = rng.gen();

    let mut public_key = Vec::from(algorithm_bytes);
    public_key.push(originating_canister_id.as_slice().len() as u8);
    public_key.extend_from_slice(originating_canister_id.as_slice());
    public_key.extend_from_slice(&random_bytes);

    (Principal::self_authenticating(&public_key), public_key)
}

pub fn random_string<R: RngCore>(rng: &mut R) -> String {
    rng.next_u32().to_string()
}

pub fn random_from_u32<R: RngCore, T: From<u32>>(rng: &mut R) -> T {
    let value: u32 = rng.next_u32();
    value.into()
}

pub fn random_from_u128<R: RngCore, T: From<u128>>(rng: &mut R) -> T {
    let value: u128 = rng.gen();
    value.into()
}
