use crate::{mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use registry_canister::add_message_filter::{Response::*, *};
use user_index_canister_c2c_client::lookup_user;

#[update(msgpack = true)]
#[trace]
async fn add_message_filter(args: Args) -> Response {
    if args.regex.len() > 1000 {
        return InvalidRequest("Too long".to_string());
    }

    let (caller, user_index_canister_id) = read_state(|state| (state.env.caller(), state.data.user_index_canister_id));

    match lookup_user(caller, user_index_canister_id).await {
        Ok(Some(user)) if user.is_platform_moderator => (),
        Ok(_) => return NotAuthorized,
        Err(error) => return InternalError(format!("{error:?}")),
    }

    mutate_state(|state| match state.data.message_filters.add(args.regex, state.env.now()) {
        Some(id) => Success(id),
        None => AlreadyAdded,
    })
}
