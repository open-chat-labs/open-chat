use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::model::referrals::Referrals;
use crate::{mutate_state, read_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use std::time::Duration;
use tracing::info;
use types::{Achievement, ChitEarned, ChitEarnedReason, ReferralStatus, Timestamped};
use user_canister::post_upgrade::Args;
use user_canister::WalletConfig;

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

    // TODO: Remove this after the next release
    mutate_state(|state| {
        state.data.wallet_config = Timestamped::new(WalletConfig::default(), state.env.now());
    });

    // TODO: Remove this after the next release
    mutate_state(|state| {
        state.data.referred_by = args.referred_by;
        state.data.referrals = Referrals::new(args.referrals);

        let now = state.env.now();
        let prev_chit_events = state.data.chit_events.len();

        for status in state
            .data
            .referrals
            .referrals()
            .values()
            .filter(|s| !matches!(s, ReferralStatus::Registered))
        {
            state.data.chit_events.push(ChitEarned {
                amount: status.chit_reward() as i32,
                timestamp: now,
                reason: ChitEarnedReason::Referral(*status),
            })
        }

        let total_verified = state.data.referrals.total_verified();

        if total_verified > 0 {
            state.data.award_achievement(Achievement::Referred1stUser, now);
        }
        if total_verified >= 3 {
            state.data.award_achievement(Achievement::Referred3rdUser, now);
        }
        if total_verified >= 10 {
            state.data.award_achievement(Achievement::Referred10thUser, now);
        }
        if total_verified >= 20 {
            state.data.award_achievement(Achievement::Referred20thUser, now);
        }
        if total_verified >= 50 {
            state.data.award_achievement(Achievement::Referred50thUser, now);
        }

        if state.data.chit_events.len() > prev_chit_events {
            ic_cdk_timers::set_timer(Duration::ZERO, || ic_cdk::spawn(notify_user_index_of_chit()));
        }
    });
}

async fn notify_user_index_of_chit() {
    read_state(|state| {
        state.data.notify_user_index_of_chit(state.env.now());
    });
}
