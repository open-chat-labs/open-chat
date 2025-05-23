use crate::guards::caller_is_owner;
use crate::updates::update_btc_balance::BtcDepositOrWithdrawalEventPayload;
use crate::{execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use ckbtc_minter_canister::CKBTC_MINTER_CANISTER_ID;
use constants::{CKBTC_LEDGER_CANISTER_ID, MINUTE_IN_MS, NANOS_PER_MILLISECOND};
use event_store_producer::EventBuilder;
use local_user_index_canister::UserEvent as LocalUserIndexEvent;
use oc_error_codes::OCErrorCode;
use user_canister::withdraw_btc::{Response::*, *};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn withdraw_btc(args: Args) -> Response {
    execute_update_async(|| withdraw_btc_impl(args)).await
}

async fn withdraw_btc_impl(args: Args) -> Response {
    if let Err(error) = mutate_state(|state| state.data.pin_number.verify(args.pin.as_deref(), state.env.now())) {
        return Error(error.into());
    }

    let now_nanos = read_state(|state| state.env.now_nanos());

    match icrc_ledger_canister_c2c_client::icrc2_approve(
        CKBTC_LEDGER_CANISTER_ID,
        &icrc_ledger_canister::icrc2_approve::Args {
            from_subaccount: None,
            spender: CKBTC_MINTER_CANISTER_ID.into(),
            amount: args.amount.into(),
            expected_allowance: None,
            expires_at: Some(now_nanos + (5 * MINUTE_IN_MS * NANOS_PER_MILLISECOND)),
            fee: None,
            memo: None,
            created_at_time: Some(now_nanos),
        },
    )
    .await
    {
        Ok(Ok(_)) => {}
        Ok(Err(error)) => return Error(OCErrorCode::ApprovalFailed.with_json(&error)),
        Err(error) => return Error(error.into()),
    }

    match ckbtc_minter_canister_c2c_client::retrieve_btc_with_approval(
        CKBTC_MINTER_CANISTER_ID,
        &ckbtc_minter_canister::retrieve_btc_with_approval::Args {
            amount: args.amount,
            address: args.address,
            from_subaccount: None,
        },
    )
    .await
    {
        Ok(Ok(result)) => {
            mutate_state(|state| {
                let user_id_string = state.env.canister_id().to_string();
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
            Success(result.block_index)
        }
        Ok(Err(error)) => Error(OCErrorCode::Unknown.with_json(&error)),
        Err(error) => Error(error.into()),
    }
}
