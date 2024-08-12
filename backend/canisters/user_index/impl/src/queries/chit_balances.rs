use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use types::UserId;
use user_index_canister::chit_balances::{Response::*, *};
use utils::time::MonthKey;

#[query(candid = true, json = true)]
fn chit_balances(args: Args) -> Response {
    read_state(|state| chit_balances_impl(args, state))
}

fn chit_balances_impl(args: Args, state: &RuntimeState) -> Response {
    let month_key = MonthKey::new(args.year as u32, args.month);

    let balances = args
        .users
        .iter()
        .map(|u| chit_balance_for_user(u, month_key, state).unwrap_or_default())
        .collect();

    Success(SuccessResult { balances })
}

fn chit_balance_for_user(user_id: &UserId, month_key: MonthKey, state: &RuntimeState) -> Option<i32> {
    let user = state.data.users.get_by_user_id(user_id)?;
    user.chit_per_month.get(&month_key).copied()
}
