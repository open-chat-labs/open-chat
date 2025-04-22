use crate::guards::caller_is_group_index_or_local_group_index;
use crate::{CommunityBeingImportedInto, RuntimeState, mutate_state, run_regular_jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::c2c_start_import_into_community::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::OCResult;

#[update(guard = "caller_is_group_index_or_local_group_index", msgpack = true)]
#[trace]
fn c2c_start_import_into_community(args: Args) -> Response {
    run_regular_jobs();

    match mutate_state(|state| c2c_start_import_into_community_impl(args, state)) {
        Ok(total_bytes) => Success(total_bytes),
        Err(error) => Error(error),
    }
}

fn c2c_start_import_into_community_impl(args: Args, state: &mut RuntimeState) -> OCResult<u64> {
    if args.user_id != state.data.proposals_bot_user_id {
        let member = state.data.chat.members.get_verified_member(args.user_id)?;
        if !member.role().is_owner() {
            return Err(OCErrorCode::InitiatorNotAuthorized.into());
        }
    }

    state
        .start_importing_into_community(CommunityBeingImportedInto::Existing(args.community_id))
        .map(|result| result.total_bytes)
}
