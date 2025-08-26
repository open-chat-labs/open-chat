use crate::updates::c2c_unfreeze_group::c2c_unfreeze_group_impl;
use crate::{CommunityBeingImportedInto, RuntimeState, execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::OPENCHAT_BOT_USER_ID;
use group_canister::convert_into_community::{Response::*, *};
use ic_principal::Principal;
use oc_error_codes::OCErrorCode;
use rand::RngCore;
use std::collections::HashMap;
use types::{CanisterId, OCResult, UserId};

#[update(msgpack = true)]
#[trace]
async fn convert_into_community(args: Args) -> Response {
    execute_update_async(|| convert_into_community_impl(args)).await
}

async fn convert_into_community_impl(args: Args) -> Response {
    let PrepareResult {
        caller,
        user_id,
        user_index_canister_id,
        group_index_canister_id,
    } = match read_state(prepare) {
        Ok(result) => result,
        Err(error) => return Error(error),
    };

    match user_index_canister_c2c_client::lookup_user(caller, user_index_canister_id).await {
        Ok(Some(user)) if user.is_diamond_member => {}
        _ => return Error(OCErrorCode::InitiatorNotAuthorized.into()),
    }

    let StartImportResult {
        c2c_args,
        transfers_required,
    } = match mutate_state(|state| start_import(caller, user_id, args, state)) {
        Ok(ok) => ok,
        Err(error) => return Error(error),
    };

    match group_index_canister_c2c_client::c2c_convert_group_into_community(group_index_canister_id, &c2c_args).await {
        Ok(group_index_canister::c2c_convert_group_into_community::Response::Success(community_id)) => {
            mutate_state(|state| {
                state.data.community_being_imported_into = Some(CommunityBeingImportedInto::Existing(community_id));
                state.transfer_funds_to_community_being_imported_into(community_id, &transfers_required);
            });
            Success(SuccessResult {
                community_id,
                channel_id: c2c_args.channel_id,
            })
        }
        Ok(group_index_canister::c2c_convert_group_into_community::Response::Error(error)) => {
            mutate_state(rollback);
            Error(error)
        }
        Ok(group_index_canister::c2c_convert_group_into_community::Response::InternalError(error)) => {
            mutate_state(rollback);
            Error(OCErrorCode::Unknown.with_message(error))
        }
        Err(error) => {
            mutate_state(rollback);
            Error(error.into())
        }
    }
}

struct PrepareResult {
    caller: Principal,
    user_id: UserId,
    user_index_canister_id: CanisterId,
    group_index_canister_id: CanisterId,
}

fn prepare(state: &RuntimeState) -> OCResult<PrepareResult> {
    let member = state.get_calling_member(true)?;
    if !member.role().is_owner() {
        Err(OCErrorCode::InitiatorNotAuthorized.into())
    } else {
        Ok(PrepareResult {
            caller: state.env.caller(),
            user_id: member.user_id(),
            user_index_canister_id: state.data.user_index_canister_id,
            group_index_canister_id: state.data.group_index_canister_id,
        })
    }
}

struct StartImportResult {
    c2c_args: group_index_canister::c2c_convert_group_into_community::Args,
    transfers_required: HashMap<CanisterId, (u128, u128)>,
}

fn start_import(caller: Principal, user_id: UserId, args: Args, state: &mut RuntimeState) -> OCResult<StartImportResult> {
    let result = state.start_importing_into_community(CommunityBeingImportedInto::New)?;
    let c2c_args = group_index_canister::c2c_convert_group_into_community::Args {
        channel_id: state.env.rng().next_u32().into(),
        user_id,
        user_principal: caller,
        name: state.data.chat.name.value.clone(),
        description: state.data.chat.description.value.clone(),
        rules: args.rules,
        avatar: state.data.chat.avatar.value.clone(),
        permissions: args.permissions,
        gate_config: state.data.chat.gate_config.value.clone().map(|gc| gc.into()),
        primary_language: args.primary_language.unwrap_or_else(|| "en".to_string()),
        history_visible_to_new_joiners: args.history_visible_to_new_joiners,
        total_bytes: result.total_bytes,
    };

    Ok(StartImportResult {
        c2c_args,
        transfers_required: result.transfers_required,
    })
}

fn rollback(state: &mut RuntimeState) {
    state.data.community_being_imported_into = None;
    state.data.serialized_chat_state = None;

    c2c_unfreeze_group_impl(OPENCHAT_BOT_USER_ID, state);
}
