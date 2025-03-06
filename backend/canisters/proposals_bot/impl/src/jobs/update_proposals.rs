use crate::model::nervous_systems::ProposalsToUpdate;
use crate::{mutate_state, read_state, RuntimeState};
use ic_cdk::call::RejectCode;
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::{CanisterId, ChannelId, ChatId, CommunityId, MultiUserChat, ProposalUpdate};

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && state.data.nervous_systems.any_proposals_to_update() {
        let timer_id = ic_cdk_timers::set_timer(Duration::ZERO, run);
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

pub fn run() {
    trace!("'update_proposals' job started");
    TIMER_ID.set(None);

    if let Some(proposals) = mutate_state(|state| state.data.nervous_systems.dequeue_next_proposals_to_update()) {
        ic_cdk::futures::spawn(update_proposals(proposals));
    }
    read_state(start_job_if_required);
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

    let response = group_canister_c2c_client::c2c_update_proposals(group_id.into(), &update_proposals_args).await;

    mark_proposals_updated(governance_canister_id, proposals, response.err().map(|(c, _)| c));
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

    let response = community_canister_c2c_client::c2c_update_proposals(community_id.into(), &update_proposals_args).await;

    mark_proposals_updated(governance_canister_id, proposals, response.err().map(|(c, _)| c));
}

fn mark_proposals_updated(governance_canister_id: CanisterId, proposals: Vec<ProposalUpdate>, error_code: Option<RejectCode>) {
    mutate_state(|state| {
        let now = state.env.now();
        if let Some(code) = error_code {
            state
                .data
                .nervous_systems
                .mark_proposals_update_failed(&governance_canister_id, proposals, now);

            if code == RejectCode::DestinationInvalid {
                state.data.nervous_systems.mark_disabled(&governance_canister_id);
            }
        } else {
            state
                .data
                .nervous_systems
                .mark_proposals_updated(&governance_canister_id, now);
        }
        start_job_if_required(state);
    });
}
