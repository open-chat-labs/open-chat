use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::OCResult;
use user_canister::update_chat_settings::*;
use user_canister::{SetEventsTtl, UserCanisterEvent};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn update_chat_settings(args: Args) -> Response {
    execute_update(|state| update_chat_settings_impl(args, state)).into()
}

fn update_chat_settings_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let chat = state.data.direct_chats.get_mut_or_err(&args.user_id.into())?;
    let now = state.env.now();

    if let Some(events_ttl) = args.events_ttl.expand() {
        chat.events
            .set_events_time_to_live(state.env.canister_id().into(), events_ttl, now);

        state.push_user_canister_event(
            args.user_id.into(),
            UserCanisterEvent::SetEventsTtl(Box::new(SetEventsTtl {
                events_ttl,
                timestamp: now,
            })),
        );
    }

    Ok(())
}
