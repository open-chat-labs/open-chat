use crate::{execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use event_store_types::EventBuilder;
use ledger_utils::format_crypto_amount;
use local_user_index_canister::UserEvent as LocalUserIndexEvent;
use types::{Achievement, UserIdAndPrincipal};
use user_canister::update_btc_balance::*;
use user_core::openchat_bot::{btc_deposit_failed_text, btc_deposit_received_text};
use user_core::updates::update_btc_balance::{BtcDepositOrWithdrawalEventPayload, update_btc_balance as update};

#[update(msgpack = true)]
#[trace]
async fn update_btc_balance(_args: Args) -> Response {
    execute_update_async(update_btc_balance_impl).await
}

async fn update_btc_balance_impl() -> Response {
    let (my_user_id, principal, test_mode) = read_state(|state| {
        (
            state.env.canister_id().into(),
            state.data.user.principal,
            state.data.test_mode,
        )
    });

    let result = match update(UserIdAndPrincipal::new(my_user_id, principal), test_mode).await {
        Ok(result) => result,
        Err(error) => return Response::Error(error),
    };

    mutate_state(|state| {
        if result.minted > 0 {
            let formatted = format_crypto_amount(result.minted as u128, 8);
            crate::openchat_bot::send_text_message(btc_deposit_received_text(&formatted), Vec::new(), false, state);
            let user_id_string = my_user_id.to_string();
            let now = state.env.now();
            state.push_local_user_index_canister_event(
                LocalUserIndexEvent::EventStoreEvent(
                    EventBuilder::new("btc_deposit", now)
                        .with_user(user_id_string.clone(), true)
                        .with_source(user_id_string, true)
                        .with_json_payload(&BtcDepositOrWithdrawalEventPayload { amount: result.minted })
                        .build(),
                ),
                now,
            );
            state.award_achievement_and_notify(Achievement::DepositedBtc, now);
        }
        for error in result.errors {
            crate::openchat_bot::send_text_message(btc_deposit_failed_text(&error), Vec::new(), false, state);
        }
    });

    Response::Success
}
