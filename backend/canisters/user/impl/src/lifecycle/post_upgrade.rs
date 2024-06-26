use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{mutate_state, Data, RuntimeState};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use chat_events::Reader;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use std::time::Duration;
use tracing::info;
use types::{Achievement, Empty, Milliseconds, UserId};
use user_canister::post_upgrade::Args;
use utils::time::DAY_IN_MS;

const SIX_MONTHS: Milliseconds = 183 * DAY_IN_MS;

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

    mutate_state(|state| {
        if state.data.user_created + SIX_MONTHS < state.env.now()
            && state.data.direct_chats.len() <= 1
            && state.data.group_chats.len() == 0
            && state.data.communities.len() == 0
        {
            ic_cdk_timers::set_timer(Duration::ZERO, mark_user_canister_empty);
        }
    });

    mutate_state(initialize_chit_and_achievements);
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

fn initialize_chit_and_achievements(state: &mut RuntimeState) {
    let me: UserId = state.env.canister_id().into();
    let now = state.env.now();

    let longest_streak = state.data.init_streak_and_chit_balance(now);

    if state.data.group_chats.len() > 0 {
        state.data.award_achievement(Achievement::JoinedGroup, now);
    }

    if state.data.communities.len() > 0 {
        state.data.award_achievement(Achievement::JoinedCommunity, now);
    }

    if state.data.direct_chats.iter().any(|c| {
        c.events
            .main_events_reader()
            .iter_latest_messages(None)
            .any(|m| m.event.sender == me)
    }) {
        state.data.award_achievement(Achievement::SentDirectMessage, now);
    }

    if state.data.direct_chats.iter().any(|c| {
        c.events
            .main_events_reader()
            .iter_latest_messages(None)
            .any(|m| m.event.sender == c.them)
    }) {
        state.data.award_achievement(Achievement::ReceivedDirectMessage, now);
    }

    if state.data.avatar.value.is_some() {
        state.data.award_achievement(Achievement::SetAvatar, now);
    }

    if !state.data.bio.value.is_empty() {
        state.data.award_achievement(Achievement::SetBio, now);
    }

    if state.data.display_name.value.is_some() {
        state.data.award_achievement(Achievement::SetDisplayName, now);
    }

    if let Some(diamond_expires) = state.data.diamond_membership_expires_at {
        state.data.award_achievement(Achievement::UpgradedToDiamond, now);

        if (diamond_expires - now) > (5 * 365 * DAY_IN_MS) {
            state.data.award_achievement(Achievement::UpgradedToGoldDiamond, now);
        }
    }

    if longest_streak >= 3 {
        state.data.award_achievement(Achievement::Streak3, now);
    }

    if longest_streak >= 7 {
        state.data.award_achievement(Achievement::Streak7, now);
    }

    if longest_streak >= 14 {
        state.data.award_achievement(Achievement::Streak14, now);
    }

    if longest_streak >= 30 {
        state.data.award_achievement(Achievement::Streak30, now);
    }

    if state.data.chit_balance.value > 0 {
        ic_cdk_timers::set_timer(Duration::ZERO, notify_user_index_of_chit);
    }
}

fn notify_user_index_of_chit() {
    mutate_state(|state| {
        state.data.notify_user_index_of_chit(state.env.now());
    })
}
