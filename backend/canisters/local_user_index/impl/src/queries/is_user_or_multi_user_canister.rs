use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use local_user_index_canister::is_user_or_multi_user_canister::*;

// Lets a MultiUser canister check that a canister calling it on behalf of its users is a MultiUser
// canister, so holds users itself. Every LocalUserIndex holds all users, so this can be answered
// without a cross-subnet call to the UserIndex. Unlike the UserIndex, it only knows of a MultiUser
// canister on another LocalUserIndex once one of its users has registered, but until then that
// canister has no users to act for anyway
#[query(msgpack = true)]
fn is_user_or_multi_user_canister(args: Args) -> Response {
    read_state(|state| is_user_or_multi_user_canister_impl(args, state))
}

fn is_user_or_multi_user_canister_impl(args: Args, state: &RuntimeState) -> Response {
    if state.data.global_users.multi_user_canisters().contains(&args.canister_id) {
        Response::MultiUserCanister
    } else {
        Response::Neither
    }
}
