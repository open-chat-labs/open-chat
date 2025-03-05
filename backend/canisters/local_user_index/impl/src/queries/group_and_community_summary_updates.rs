use crate::guards::caller_is_openchat_user;
use crate::read_state;
use candid::Principal;
use canister_api_macros::query;
use ic_cdk::call::RejectCode;
use local_user_index_canister::group_and_community_summary_updates::{Response::*, *};

#[query(composite = true, guard = "caller_is_openchat_user", candid = true, msgpack = true)]
async fn group_and_community_summary_updates(args: Args) -> Response {
    let caller = read_state(|state| state.env.caller());

    let futures: Vec<_> = args.requests.into_iter().map(|r| make_c2c_call(r, caller)).collect();

    let results = futures::future::join_all(futures).await;

    Success(results)
}

async fn make_c2c_call(args: SummaryUpdatesArgs, principal: Principal) -> SummaryUpdatesResponse {
    if args.is_community {
        if let Some(updates_since) = args.updates_since {
            map_response(
                community_canister_c2c_client::summary_updates(
                    args.canister_id,
                    &community_canister::summary_updates::Args {
                        updates_since,
                        invite_code: args.invite_code,
                        on_behalf_of: Some(principal),
                    },
                )
                .await,
            )
        } else {
            map_response(
                community_canister_c2c_client::summary(
                    args.canister_id,
                    &community_canister::summary::Args {
                        invite_code: args.invite_code,
                        on_behalf_of: Some(principal),
                    },
                )
                .await,
            )
        }
    } else if let Some(updates_since) = args.updates_since {
        map_response(
            group_canister_c2c_client::summary_updates(
                args.canister_id,
                &group_canister::summary_updates::Args {
                    updates_since,
                    on_behalf_of: Some(principal),
                },
            )
            .await,
        )
    } else {
        map_response(
            group_canister_c2c_client::summary(
                args.canister_id,
                &group_canister::summary::Args {
                    on_behalf_of: Some(principal),
                },
            )
            .await,
        )
    }
}

fn map_response<R: Into<SummaryUpdatesResponse>>(response: Result<R, (RejectCode, String)>) -> SummaryUpdatesResponse {
    match response {
        Ok(result) => result.into(),
        Err(error) => SummaryUpdatesResponse::InternalError(format!("{error:?}")),
    }
}
