use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use local_user_index_canister::migrated_user_ids::{Response::*, *};

#[query(msgpack = true)]
fn migrated_user_ids(args: Args) -> Response {
    read_state(|state| migrated_user_ids_impl(args, state))
}

fn migrated_user_ids_impl(args: Args, state: &RuntimeState) -> Response {
    Success(state.data.migrated_user_ids.get_many(args.user_ids))
}
