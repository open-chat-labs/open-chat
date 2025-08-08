use crate::guards::caller_is_platform_operator;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::{SetPremiumItemCost, UserIndexEvent};
use user_index_canister::set_premium_item_cost::*;

#[update(guard = "caller_is_platform_operator", msgpack = true)]
#[trace]
fn set_premium_item_cost(args: Args) -> Response {
    mutate_state(|state| set_premium_item_cost_impl(args, state))
}

fn set_premium_item_cost_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let now = state.env.now();
    let user_id = state.data.users.get(&caller).unwrap().user_id;
    state
        .data
        .premium_items
        .set_chit_cost(args.item_id, args.chit_cost, user_id, now);

    state.push_event_to_all_local_user_indexes(
        UserIndexEvent::SetPremiumItemCost(SetPremiumItemCost {
            item_id: args.item_id,
            chit_cost: args.chit_cost,
        }),
        None,
    );

    Response::Success
}
