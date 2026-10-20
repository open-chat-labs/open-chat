use crate::LocalUserIndexEventPusher;
use crate::guards::caller_is_registry_canister;
use crate::updates::upgrade_multi_user_canister_wasm::upgrade_multi_user_wasm_in_local_user_index;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use ic_cdk_management_canister::{CanisterInfoArgs, CanisterInstallMode};
use local_user_index_canister::{
    BotPublished, BotRegistered, SetAlchemyApiKey, SetPremiumItemCost, UserDetailsFull, UserIdMigrated, UserIndexEvent,
};
use rand::RngExt;
use std::collections::HashSet;
use tracing::info;
use types::{BotRegistrationStatus, BuildVersion, CanisterId, CanisterWasm, Hash};
use user_index_canister::ChildCanisterType;
use user_index_canister::add_local_user_index_canister::{Response::*, *};
use utils::canister::{
    CanisterToInstall, ChunkedWasmToInstall, WasmToInstall, install, set_controllers, upload_wasm_in_chunks,
};

#[update(guard = "caller_is_registry_canister", msgpack = true)]
#[trace]
async fn add_local_user_index_canister(args: Args) -> Response {
    match mutate_state(|state| prepare(&args, state)) {
        Ok(result) => {
            let wasm_version = result.canister_wasm.version;

            let canister_info = match ic_cdk_management_canister::canister_info(&CanisterInfoArgs {
                canister_id: args.canister_id,
                num_requested_changes: None,
            })
            .await
            {
                Ok(info) => info,
                Err(error) => return InternalError(format!("Failed to get canister info: {error:?}")),
            };

            let controllers = vec![result.this_canister_id];
            if canister_info.controllers != controllers {
                if let Err(error) = set_controllers(args.canister_id, controllers).await {
                    return InternalError(format!("Failed to set controller: {error:?}"));
                }
                info!("Updated controllers");
            }

            if canister_info.module_hash != Some(result.canister_wasm_hash.to_vec()) {
                let chunks = match upload_wasm_in_chunks(&result.canister_wasm.module, args.canister_id).await {
                    Ok(chunks) => chunks,
                    Err(error) => return InternalError(format!("Failed to upload wasm to chunks: {error:?}")),
                };

                if let Err(error) = install(CanisterToInstall {
                    canister_id: args.canister_id,
                    current_wasm_version: BuildVersion::default(),
                    new_wasm_version: result.canister_wasm.version,
                    new_wasm: WasmToInstall::Chunked(ChunkedWasmToInstall {
                        chunks,
                        wasm_hash: result.canister_wasm_hash,
                        store_canister_id: args.canister_id,
                    }),
                    // This canister's own balance isn't held back
                    top_up_keeping_balance_above: Some(0),
                    args: candid::encode_one(&result.init_args).unwrap(),
                    mode: CanisterInstallMode::Reinstall,
                    stop_start_canister: false,
                })
                .await
                {
                    return InternalError(format!("Failed to install canister: {error:?}"));
                }
                info!("Installed wasm");
            }

            // The MultiUser wasm is only pushed once one has been uploaded to the UserIndex, else
            // the new LocalUserIndex would reject the empty wasm with a hash mismatch
            if !result.multi_user_canister_wasm.module.is_empty()
                && let Err(error) = upgrade_multi_user_wasm_in_local_user_index(
                    args.canister_id,
                    &result.multi_user_canister_wasm,
                    result.multi_user_canister_wasm_hash,
                    None,
                )
                .await
            {
                return InternalError(format!("Failed to install multi user canister wasm: {error:?}"));
            }

            let response = mutate_state(|state| commit(args.canister_id, wasm_version, state));
            info!(canister_id = %args.canister_id, "local user index canister added");
            response
        }
        Err(response) => response,
    }
}

struct PrepareResult {
    this_canister_id: CanisterId,
    canister_wasm: CanisterWasm,
    canister_wasm_hash: Hash,
    multi_user_canister_wasm: CanisterWasm,
    multi_user_canister_wasm_hash: Hash,
    init_args: local_user_index_canister::init::Args,
}

