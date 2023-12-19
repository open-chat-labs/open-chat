use crate::activity_notifications::handle_activity_notification;
use crate::jobs::import_groups::finalize_group_import;
use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::updates::c2c_join_channel::join_channel_unchecked;
use crate::{mutate_state, read_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use community_canister::post_upgrade::Args;
use ic_cdk_macros::post_upgrade;
use instruction_counts_log::InstructionCountFunctionId;
use stable_memory::get_reader;
use std::time::Duration;
use tracing::info;
use types::{AccessGate, CanisterId, UserId};

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = serializer::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    let env = init_env(data.rng_seed);
    init_state(env, data, args.wasm_version);

    let completed_imports = read_state(|state| state.data.groups_being_imported.completed_imports());

    for group_id in completed_imports {
        finalize_group_import(group_id);
    }

    info!(version = %args.wasm_version, "Post-upgrade complete");

    read_state(|state| {
        let now = state.env.now();
        state
            .data
            .record_instructions_count(InstructionCountFunctionId::PostUpgrade, now)
    });

    ic_cdk_timers::set_timer(Duration::ZERO, join_members_to_diamond_gated_channels);
}

fn join_members_to_diamond_gated_channels() {
    read_state(|state| {
        if state
            .data
            .channels
            .iter()
            .any(|c| c.chat.is_public.value && matches!(c.chat.gate.value, Some(AccessGate::DiamondMember)))
        {
            let user_ids: Vec<_> = state.data.members.iter().map(|m| m.user_id).collect();

            ic_cdk::spawn(join_members_to_diamond_gated_channels_async(
                state.data.local_user_index_canister_id,
                user_ids,
            ));
        }
    });
}

async fn join_members_to_diamond_gated_channels_async(local_user_index_canister_id: CanisterId, user_ids: Vec<UserId>) {
    if let Ok(local_user_index_canister::c2c_diamond_membership_expiry_dates::Response::Success(expiry_dates)) =
        local_user_index_canister_c2c_client::c2c_diamond_membership_expiry_dates(
            local_user_index_canister_id,
            &local_user_index_canister::c2c_diamond_membership_expiry_dates::Args { user_ids },
        )
        .await
    {
        mutate_state(|state| {
            let now = state.env.now();

            for channel in state
                .data
                .channels
                .iter_mut()
                .filter(|c| c.chat.is_public.value && matches!(c.chat.gate.value, Some(AccessGate::DiamondMember)))
            {
                for m in state.data.members.iter_mut() {
                    if !m.channels.contains(&channel.id) && expiry_dates.get(&m.user_id).copied() > Some(now) {
                        join_channel_unchecked(channel, m, true, now);
                    }
                }
            }
            handle_activity_notification(state);
        })
    }
}
