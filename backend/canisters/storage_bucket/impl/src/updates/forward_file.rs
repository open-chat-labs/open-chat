use crate::guards::caller_is_known_user;
use crate::model::files::ForwardFileResult;
use crate::model::index_sync_state::EventToSync;
use crate::model::users::{FileStatusInternal, IndexSyncComplete};
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use rand::Rng;
use storage_bucket_canister::forward_file::{Response::*, *};

#[update(guard = "caller_is_known_user")]
#[trace]
fn forward_file(args: Args) -> Response {
    mutate_state(|state| forward_file_impl(args, state))
}

fn forward_file_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let now = runtime_state.env.now();
    let canister_id = runtime_state.env.canister_id();
    let file_id_seed: u128 = runtime_state.env.rng().gen();
    let accessors = args.accessors.into_iter().collect();

    match runtime_state
        .data
        .files
        .forward(caller, args.file_id, canister_id, file_id_seed, accessors, now)
    {
        ForwardFileResult::Success(f) => {
            let user = runtime_state.data.users.get_mut(&caller).unwrap();
            let file_id = f.file_id;
            user.set_file_status(file_id, FileStatusInternal::Complete(IndexSyncComplete::No));
            runtime_state.data.index_sync_state.enqueue(EventToSync::FileAdded(f));
            Success(file_id)
        }
        // TODO Add this back in once we support access tokens
        // ForwardFileResult::NotAuthorized => NotAuthorized,
        ForwardFileResult::NotFound => NotFound,
    }
}
