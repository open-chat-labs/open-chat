use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use types::{Chit, UserId};
use user_index_canister::users_chit::{Response::*, *};
use utils::time::MonthKey;

#[query(candid = true, msgpack = true)]
fn users_chit(args: Args) -> Response {
    read_state(|state| users_chit_impl(args, state))
}

fn users_chit_impl(args: Args, state: &RuntimeState) -> Response {
    let month_key = MonthKey::new(args.year as u32, args.month);
    let now = state.env.now();

    let chit = args.users.iter().map(|u| chit_for_user(u, now, month_key, state)).collect();

    Success(SuccessResult { chit })
}

fn chit_for_user(user_id: &UserId, now: u64, month_key: MonthKey, state: &RuntimeState) -> Chit {
    state
        .data
        .users
        .get_by_user_id(user_id)
        .map(|user| {
            let balance = user.chit_per_month.get(&month_key).copied().unwrap_or_default();
            let streak = user.streak(now);
            Chit { balance, streak }
        })
        .unwrap_or_default()
}
