use crate::guards::caller_is_service_principal;
use crate::model::bucket_sync_state::EventToSync;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use storage_index_canister::remove_user::*;

#[update(guard = "caller_is_service_principal")]
#[trace]
fn remove_user(args: Args) -> Response {
    mutate_state(|state| remove_user_impl(args, state))
}

fn remove_user_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.data.users.remove(&args.user_id);
    runtime_state.data.buckets.sync_event(EventToSync::UserRemoved(args.user_id));
    Response::Success
}
