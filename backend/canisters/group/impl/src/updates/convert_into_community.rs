use crate::updates::c2c_unfreeze_group::c2c_unfreeze_group_impl;
use crate::{mutate_state, run_regular_jobs, CommunityBeingImportedInto, RuntimeState, StartImportIntoCommunityResult};
use canister_tracing_macros::trace;
use group_canister::convert_into_community::{Response::*, *};
use ic_cdk_macros::update;
use types::CanisterId;
use utils::consts::OPENCHAT_BOT_USER_ID;

#[update]
#[trace]
async fn convert_into_community(args: Args) -> Response {
    run_regular_jobs();

    let PrepareResult {
        group_index_canister_id,
        c2c_args,
    } = match mutate_state(|state| prepare(args, state)) {
        Ok(result) => result,
        Err(response) => return response,
    };

    match group_index_canister_c2c_client::c2c_convert_group_into_community(group_index_canister_id, &c2c_args).await {
        Ok(group_index_canister::c2c_convert_group_into_community::Response::Success(community_id)) => {
            mutate_state(|state| {
                state.data.community_being_imported_into = Some(CommunityBeingImportedInto::Existing(community_id))
            });
            Success(community_id)
        }
        Ok(group_index_canister::c2c_convert_group_into_community::Response::InternalError(error)) => InternalError(error),
        Err(error) => {
            mutate_state(rollback);
            InternalError(format!("{error:?}"))
        }
    }
}

struct PrepareResult {
    group_index_canister_id: CanisterId,
    c2c_args: group_index_canister::c2c_convert_group_into_community::Args,
}

fn prepare(args: Args, state: &mut RuntimeState) -> Result<PrepareResult, Response> {
    let caller = state.env.caller();

    if let Some(member) = state.data.get_member(caller) {
        if member.suspended.value {
            Err(UserSuspended)
        } else if !member.role.is_owner() {
            Err(NotAuthorized)
        } else {
            let user_id = member.user_id;
            match state.start_importing_into_community(CommunityBeingImportedInto::New) {
                StartImportIntoCommunityResult::Success(total_bytes) => Ok(PrepareResult {
                    group_index_canister_id: state.data.group_index_canister_id,
                    c2c_args: group_index_canister::c2c_convert_group_into_community::Args {
                        user_id,
                        user_principal: caller,
                        name: state.data.chat.name.clone(),
                        description: state.data.chat.description.clone(),
                        rules: args.rules,
                        permissions: args.permissions,
                        gate: state.data.chat.gate.value.clone(),
                        history_visible_to_new_joiners: args.history_visible_to_new_joiners,
                        total_bytes,
                    },
                }),
                StartImportIntoCommunityResult::AlreadyImportingToAnotherCommunity => Err(AlreadyImportingToAnotherCommunity),
                StartImportIntoCommunityResult::ChatFrozen => Err(ChatFrozen),
            }
        }
    } else {
        Err(CallerNotInGroup)
    }
}

fn rollback(state: &mut RuntimeState) {
    state.data.community_being_imported_into = None;
    state.data.serialized_chat_state = None;

    c2c_unfreeze_group_impl(OPENCHAT_BOT_USER_ID, state);
}
