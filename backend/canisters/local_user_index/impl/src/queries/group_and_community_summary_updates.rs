use crate::guards::caller_is_openchat_user;
use crate::queries::group_and_community_summary_updates_v2::make_c2c_call;
use crate::read_state;
use canister_api_macros::query;
use local_user_index_canister::group_and_community_summary_updates::{Response::*, *};

#[query(composite = true, guard = "caller_is_openchat_user", candid = true, msgpack = true)]
async fn group_and_community_summary_updates(args: Args) -> Response {
    let caller = read_state(|state| state.env.caller());

    let futures: Vec<_> = args.requests.into_iter().map(|r| make_c2c_call(r, caller)).collect();

    let results = futures::future::join_all(futures).await;

    Success(results.into_iter().map(|(_, r)| r).collect())
}
