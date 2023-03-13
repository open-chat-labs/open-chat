use crate::{read_state, RuntimeState};
use candid::Principal;
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use proposals_bot_canister::update_group_details::{Response::*, *};
use types::{CanisterId, OptionUpdate};
use user_index_canister_c2c_client::{lookup_user, LookupUserError};

#[update]
#[trace]
async fn update_group_details(args: Args) -> Response {
    // 1. Lookup group_id etc from RuntimeState
    let PrepareResult {
        caller,
        group_id,
        user_index_canister_id,
    } = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    // 2. Check whether the caller is a platform operator
    match lookup_user(caller, user_index_canister_id).await {
        Ok(user) if user.is_platform_operator => (),
        Ok(_) | Err(LookupUserError::UserNotFound) => return NotAuthorized,
        Err(LookupUserError::InternalError(error)) => return InternalError(error),
    };

    // 3. Call the group canister to update the details
    match call_group_to_update_details(args, group_id).await {
        Ok(_) => Success,
        Err(response) => response,
    }
}

struct PrepareResult {
    caller: Principal,
    group_id: CanisterId,
    user_index_canister_id: CanisterId,
}

fn prepare(args: &Args, state: &RuntimeState) -> Result<PrepareResult, Response> {
    if let Some(group_id) = state.data.nervous_systems.get_chat_id(&args.governance_canister_id) {
        Ok(PrepareResult {
            caller: state.env.caller(),
            group_id: group_id.into(),
            user_index_canister_id: state.data.user_index_canister_id,
        })
    } else {
        Err(NotFound)
    }
}

async fn call_group_to_update_details(args: Args, group_id: CanisterId) -> Result<(), Response> {
    let args = group_canister::update_group_v2::Args {
        name: args.name,
        description: args.description,
        rules: None,
        avatar: args.avatar,
        permissions: None,
        events_ttl: OptionUpdate::NoChange,
        correlation_id: 0,
    };

    match group_canister_c2c_client::update_group_v2(group_id, &args).await {
        Ok(result) => match result {
            group_canister::update_group_v2::Response::Success => Ok(()),
            group_canister::update_group_v2::Response::NotAuthorized => Err(NotAuthorized),
            group_canister::update_group_v2::Response::NameTooShort(_) => Err(NameTooShort),
            group_canister::update_group_v2::Response::NameTooLong(_) => Err(NameTooLong),
            group_canister::update_group_v2::Response::NameTaken => Err(NameTaken),
            group_canister::update_group_v2::Response::NameReserved => Err(NameTaken),
            group_canister::update_group_v2::Response::DescriptionTooLong(_) => Err(DescriptionTooLong),
            group_canister::update_group_v2::Response::AvatarTooBig(_) => Err(AvatarTooBig),
            group_canister::update_group_v2::Response::CallerNotInGroup => {
                Err(InternalError("ProposalsBot not in group".to_string()))
            }
            group_canister::update_group_v2::Response::UserSuspended => {
                Err(InternalError("ProposalsBot suspended".to_string()))
            }
            group_canister::update_group_v2::Response::ChatFrozen => Err(InternalError("Group frozen".to_string())),
            group_canister::update_group_v2::Response::InternalError => Err(InternalError(
                "Unknown error calling group_canister::update_group_v2".to_string(),
            )),
            group_canister::update_group_v2::Response::RulesTooShort(_) => unreachable!(),
            group_canister::update_group_v2::Response::RulesTooLong(_) => unreachable!(),
        },
        Err(error) => Err(InternalError(format!("{error:?}"))),
    }
}
