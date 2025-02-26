use crate::guards::caller_is_governance_principal;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use local_user_index_canister::{BotPublished, UserIndexEvent};
use user_index_canister::publish_bot::{Args, Response};

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
fn publish_bot(args: Args) -> Response {
    mutate_state(|state| publish_bot_impl(args, state))
}

fn publish_bot_impl(args: Args, state: &mut RuntimeState) -> Response {
    if !state.data.users.publish_bot(args.bot_id, state.env.now()) {
        return Response::NotFound;
    }

    state.push_event_to_all_local_user_indexes(UserIndexEvent::BotPublished(BotPublished { bot_id: args.bot_id }), None);

    Response::Success
}
