use rand::rngs::StdRng;
use rand::SeedableRng;
use rsa::RsaPrivateKey;
use std::cell::RefCell;

thread_local! {
    static RNG: RefCell<Option<StdRng>> = RefCell::default();
}

pub fn set_seed(salt: [u8; 32], entropy: u64) {
    let mut seed = salt;
    if entropy > 0 {
        seed[..8].copy_from_slice(&entropy.to_be_bytes());
    }

    RNG.set(Some(StdRng::from_seed(seed)));
}

pub fn generate_rsa_private_key() -> RsaPrivateKey {
    with_rng(|rng| RsaPrivateKey::new(rng, 2048).unwrap())
}

pub fn with_rng<F: FnOnce(&mut StdRng) -> T, T>(f: F) -> T {
    RNG.with_borrow_mut(|rng| f(rng.as_mut().unwrap()))
}
