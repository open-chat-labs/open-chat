use crate::model::nervous_systems::ProposalsToUpdate;
use crate::mutate_state;
use ic_cdk_macros::heartbeat;
use types::{CanisterId, ChannelId, ChatId, CommunityId, MultiUserChat, ProposalUpdate};

#[heartbeat]
fn heartbeat() {
    update_proposals::run();
}

mod update_proposals {
    use super::*;

    pub fn run() {
        if let Some(ProposalsToUpdate {
            governance_canister_id,
            chat_id,
            proposals,
        }) = mutate_state(|state| state.data.nervous_systems.dequeue_next_proposals_to_update())
        {
            match chat_id {
                MultiUserChat::Group(group_id) => {
                    ic_cdk::spawn(update_group_proposals(governance_canister_id, group_id, proposals));
                }
                MultiUserChat::Channel(community_id, channel_id) => {
                    ic_cdk::spawn(update_channel_proposals(
                        governance_canister_id,
                        community_id,
                        channel_id,
                        proposals,
                    ));
                }
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
            } else {
                state
                    .data
                    .nervous_systems
                    .mark_proposals_updated(&governance_canister_id, now);
            }
        });
    }
}
