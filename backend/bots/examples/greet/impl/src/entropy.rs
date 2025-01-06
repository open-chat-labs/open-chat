use crate::env;
use crate::Hash;
use rand::rngs::StdRng;
use rand::Rng;
use rand::SeedableRng;
use sha256::sha256;

pub fn entropy(seed: [u8; 32]) -> Hash {
    let mut bytes = Vec::new();

    bytes.extend(StdRng::from_seed(seed).gen::<[u8; 32]>());
    bytes.extend(env::canister_id().as_slice());
    bytes.extend(env::caller().as_slice());
    bytes.extend(env::now_nanos().to_ne_bytes());
    bytes.extend(env::cycles_balance().to_ne_bytes());
    bytes.extend(env::arg_data_raw());

    sha256(&bytes)
}
