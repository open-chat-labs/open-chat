use crate::guards::caller_is_openchat_user;
use crate::{RuntimeState, read_state};
use candid::Principal;
use canister_api_macros::query;
use local_user_index_canister::group_and_community_summary_updates_v2::{Response::*, *};
use types::{C2CError, CanisterId, TimestampMillis, UserId};

#[query(composite = true, guard = "caller_is_openchat_user", candid = true, msgpack = true)]
async fn group_and_community_summary_updates_v2(args: Args) -> Response {
    let PrepareResult {
        caller,
        timestamp,
        c2c_args,
        excess_updates,
        not_found,
    } = read_state(|state| prepare(args, state));

    let futures: Vec<_> = c2c_args.into_iter().map(|r| make_c2c_call(r, caller)).collect();

    let responses = futures::future::join_all(futures).await;

    let mut updates = Vec::new();
    let mut errors = Vec::new();
    for (canister_id, response) in responses {
        match response {
            SummaryUpdatesResponse::SuccessNoUpdates => {}
            SummaryUpdatesResponse::Error(error) => errors.push((canister_id, error)),
            response => updates.push(response),
        }
    }

    Success(SuccessResult {
        timestamp,
        updates,
        excess_updates,
        errors,
        not_found,
    })
}

struct PrepareResult {
    caller: Principal,
    timestamp: TimestampMillis,
    c2c_args: Vec<SummaryUpdatesArgs>,
    excess_updates: Vec<CanisterId>,
    not_found: Vec<CanisterId>,
}

fn prepare(args: Args, state: &RuntimeState) -> PrepareResult {
    let mut c2c_args = Vec::new();
    let mut excess_updates = Vec::new();
    let mut not_found = Vec::new();
    let user_id = state.calling_user_id();
    for request in args.requests {
        match should_include_request(&request, user_id, state) {
            Some(true) if c2c_args.len() < args.max_c2c_calls => c2c_args.push(request),
            Some(true) => excess_updates.push(request.canister_id),
            Some(false) => {} // No updates
            None => not_found.push(request.canister_id),
        }
    }

    PrepareResult {
        caller: state.env.caller(),
        timestamp: state.env.now(),
        c2c_args,
        excess_updates,
        not_found,
    }
}

fn should_include_request(request: &SummaryUpdatesArgs, user_id: UserId, state: &RuntimeState) -> Option<bool> {
    if request.is_community {
        state.data.local_communities.get(&request.canister_id.into()).map(|c| {
            request
                .updates_since
                .is_none_or(|since| c.latest_activity(Some(user_id)) > since)
        })
    } else {
        state.data.local_groups.get(&request.canister_id.into()).map(|g| {
            request
                .updates_since
                .is_none_or(|since| g.latest_activity(Some(user_id)) > since)
        })
    }
}

pub(crate) async fn make_c2c_call(args: SummaryUpdatesArgs, principal: Principal) -> (CanisterId, SummaryUpdatesResponse) {
    let response = if args.is_community {
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
    };

    (args.canister_id, response)
}

fn map_response<R: Into<SummaryUpdatesResponse>>(response: Result<R, C2CError>) -> SummaryUpdatesResponse {
    match response {
        Ok(result) => result.into(),
        Err(error) => SummaryUpdatesResponse::Error(error.into()),
    }
}
