use candid::Principal;
use pocket_ic::PocketIc;
use rand::{rngs::StdRng, Rng, SeedableRng};
use std::time::SystemTime;
use std::{path::PathBuf, time::UNIX_EPOCH};
use types::{Hash, TimestampMillis, TimestampNanos};

pub fn principal_to_username(principal: Principal) -> String {
    principal.to_string()[0..5].to_string()
}

pub fn tick_many(env: &mut PocketIc, count: usize) {
    for _ in 0..count {
        env.tick();
    }
}

pub fn now_millis(env: &PocketIc) -> TimestampMillis {
    now_nanos(env) / 1_000_000
}

pub fn now_nanos(env: &PocketIc) -> TimestampNanos {
    env.get_time().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_nanos() as u64
}

pub fn local_bin() -> PathBuf {
    let mut file_path =
        PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").expect("Failed to read CARGO_MANIFEST_DIR env variable"));
    file_path.push("wasms");
    file_path
}

pub fn generate_seed() -> Hash {
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64;
    StdRng::seed_from_u64(now).gen()
}
