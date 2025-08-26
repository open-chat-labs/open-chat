use crate::guards::caller_is_openchat_user;
use crate::{RuntimeState, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::pay_for_premium_item::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::{OCResult, PremiumItemPurchase, UserId};
use user_index_canister::LocalUserIndexEvent;

#[update(guard = "caller_is_openchat_user", msgpack = true)]
#[trace]
async fn pay_for_premium_item(args: Args) -> Response {
    match read_state(|state| prepare(&args, state)) {
        Ok(PrepareResult { user_id }) => {
            match user_canister_c2c_client::c2c_pay_for_premium_item(
                user_id.into(),
                &user_canister::c2c_pay_for_premium_item::Args {
                    item_id: args.item_id,
                    pay_in_chat: args.pay_in_chat,
                    cost: args.expected_cost,
                },
            )
            .await
            {
                Ok(user_canister::c2c_pay_for_premium_item::Response::Success(result)) => {
                    mutate_state(|state| {
                        let now = state.env.now();
                        state.push_event_to_user_index(
                            LocalUserIndexEvent::NotifyPremiumItemPurchased(Box::new((
                                user_id,
                                PremiumItemPurchase {
                                    timestamp: now,
                                    item_id: args.item_id,
                                    paid_in_chat: args.pay_in_chat,
                                    cost: args.expected_cost,
                                },
                            ))),
                            now,
                        );
                    });
                    Success(SuccessResult {
                        total_chit_earned: result.total_chit_earned,
                        chit_balance: result.chit_balance,
                    })
                }
                Ok(user_canister::c2c_pay_for_premium_item::Response::Error(error)) => Error(error),
                Err(error) => Error(error.into()),
            }
        }
        Err(error) => Error(error),
    }
}

struct PrepareResult {
    user_id: UserId,
}

fn prepare(args: &Args, state: &RuntimeState) -> OCResult<PrepareResult> {
    let user_id = state.calling_user_id();
    if !state.data.local_users.contains(&user_id) {
        return Err(OCErrorCode::InitiatorNotFound.into());
    }

    let Some(cost) = state.data.premium_items.chit_cost(&args.item_id) else {
        return Err(OCErrorCode::ItemNotFound.into());
    };

    if args.pay_in_chat {
        return Err(OCErrorCode::CurrencyNotSupported.into());
    }

    if cost != args.expected_cost {
        Err(OCErrorCode::PriceMismatch.into())
    } else {
        Ok(PrepareResult { user_id })
    }
}
