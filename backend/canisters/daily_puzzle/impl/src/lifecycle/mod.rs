use crate::jobs::{generate_candidates, push_puzzle};
use crate::{Data, RuntimeState, WASM_VERSION, mutate_state};
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, trace};
use types::{BuildVersion, Timestamped};
use utils::canister::try_get_random_seed;
use utils::env::Environment;
use utils::env::canister::CanisterEnv;

mod init;
mod inspect_message;
mod post_upgrade;
mod pre_upgrade;

const RESEED_RETRY_DELAY: Duration = Duration::from_secs(10);

thread_local! {
    static RESEED_IN_FLIGHT: Cell<bool> = const { Cell::new(false) };
}

fn init_env(rng_seed: [u8; 32]) -> Box<CanisterEnv> {
    let canister_env = if rng_seed == [0; 32] {
        ic_cdk_timers::set_timer(Duration::ZERO, async { reseed_rng() });
        CanisterEnv::default()
    } else {
        CanisterEnv::new(rng_seed)
    };
    Box::new(canister_env)
}

fn init_state(env: Box<dyn Environment>, mut data: Data, wasm_version: BuildVersion) {
    let now = env.now();
    // Every price, reward and cap is a constant of this build, so the puzzles this canister holds
    // are restamped on every upgrade and the push below carries the new numbers to every local
    // user index without an operator call (#9357 invariant 2)
    data.stamp_config();
    data.ensure_puzzles(now);
    let state = RuntimeState::new(env, data);

    crate::jobs::start(&state);
    push_puzzle::schedule(true, Duration::ZERO);
    crate::init_state(state);
    WASM_VERSION.set(Timestamped::new(wasm_version, now));
}

// Every puzzle seed derives from `master_seed`, and only this sets it. `raw_rand` is a
// bounded-wait call, so a rejection is a legal outcome rather than a bug; trapping on it, as
// `utils::canister::get_random_seed` does, left the canister with no seed and no retry, and an
// upgrade did not help because `pre_upgrade` had already written a non-zero `rng_seed`. So this
// retries itself, and `generate_candidates` calls it whenever it finds the seed missing.
pub(crate) fn reseed_rng() {
    if !claim_reseed() {
        return;
    }
    ic_cdk::futures::spawn_migratory(reseed_rng_inner());

    async fn reseed_rng_inner() {
        let result = try_get_random_seed().await;
        RESEED_IN_FLIGHT.set(false);
        let seed = match on_seed(result) {
            Reseed::Set(seed) => seed,
            Reseed::Retry(error) => {
                error!(error, "Failed to get a random seed, retrying");
                ic_cdk_timers::set_timer(RESEED_RETRY_DELAY, async { reseed_rng() });
                return;
            }
        };
        mutate_state(|state| {
            state.data.rng_seed = seed;
            if state.data.master_seed == 0 {
                state.data.master_seed = u64::from_le_bytes(seed[..8].try_into().unwrap());
            }
            state.env = Box::new(CanisterEnv::new(seed));
            generate_candidates::start_job_if_required(state);
        });
        trace!("Successfully reseeded rng");
    }
}

// One reseed in flight at a time: `generate_candidates` asks for one every time it finds no seed
fn claim_reseed() -> bool {
    !RESEED_IN_FLIGHT.replace(true)
}

enum Reseed {
    Set([u8; 32]),
    Retry(String),
}

fn on_seed(result: Result<[u8; 32], String>) -> Reseed {
    match result {
        Ok(seed) => Reseed::Set(seed),
        Err(error) => Reseed::Retry(error),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // #9332 invariant 33. A rejected raw_rand is retried rather than trapped, and only one
    // reseed is in flight however many callers ask.
    #[test]
    fn a_rejected_seed_is_retried_and_one_reseed_is_in_flight() {
        assert!(matches!(on_seed(Ok([7; 32])), Reseed::Set(seed) if seed == [7; 32]));
        assert!(matches!(on_seed(Err("rejected".to_string())), Reseed::Retry(e) if e == "rejected"));

        assert!(claim_reseed());
        assert!(!claim_reseed());
        RESEED_IN_FLIGHT.set(false);
        assert!(claim_reseed());
    }
}
