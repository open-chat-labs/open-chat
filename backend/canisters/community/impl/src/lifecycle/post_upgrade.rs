use crate::jobs::import_groups::finalize_group_import;
use crate::lifecycle::{init_env, init_state};
use crate::memory::{get_stable_memory_map_memory, get_upgrades_memory};
use crate::model::events::CommunityEventInternal;
use crate::{Data, mutate_state, read_state};
use candid::Principal;
use canister_api_macros::post_upgrade;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use community_canister::post_upgrade::Args;
use constants::OPENCHAT_BOT_USER_ID;
use instruction_counts_log::InstructionCountFunctionId;
use stable_memory::get_reader;
use tracing::info;
use types::{CanisterId, CommunityRole, CommunityRoleChanged, GroupRole, RoleChanged, UserId};

#[post_upgrade(msgpack = true)]
#[trace]
fn post_upgrade(args: Args) {
    stable_memory_map::init(get_stable_memory_map_memory());

    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = init_env(data.rng_seed);
    init_state(env, data, args.wasm_version);

    let completed_imports = read_state(|state| state.data.groups_being_imported.completed_imports());

    for group_id in completed_imports {
        finalize_group_import(group_id);
    }

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");

    mutate_state(|state| {
        // If this is the biz community, promote @AlphaWarden to owner
        let biz_community_id: CanisterId = Principal::from_text("wowos-hyaaa-aaaar-ar4ca-cai").unwrap();
        let feff_user_id: UserId = Principal::from_text("wrf4m-qyaaa-aaaaf-aagnq-cai").unwrap().into();
        let alpha_warden_user_id: UserId = Principal::from_text("2pje3-hqaaa-aaaaf-a2h3q-§cai").unwrap().into();

        if state.env.canister_id() == biz_community_id {
            let now = state.env.now();

            match state.data.members.change_role(
                feff_user_id,
                alpha_warden_user_id,
                CommunityRole::Owner,
                &state.data.permissions,
                false,
                false,
                now,
            ) {
                Ok(_) => {
                    let event = CommunityRoleChanged {
                        user_ids: vec![alpha_warden_user_id],
                        old_role: CommunityRole::Admin,
                        new_role: CommunityRole::Owner,
                        changed_by: OPENCHAT_BOT_USER_ID,
                    };
                    state.push_community_event(CommunityEventInternal::RoleChanged(Box::new(event)));

                    // Now promote AlphaWarden to Owner for every public channel where feff is the only owner
                    for channel in state.data.channels.iter_mut() {
                        if channel.chat.is_public.value
                            && channel.chat.members.owners().len() == 1
                            && channel.chat.members.owners().contains(&feff_user_id)
                        {
                            match channel.chat.members.change_role(
                                feff_user_id,
                                alpha_warden_user_id,
                                GroupRole::Owner.into(),
                                &channel.chat.permissions,
                                false,
                                false,
                                now,
                            ) {
                                Ok(old_role) => {
                                    let event = RoleChanged {
                                        user_ids: vec![alpha_warden_user_id],
                                        old_role: old_role.into(),
                                        new_role: GroupRole::Owner,
                                        changed_by: OPENCHAT_BOT_USER_ID,
                                    };

                                    channel
                                        .chat
                                        .events
                                        .push_main_event(ChatEventInternal::RoleChanged(Box::new(event)), now);
                                }
                                Err(err) => ic_cdk::println!(
                                    "Failed to promote AlphaWarden to owner of channel: {}, {:?}",
                                    channel.chat.name.value,
                                    err
                                ),
                            }
                        }
                    }
                }
                Err(err) => ic_cdk::println!("Failed to promote AlphaWarden to community owner: {:?}", err),
            }
        }
    });

    read_state(|state| {
        let now = state.env.now();
        state
            .data
            .record_instructions_count(InstructionCountFunctionId::PostUpgrade, now);
    });
}
