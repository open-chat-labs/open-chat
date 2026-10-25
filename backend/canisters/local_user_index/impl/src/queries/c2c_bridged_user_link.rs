use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use local_user_index_canister::c2c_bridged_user_link::{Response::*, *};

// Who has linked an account on another platform, as the UserIndex has told this canister, eg. so a
// group can pay the tips given to the account's relayed messages to them
#[query(msgpack = true)]
fn c2c_bridged_user_link(args: Args) -> Response {
    read_state(|state| c2c_bridged_user_link_impl(args, state))
}

fn c2c_bridged_user_link_impl(args: Args, state: &RuntimeState) -> Response {
    // A link proves the account can be linked, whatever its profile has said
    if let Some(linked_user) = state.data.bridged_user_links.get(&args.user) {
        Success(Some(*linked_user))
    } else if !args.user.can_be_linked() || state.data.unlinkable_bridged_users.contains(&args.user) {
        CantBeLinked
    } else {
        Success(None)
    }
}
