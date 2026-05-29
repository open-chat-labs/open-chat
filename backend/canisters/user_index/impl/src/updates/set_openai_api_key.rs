use crate::guards::caller_is_platform_operator;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::{SetOpenAIApiKey, UserIndexEvent};
use user_index_canister::set_openai_api_key::*;

#[update(guard = "caller_is_platform_operator", msgpack = true)]
#[trace]
fn set_openai_api_key(args: Args) -> Response {
    mutate_state(|state| set_openai_api_key_impl(args, state))
}

fn set_openai_api_key_impl(args: Args, state: &mut RuntimeState) -> Response {
    state.data.openai_api_key = args.api_key.clone();

    state.push_event_to_all_local_user_indexes(
        UserIndexEvent::SetOpenAIApiKey(SetOpenAIApiKey { api_key: args.api_key }),
        None,
    );

    Response::Success
}
