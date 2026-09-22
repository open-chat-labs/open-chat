use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::OCResult;
use types::c2c_uninstall_bot::*;

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_uninstall_bot(args: Args) -> Response {
    execute_update(|state| c2c_uninstall_bot_impl(args, state)).into()
}

fn c2c_uninstall_bot_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let my_user_id = state.env.canister_id().into();
    let now = state.env.now();
    let prefixes = user_core::updates::c2c_uninstall_bot(&mut state.data.user, &args, my_user_id, now)?;
    state.garbage_collect_stable_memory_keys(prefixes);
    Ok(())
}
