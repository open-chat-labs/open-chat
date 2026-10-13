use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use multi_user_canister::set_contact::*;
use types::OCResult;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn set_contact(args: Args) -> Response {
    execute_update(|state| set_contact_impl(args, state)).into()
}

fn set_contact_impl(mut args: Args, state: &mut RuntimeState) -> OCResult {
    // A client which hasn't yet heard that the user has been migrated to a MultiUser canister names
    // them by their old id
    args.contact.user_id = state.data.migrated_user_ids.latest(args.contact.user_id);
    state.with_caller_user_mut(|_, user| user_core::updates::set_contact(user, args))
}
