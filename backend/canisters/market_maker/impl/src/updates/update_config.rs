use crate::{mutate_state, read_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use market_maker_canister::update_config::{Response::*, *};
use user_index_canister_c2c_client::{lookup_user, LookupUserError};

#[update]
#[trace]
async fn update_config(args: Args) -> Response {
    let (caller, user_index_canister_id) = read_state(|state| (state.env.caller(), state.data.user_index_canister_id));

    match lookup_user(caller, user_index_canister_id).await {
        Ok(user) if user.is_platform_operator => (),
        Ok(_) | Err(LookupUserError::UserNotFound) => return NotAuthorized,
        Err(LookupUserError::InternalError(error)) => return InternalError(error),
    };

    mutate_state(|state| update_config_impl(args, state))
}

fn update_config_impl(args: Args, state: &mut RuntimeState) -> Response {
    if let Some(config) = state.data.exchange_config.get_mut(&args.exchange_id) {
        update_if_some(args.enabled, &mut config.enabled);
        update_if_some(args.price_increment, &mut config.price_increment);
        update_if_some(args.order_size, &mut config.order_size);
        update_if_some(args.min_order_size, &mut config.min_order_size);
        update_if_some(args.max_buy_price, &mut config.max_buy_price);
        update_if_some(args.min_sell_price, &mut config.min_sell_price);
        update_if_some(args.spread, &mut config.spread);
        update_if_some(args.min_orders_per_direction, &mut config.min_orders_per_direction);
        update_if_some(args.max_orders_per_direction, &mut config.max_orders_per_direction);
        update_if_some(
            args.max_orders_to_make_per_iteration,
            &mut config.max_orders_to_make_per_iteration,
        );
        update_if_some(
            args.max_orders_to_cancel_per_iteration,
            &mut config.max_orders_to_cancel_per_iteration,
        );
        Success
    } else {
        ExchangeNotFound
    }
}

fn update_if_some<T>(input: Option<T>, target: &mut T) {
    if let Some(value) = input {
        *target = value;
    }
}
