use crate::updates::c2c_unfreeze_group::c2c_unfreeze_group_impl;
use crate::{mutate_state, run_regular_jobs, CommunityBeingImportedInto, RuntimeState, StartImportIntoCommunityResult};
use candid::Principal;
use canister_tracing_macros::trace;
use group_canister::convert_into_community::{Response::*, *};
use ic_cdk_macros::update;
use rand::Rng;
use types::{CanisterId, UserId};
use utils::consts::OPENCHAT_BOT_USER_ID;

#[update]
#[trace]
async fn convert_into_community(args: Args) -> Response {
    run_regular_jobs();

    let PrepareResult {
        caller,
        user_id,
        user_index_canister_id,
        group_index_canister_id,
    } = match mutate_state(prepare) {
        Ok(result) => result,
        Err(response) => return response,
    };

    match user_index_canister_c2c_client::lookup_user(caller, user_index_canister_id).await {
        Ok(user) if user.is_diamond_member => {}
        _ => return NotAuthorized,
    }

    let c2c_args = match mutate_state(|state| start_import(caller, user_id, args, state)) {
        Ok(args) => args,
        Err(response) => return response,
    };

    match group_index_canister_c2c_client::c2c_convert_group_into_community(group_index_canister_id, &c2c_args).await {
        Ok(group_index_canister::c2c_convert_group_into_community::Response::Success(community_id)) => {
            mutate_state(|state| {
                state.data.community_being_imported_into = Some(CommunityBeingImportedInto::Existing(community_id))
            });
            Success(SuccessResult {
                community_id,
                channel_id: c2c_args.channel_id,
            })
        }
        Ok(group_index_canister::c2c_convert_group_into_community::Response::InternalError(error)) => InternalError(error),
        Err(error) => {
            mutate_state(rollback);
            InternalError(format!("{error:?}"))
        }
    }
}

struct PrepareResult {
    caller: Principal,
    user_id: UserId,
    user_index_canister_id: CanisterId,
    group_index_canister_id: CanisterId,
}

fn prepare(state: &mut RuntimeState) -> Result<PrepareResult, Response> {
    let caller = state.env.caller();

    if let Some(member) = state.data.get_member(caller) {
        if member.suspended.value {
            Err(UserSuspended)
        } else if !member.role.is_owner() {
            Err(NotAuthorized)
        } else {
            Ok(PrepareResult {
                caller,
                user_id: member.user_id,
                user_index_canister_id: state.data.user_index_canister_id,
                group_index_canister_id: state.data.group_index_canister_id,
            })
        }
    } else {
        Err(CallerNotInGroup)
    }
}

fn start_import(
    caller: Principal,
    user_id: UserId,
    args: Args,
    state: &mut RuntimeState,
) -> Result<group_index_canister::c2c_convert_group_into_community::Args, Response> {
    match state.start_importing_into_community(CommunityBeingImportedInto::New) {
        StartImportIntoCommunityResult::Success(total_bytes) => {
            Ok(group_index_canister::c2c_convert_group_into_community::Args {
                channel_id: state.env.rng().gen(),
                user_id,
                user_principal: caller,
                name: state.data.chat.name.clone(),
                description: state.data.chat.description.clone(),
                rules: args.rules,
                permissions: args.permissions,
                gate: state.data.chat.gate.value.clone(),
                primary_language: args.primary_language.unwrap_or_else(|| "en".to_string()),
                history_visible_to_new_joiners: args.history_visible_to_new_joiners,
                total_bytes,
            })
        }
        StartImportIntoCommunityResult::AlreadyImportingToAnotherCommunity => Err(AlreadyImportingToAnotherCommunity),
        StartImportIntoCommunityResult::ChatFrozen => Err(ChatFrozen),
    }
}

fn rollback(state: &mut RuntimeState) {
    state.data.community_being_imported_into = None;
    state.data.serialized_chat_state = None;

    c2c_unfreeze_group_impl(OPENCHAT_BOT_USER_ID, state);
}
