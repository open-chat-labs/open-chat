use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{mutate_state, Data, RuntimeState};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use std::time::Duration;
use tracing::info;
use types::{Achievement, Empty, Milliseconds};
use user_canister::post_upgrade::Args;
use utils::time::DAY_IN_MS;

const SIX_MONTHS: Milliseconds = 183 * DAY_IN_MS;
const NOTIFY_IF_EMPTY: bool = false;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = serializer::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    let env = init_env(data.rng_seed);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    // Disable this for now until all existing empty users have been deleted
    if NOTIFY_IF_EMPTY {
        mutate_state(|state| {
            if state.data.user_created + SIX_MONTHS < state.env.now()
                && state.data.direct_chats.len() <= 1
                && state.data.group_chats.len() == 0
                && state.data.communities.len() == 0
            {
                ic_cdk_timers::set_timer(Duration::ZERO, mark_user_canister_empty);
            }
        });
    }

    mutate_state(fix_achievements);
}

fn mark_user_canister_empty() {
    mutate_state(|state| {
        let user_index_canister_id = state.data.user_index_canister_id;
        state.data.fire_and_forget_handler.send(
            user_index_canister_id,
            "c2c_mark_user_canister_empty_msgpack",
            msgpack::serialize_then_unwrap(Empty {}),
        );
    })
}

fn fix_achievements(state: &mut RuntimeState) {
    let now = state.env.now();

    if let Some(diamond_expires) = state.data.diamond_membership_expires_at {
        let lifetime_diamond = (diamond_expires - now) > (5 * 365 * DAY_IN_MS);

        if lifetime_diamond && state.data.award_achievement(Achievement::UpgradedToGoldDiamond, now) {
            ic_cdk_timers::set_timer(Duration::ZERO, notify_user_index_of_chit);
            return;
        }
    }

    if state.data.streak.days(now) > 0 {
        // Fix the streak_ends for the user record in the user_index
        ic_cdk_timers::set_timer(Duration::ZERO, notify_user_index_of_chit);
    }
}

fn notify_user_index_of_chit() {
    mutate_state(|state| {
        state.data.notify_user_index_of_chit(state.env.now());
    })
}
