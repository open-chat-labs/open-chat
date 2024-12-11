use crate::{jobs, mutate_state, Data, RuntimeState, WASM_VERSION};
use local_user_index_canister::UserIndexEvent;
use std::time::Duration;
use tracing::trace;
use types::{BuildVersion, Timestamped};
use utils::canister::get_random_seed;
use utils::env::canister::CanisterEnv;
use utils::env::Environment;

mod init;
mod inspect_message;
mod post_upgrade;
mod pre_upgrade;

fn init_env(rng_seed: [u8; 32], is_key_pair_initialised: bool) -> Box<CanisterEnv> {
    let canister_env = if rng_seed == [0; 32] || !is_key_pair_initialised {
        ic_cdk_timers::set_timer(Duration::ZERO, reseed_rng);
        CanisterEnv::default()
    } else {
        CanisterEnv::new(rng_seed)
    };
    Box::new(canister_env)
}

fn init_state(env: Box<dyn Environment>, data: Data, wasm_version: BuildVersion) {
    let now = env.now();
    let state = RuntimeState::new(env, data);

    crate::jobs::start(&state);
    crate::init_state(state);
    WASM_VERSION.set(Timestamped::new(wasm_version, now));
}

fn reseed_rng() {
    ic_cdk::spawn(reseed_rng_inner());

    async fn reseed_rng_inner() {
        let seed = get_random_seed().await;
        mutate_state(|state| {
            state.data.rng_seed = seed;
            state.env = Box::new(CanisterEnv::new(seed));
            state.data.oc_key_pair.initialize(&mut state.env.rng());

            sync_secret_with_local_user_indexes(state);
        });
        trace!("Successfully reseeded rng");
    }
}

fn sync_secret_with_local_user_indexes(state: &mut RuntimeState) {
    let event = UserIndexEvent::SecretKeySet(state.data.oc_key_pair.secret_key_der().to_vec());
    for canister_id in state.data.local_index_map.canisters() {
        state.data.user_index_event_sync_queue.push(*canister_id, event.clone());
    }
    jobs::sync_events_to_local_user_index_canisters::start_job_if_required(state);
}
