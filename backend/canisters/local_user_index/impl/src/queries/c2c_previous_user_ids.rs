use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use local_user_index_canister::c2c_previous_user_ids::{Response::*, *};

// Groups and communities check a gate under these as well as the user's id, since a user's tokens can
// still be in their old canister's wallet, and a neuron can still list their old canister
#[query(msgpack = true)]
fn c2c_previous_user_ids(args: Args) -> Response {
    read_state(|state| c2c_previous_user_ids_impl(args, state))
}

fn c2c_previous_user_ids_impl(args: Args, state: &RuntimeState) -> Response {
    Success(state.data.migrated_user_ids.previous_ids(args.user_id))
}
