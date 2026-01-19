use crate::guards::caller_is_openchat_user;
use crate::{RuntimeState, read_state};
use candid::Principal;
use canister_api_macros::query;
use local_user_index_canister::group_and_community_summary_updates_v2::{Response::*, *};
use std::cmp::Ordering;
use types::{C2CError, CanisterId, TimestampMillis, UserId};
use utils::min_heap::MinBinaryHeap;

#[query(composite = true, guard = "caller_is_openchat_user", msgpack = true)]
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
    let mut canisters_with_latest_activity: MinBinaryHeap<RequestByLatestActivity> =
        MinBinaryHeap::with_capacity(args.max_c2c_calls);
    let mut excess_updates = Vec::new();
    let mut not_found = Vec::new();
    let user_id = state.calling_user_id();

    for request in args.requests {
        match has_new_activity(&request, user_id, state) {
            HasNewActivityResult::Yes(latest_activity) => {
                if canisters_with_latest_activity.len() >= args.max_c2c_calls
                    && canisters_with_latest_activity.peek().unwrap().latest_activity > latest_activity
                {
                    excess_updates.push(request.canister_id);
                } else {
                    if canisters_with_latest_activity.len() >= args.max_c2c_calls {
                        canisters_with_latest_activity.pop();
                    }
                    canisters_with_latest_activity.push(RequestByLatestActivity {
                        latest_activity,
                        request,
                    });
                }
            }
            HasNewActivityResult::No => {} // No updates
            HasNewActivityResult::NotFound => not_found.push(request.canister_id),
        }
    }

    PrepareResult {
        caller: state.env.caller(),
        timestamp: state.env.now(),
        c2c_args: canisters_with_latest_activity.drain().map(|r| r.request).collect(),
        excess_updates,
        not_found,
    }
}

enum HasNewActivityResult {
    Yes(TimestampMillis),
    No,
    NotFound,
}

fn has_new_activity(request: &SummaryUpdatesArgs, user_id: UserId, state: &RuntimeState) -> HasNewActivityResult {
    if request.is_community {
        let Some(community) = state.data.local_communities.get(&request.canister_id.into()) else {
            return HasNewActivityResult::NotFound;
        };

        let latest_activity = community.latest_activity(Some(user_id));
        if request.updates_since.is_none_or(|since| latest_activity > since) {
            return HasNewActivityResult::Yes(latest_activity);
        }
    } else {
        let Some(group) = state.data.local_groups.get(&request.canister_id.into()) else {
            return HasNewActivityResult::NotFound;
        };

        let latest_activity = group.latest_activity(Some(user_id));
        if request.updates_since.is_none_or(|since| latest_activity > since) {
            return HasNewActivityResult::Yes(latest_activity);
        }
    }
    HasNewActivityResult::No
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

struct RequestByLatestActivity {
    latest_activity: TimestampMillis,
    request: SummaryUpdatesArgs,
}

impl PartialEq<Self> for RequestByLatestActivity {
    fn eq(&self, other: &Self) -> bool {
        self.latest_activity == other.latest_activity && self.request == other.request
    }
}

impl Eq for RequestByLatestActivity {}

impl PartialOrd<Self> for RequestByLatestActivity {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for RequestByLatestActivity {
    fn cmp(&self, other: &Self) -> Ordering {
        match self.latest_activity.cmp(&other.latest_activity) {
            Ordering::Equal => self.request.canister_id.cmp(&other.request.canister_id),
            other => other,
        }
    }
}
