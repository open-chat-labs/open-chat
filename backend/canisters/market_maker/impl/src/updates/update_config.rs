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

fn update_config_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if let Some(config) = runtime_state.data.exchange_config.get_mut(&args.exchange_id) {
        args.enabled.map(|x| config.enabled = x);
        args.price_increment.map(|x| config.price_increment = x);
        args.order_size.map(|x| config.order_size = x);
        args.min_order_size.map(|x| config.min_order_size = x);
        args.max_buy_price.map(|x| config.max_buy_price = x);
        args.min_sell_price.map(|x| config.min_sell_price = x);
        args.min_orders_per_direction.map(|x| config.min_orders_per_direction = x);
        args.max_orders_per_direction.map(|x| config.max_orders_per_direction = x);
        args.max_orders_to_make_per_iteration
            .map(|x| config.max_orders_to_make_per_iteration = x);
        args.max_orders_to_cancel_per_iteration
            .map(|x| config.max_orders_to_cancel_per_iteration = x);
        Success
    } else {
        ExchangeNotFound
    }
}
