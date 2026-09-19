use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use user_canister::chit_events::*;

#[query(guard = "caller_is_hosted_user", msgpack = true)]
fn chit_events(args: Args) -> Response {
    read_state(|state| chit_events_impl(args, state))
}

fn chit_events_impl(args: Args, state: &RuntimeState) -> Response {
    let (events, total) = state.with_caller_user(|_, user| {
        user.chit_events.events(
            args.from,
            args.to,
            args.skip.unwrap_or_default() as usize,
            args.max as usize,
            args.ascending,
        )
    });

    Response::Success(SuccessResult { events, total })
}
