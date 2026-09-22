use crate::{mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use event_store_types::EventBuilder;
use ledger_utils::format_crypto_amount;
use local_user_index_canister::UserEvent as LocalUserIndexEvent;
use types::Achievement;
use user_canister::update_btc_balance::*;
use user_core::openchat_bot::{btc_deposit_failed_text, btc_deposit_received_text};
use user_core::updates::update_btc_balance::{BtcDepositOrWithdrawalEventPayload, update_btc_balance as update};

// Only the user, or the LocalUserIndex for them, may ask for their balance to be updated. The User
// canister lets anyone, but a canister holding many users would let one caller have it poll the
// minter for every one of them.
#[update(msgpack = true)]
#[trace]
async fn update_btc_balance(args: Args) -> Response {
    let (user_index, test_mode) = match read_state(|state| {
        state
            .authorized_user_index(args.user_id)
            .map(|index| (index, state.data.test_mode))
    }) {
        Ok(ok) => ok,
        Err(error) => return Response::Error(error),
    };

    let result = match update(args.user_id, test_mode).await {
        Ok(result) => result,
        Err(error) => return Response::Error(error),
    };

    mutate_state(|state| {
        let now = state.env.now();
        if result.minted > 0 {
            let formatted = format_crypto_amount(result.minted as u128, 8);
            crate::openchat_bot::send_text_message(user_index, btc_deposit_received_text(&formatted), Vec::new(), false, state);
            let user_id_string = args.user_id.to_string();
            state.push_local_user_index_canister_event(
                user_index,
                LocalUserIndexEvent::EventStoreEvent(
                    EventBuilder::new("btc_deposit", now)
                        .with_user(user_id_string.clone(), true)
                        .with_source(user_id_string, true)
                        .with_json_payload(&BtcDepositOrWithdrawalEventPayload { amount: result.minted })
                        .build(),
                ),
                now,
            );
            state.award_achievement_and_notify(user_index, Achievement::DepositedBtc, now);
        }
        for error in result.errors {
            crate::openchat_bot::send_text_message(user_index, btc_deposit_failed_text(&error), Vec::new(), false, state);
        }
    });

    Response::Success
}
