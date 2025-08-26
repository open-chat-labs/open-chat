use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use rand::Rng;
use types::{CanisterId, OCResult, UserId};
use user_canister::update_chat_settings::*;
use user_canister::{SetEventsTtl, UserCanisterEvent};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn update_chat_settings(args: Args) -> Response {
    execute_update_async(|| update_chat_settings_impl(args)).await.into()
}

async fn update_chat_settings_impl(args: Args) -> OCResult {
    if let Err(local_user_index_canister) = read_state(|state| check_chat_exists(args.user_id, state)) {
        let user = local_user_index_canister_c2c_client::lookup_user(args.user_id.into(), local_user_index_canister)
            .await?
            .ok_or(OCErrorCode::TargetUserNotFound)?;

        mutate_state(|state| {
            let now = state.env.now();
            state
                .data
                .direct_chats
                .get_or_create(args.user_id, user.user_type, || state.env.rng().r#gen(), now);
        });
    }

    mutate_state(|state| {
        let chat = state.data.direct_chats.get_mut(&args.user_id.into()).unwrap();

        if let Some(events_ttl) = args.events_ttl.expand() {
            let now = state.env.now();

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
    });

    Ok(())
}

fn check_chat_exists(user_id: UserId, state: &RuntimeState) -> Result<(), CanisterId> {
    if state.data.direct_chats.exists(&user_id.into()) {
        Ok(())
    } else {
        Err(state.data.local_user_index_canister_id)
    }
}