fn prepare(args: &Args, state: &mut RuntimeState) -> Result<PrepareResult, Response> {
    if !state.data.local_index_map.contains_key(&args.canister_id) {
        let canister_wasm = state.data.child_canister_wasms.get(ChildCanisterType::LocalUserIndex);

        let multi_user_canister_wasm = state.data.child_canister_wasms.get(ChildCanisterType::MultiUser);

        Ok(PrepareResult {
            this_canister_id: state.env.canister_id(),
            canister_wasm: canister_wasm.wasm.clone(),
            canister_wasm_hash: canister_wasm.wasm_hash,
            multi_user_canister_wasm: multi_user_canister_wasm.wasm.clone(),
            multi_user_canister_wasm_hash: multi_user_canister_wasm.wasm_hash,
            init_args: local_user_index_canister::init::Args {
                wasm_version: canister_wasm.wasm.version,
                user_index_canister_id: state.env.canister_id(),
                group_index_canister_id: state.data.group_index_canister_id,
                notifications_index_canister_id: state.data.notifications_index_canister_id,
                identity_canister_id: state.data.identity_canister_id,
                proposals_bot_canister_id: state.data.proposals_bot_canister_id,
                cycles_dispenser_canister_id: state.data.cycles_dispenser_canister_id,
                escrow_canister_id: state.data.escrow_canister_id,
                event_relay_canister_id: state.data.event_store_client.info().event_store_canister_id,
                registry_canister_id: state.data.registry_canister_id,
                internet_identity_canister_id: state.data.internet_identity_canister_id,
                website_canister_id: state.data.website_canister_id,
                video_call_operators: state.data.video_call_operators.clone(),
                oc_secret_key_der: state.data.oc_key_pair.secret_key_der().to_vec(),
                rng_seed: state.env.rng().random(),
                ic_root_key: ic_cdk::api::root_key(),
                openai_api_key: state.data.openai_api_key.clone(),
                moderation_referral_config: state.data.moderation_referral_config.clone(),
                media_scan_config: state.data.media_scan_config.clone(),
                call_push_enabled: state.data.call_push_enabled,
                alchemy_api_key: state.data.alchemy_api_key.clone(),
                test_mode: state.data.test_mode,
            },
        })
    } else {
        Err(AlreadyAdded)
    }
}

fn commit(canister_id: CanisterId, wasm_version: BuildVersion, state: &mut RuntimeState) -> Response {
    if state.data.local_index_map.add_index(canister_id, wasm_version) {
        let now = state.env.now();
        let this_canister_id = state.env.canister_id();
        // Suspended moderators and operators aren't active ones
        let platform_moderators: HashSet<_> = state
            .data
            .platform_moderators
            .iter()
            .filter(|u| state.data.is_platform_moderator_active(u))
            .copied()
            .collect();
        let platform_operators: HashSet<_> = state
            .data
            .platform_operators
            .iter()
            .filter(|u| state.data.is_platform_operator_active(u))
            .copied()
            .collect();
        let mut pusher = LocalUserIndexEventPusher {
            now,
            rng: state.env.rng(),
            queue: &mut state.data.local_user_index_event_sync_queue_v2,
        };
        // We need to initialize the new local user index with all the existing users
        for user in state.data.users.iter() {
            pusher.push(
                canister_id,
                UserIndexEvent::SyncExistingUser(UserDetailsFull {
                    user_id: user.user_id,
                    user_principal: user.principal,
                    username: user.username.clone(),
                    user_type: user.user_type,
                    referred_by: user.referred_by,
                    is_platform_moderator: platform_moderators.contains(&user.user_id),
                    is_platform_operator: platform_operators.contains(&user.user_id),
                    diamond_membership_expires_at: user.diamond_membership_details.expires_at(),
                    unique_person_proof: user.unique_person_proof.clone(),
                }),
            )
        }
        for (item_id, chit_cost) in state.data.premium_items.chit_costs() {
            pusher.push(
                canister_id,
                UserIndexEvent::SetPremiumItemCost(SetPremiumItemCost { item_id, chit_cost }),
            )
        }
        if let Some(daily_puzzle_canister_id) = state.data.daily_puzzle_canister_id {
            pusher.push(
                canister_id,
                UserIndexEvent::SetDailyPuzzleCanisterId(daily_puzzle_canister_id),
            );
        }
        // In case the key was changed while the LocalUserIndex was being installed with the previous one
        pusher.push(
            canister_id,
            UserIndexEvent::SetAlchemyApiKey(SetAlchemyApiKey {
                api_key: state.data.alchemy_api_key.clone(),
            }),
        );
        // And with all the existing bots. The UserIndex is named as the canister to notify each bot
        // of its registration, since the bots were notified when they registered.
        for (bot_id, bot) in state.data.users.iter_bots() {
            let Some(user) = state.data.users.get_by_user_id(bot_id) else {
                continue;
            };
            let permitted_install_location = match &bot.registration_status {
                BotRegistrationStatus::Public => None,
                BotRegistrationStatus::Private(location) => *location,
            };
            pusher.push(
                canister_id,
                UserIndexEvent::BotRegistered(BotRegistered {
                    bot_id: *bot_id,
                    owner_id: bot.owner,
                    user_principal: user.principal,
                    name: bot.name.clone(),
                    commands: bot.definition.commands.clone(),
                    endpoint: bot.endpoint.clone(),
                    autonomous_config: bot.definition.autonomous_config.clone(),
                    permitted_install_location,
                    default_subscriptions: bot.definition.default_subscriptions.clone(),
                    data_encoding: bot.definition.data_encoding.unwrap_or_default(),
                    notification_canister: this_canister_id,
                }),
            );
            if matches!(bot.registration_status, BotRegistrationStatus::Public) {
                pusher.push(canister_id, UserIndexEvent::BotPublished(BotPublished { bot_id: *bot_id }));
            }
        }
        for (old_user_id, new_user_id) in state.data.migrated_user_ids.iter() {
            pusher.push(
                canister_id,
                UserIndexEvent::UserIdMigrated(UserIdMigrated {
                    old_user_id,
                    new_user_id,
                }),
            );
        }
        Success
    } else {
        AlreadyAdded
    }
}
