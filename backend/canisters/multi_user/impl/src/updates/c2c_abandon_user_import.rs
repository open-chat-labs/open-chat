use crate::guards::caller_is_user_index;
use crate::updates::c2c_import_user::abandon_import;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use multi_user_canister::c2c_abandon_user_import::{Response::*, *};

#[update(guard = "caller_is_user_index", msgpack = true)]
#[trace]
fn c2c_abandon_user_import(args: Args) -> Response {
    mutate_state(|state| c2c_abandon_user_import_impl(args, state))
}

fn c2c_abandon_user_import_impl(args: Args, state: &mut RuntimeState) -> Response {
    let old_user_id = args.user_id;
    let latest_user_id = state.data.migrated_user_ids.latest(old_user_id);
    if latest_user_id != old_user_id && state.index_of_local_user(latest_user_id).is_some() {
        return AlreadyImported(latest_user_id);
    }

    abandon_import(old_user_id, state);
    state.data.abandoned_user_imports.insert(args.user_hash);
    Success
}
