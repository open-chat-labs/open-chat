use crate::guards::caller_is_hosted_user;
use crate::mutate_state;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use event_store_types::EventBuilder;
use local_user_index_canister::UserEvent as LocalUserIndexEvent;
use types::UserId;
use user_canister::withdraw_btc::{Response::*, *};
use user_core::updates::update_btc_balance::BtcDepositOrWithdrawalEventPayload;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
async fn withdraw_btc(mut args: Args) -> Response {
    let (my_index, my_user_id, now_nanos) = match mutate_state(|state| {
        let now = state.env.now();
        let now_nanos = state.env.now_nanos();
        let canister_id = state.env.canister_id();
        state.with_caller_user_mut(|my_index, user| {
            user.pin_number
                .verify(args.pin.as_mut(), now)
                .map(|()| (my_index, UserId::new_indexed(canister_id, my_index), now_nanos))
        })
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
                    my_index,
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
