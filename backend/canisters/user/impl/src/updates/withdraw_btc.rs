use crate::guards::caller_is_owner;
use crate::{execute_update_async, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use event_store_types::EventBuilder;
use local_user_index_canister::UserEvent as LocalUserIndexEvent;
use types::UserId;
use user_canister::withdraw_btc::{Response::*, *};
use user_core::updates::update_btc_balance::BtcDepositOrWithdrawalEventPayload;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn withdraw_btc(args: Args) -> Response {
    execute_update_async(|| withdraw_btc_impl(args)).await
}

async fn withdraw_btc_impl(mut args: Args) -> Response {
    let (my_user_id, now_nanos) = match mutate_state(|state| {
        state
            .data
            .user
            .pin_number
            .verify(args.pin.as_mut(), state.env.now())
            .map(|()| (UserId::from(state.env.canister_id()), state.env.now_nanos()))
    }) {
        Ok(ok) => ok,
        Err(error) => return Error(error.into()),
    };

    match user_core::updates::withdraw_btc::withdraw_btc(&args, now_nanos).await {
        Ok(block_index) => {
            mutate_state(|state| {
                let user_id_string = my_user_id.to_string();
                let now = state.env.now();
                state.push_local_user_index_canister_event(
                    LocalUserIndexEvent::EventStoreEvent(
                        EventBuilder::new("btc_withdrawal", now)
                            .with_user(user_id_string.clone(), true)
                            .with_source(user_id_string, true)
                            .with_json_payload(&BtcDepositOrWithdrawalEventPayload { amount: args.amount })
                            .build(),
                    ),
                    now,
                );
            });
            Success(block_index)
        }
        Err(error) => Error(error),
    }
}
