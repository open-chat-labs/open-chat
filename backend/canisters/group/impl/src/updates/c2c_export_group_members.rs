use crate::guards::caller_is_community_being_imported_into;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use group_canister::c2c_export_group_members::{Response::*, *};

#[update(guard = "caller_is_community_being_imported_into", msgpack = true)]
fn c2c_export_group_members(args: Args) -> Response {
    execute_update(|state| c2c_export_group_members_impl(args, state))
}

fn c2c_export_group_members_impl(args: Args, state: &RuntimeState) -> Response {
    let members = state.data.chat.members.read_members_as_bytes_from_stable_memory(args.after);

    Success(SuccessResult {
        finished: members.is_empty(),
        members,
    })
}
