use crate::model::nervous_systems::ProposalsToUpdate;
use crate::{mutate_state, RuntimeState};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::{CanisterId, ChannelId, ChatId, CommunityId, MultiUserChat, ProposalUpdate};

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.with(|t| t.get().is_none()) && state.data.nervous_systems.any_proposals_to_update() {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, run);
        TIMER_ID.with(|t| t.set(Some(timer_id)));
        trace!("'update_proposals' job started");
        true
    } else {
        false
    }
}

pub fn run() {
    match mutate_state(try_get_next) {
        GetNextResult::Success(proposals) => {
            ic_cdk::spawn(update_proposals(*proposals));
        }
        GetNextResult::Continue => {}
        GetNextResult::QueueEmpty => {
            if let Some(timer_id) = TIMER_ID.with(|t| t.take()) {
                ic_cdk_timers::clear_timer(timer_id);
                trace!("'update_proposals' job stopped");
            }
        }
    }
}

enum GetNextResult {
    Success(Box<ProposalsToUpdate>),
    Continue,
    QueueEmpty,
}

fn try_get_next(state: &mut RuntimeState) -> GetNextResult {
    if let Some(proposals) = state.data.nervous_systems.dequeue_next_proposals_to_update() {
        GetNextResult::Success(Box::new(proposals))
    } else if state.data.nervous_systems.any_proposals_to_update() {
        GetNextResult::Continue
    } else {
        GetNextResult::QueueEmpty
    }
}

async fn update_proposals(
    ProposalsToUpdate {
        governance_canister_id,
        chat_id,
        proposals,
    }: ProposalsToUpdate,
) {
    match chat_id {
        MultiUserChat::Group(group_id) => {
            update_group_proposals(governance_canister_id, group_id, proposals).await;
        }
        MultiUserChat::Channel(community_id, channel_id) => {
            update_channel_proposals(governance_canister_id, community_id, channel_id, proposals).await;
        }
    }
}

async fn update_group_proposals(governance_canister_id: CanisterId, group_id: ChatId, proposals: Vec<ProposalUpdate>) {
    let update_proposals_args = group_canister::c2c_update_proposals::Args {
        proposals: proposals.clone(),
        correlation_id: 0,
    };

    let failed = group_canister_c2c_client::c2c_update_proposals(group_id.into(), &update_proposals_args)
        .await
        .is_err();

    mark_proposals_updated(governance_canister_id, proposals, failed);
}

async fn update_channel_proposals(
    governance_canister_id: CanisterId,
    community_id: CommunityId,
    channel_id: ChannelId,
    proposals: Vec<ProposalUpdate>,
) {
    let update_proposals_args = community_canister::c2c_update_proposals::Args {
        channel_id,
        proposals: proposals.clone(),
    };

    let failed = community_canister_c2c_client::c2c_update_proposals(community_id.into(), &update_proposals_args)
        .await
        .is_err();

    mark_proposals_updated(governance_canister_id, proposals, failed);
}

fn mark_proposals_updated(governance_canister_id: CanisterId, proposals: Vec<ProposalUpdate>, failed: bool) {
    mutate_state(|state| {
        let now = state.env.now();
        if failed {
            state
                .data
                .nervous_systems
                .mark_proposals_update_failed(&governance_canister_id, proposals, now);

            start_job_if_required(state);
        } else {
            state
                .data
                .nervous_systems
                .mark_proposals_updated(&governance_canister_id, now);
        }
    });
}
