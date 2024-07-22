use crate::{read_state, RuntimeState};
use ic_cdk::query;
use user_index_canister::chit_balances::{Response::*, *};
use utils::time::MonthKey;

#[query]
fn chit_balances(args: Args) -> Response {
    read_state(|state| chit_balances_impl(args, state))
}

fn chit_balances_impl(args: Args, state: &RuntimeState) -> Response {
    let month_key = MonthKey::new(args.year as u32, args.month);

    let balances = args
        .users
        .iter()
        .flat_map(|u| state.data.users.get_by_user_id(u))
        .map(|u| (u.user_id, u.chit_per_month.get(&month_key).copied().unwrap_or_default()))
        .filter(|(_, c)| *c > 0)
        .collect();

    Success(SuccessResult { balances })
}
