use crate::guards::caller_is_openchat_user;
use crate::read_state;
use candid::Principal;
use ic_cdk::api::call::CallResult;
use ic_cdk::query;
use local_user_index_canister::group_and_community_summary_updates::{Response::*, *};

#[query(composite = true, guard = "caller_is_openchat_user")]
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
                community_canister_c2c_client::c2c_summary_updates(
                    args.canister_id,
                    &community_canister::c2c_summary_updates::Args {
                        updates_since,
                        invite_code: args.invite_code,
                        on_behalf_of: Some(principal),
                    },
                )
                .await,
            )
        } else {
            map_response(
                community_canister_c2c_client::c2c_summary(
                    args.canister_id,
                    &community_canister::c2c_summary::Args {
                        invite_code: args.invite_code,
                        on_behalf_of: Some(principal),
                    },
                )
                .await,
            )
        }
    } else if let Some(updates_since) = args.updates_since {
        map_response(
            group_canister_c2c_client::c2c_summary_updates(
                args.canister_id,
                &group_canister::c2c_summary_updates::Args {
                    updates_since,
                    on_behalf_of: Some(principal),
                },
            )
            .await,
        )
    } else {
        map_response(
            group_canister_c2c_client::c2c_summary(
                args.canister_id,
                &group_canister::c2c_summary::Args {
                    on_behalf_of: Some(principal),
                },
            )
            .await,
        )
    }
}

fn map_response<R: Into<SummaryUpdatesResponse>>(response: CallResult<R>) -> SummaryUpdatesResponse {
    match response {
        Ok(result) => result.into(),
        Err(error) => SummaryUpdatesResponse::InternalError(format!("{error:?}")),
    }
}
