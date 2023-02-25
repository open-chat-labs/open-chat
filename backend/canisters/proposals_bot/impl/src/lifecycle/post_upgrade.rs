use crate::governance_clients::sns::ListProposals;
use crate::lifecycle::{init_env, init_state, UPGRADE_BUFFER_SIZE};
use crate::memory::get_upgrades_memory;
use crate::{governance_clients, read_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use ic_stable_structures::reader::{BufferedReader, Reader};
use proposals_bot_canister::post_upgrade::Args;
use std::time::Duration;
use tracing::info;
use types::{CanisterId, MessageContent, Proposal, ProposalContent};
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let env = init_env();

    let memory = get_upgrades_memory();
    let reader = BufferedReader::new(UPGRADE_BUFFER_SIZE, Reader::new(&memory, 0));

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = serializer::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    init_cycles_dispenser_client(data.cycles_dispenser_canister_id);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    ic_cdk_timers::set_timer(Duration::default(), || {
        ic_cdk::spawn(get_openchat_proposal_payloads());
    });
}

async fn get_openchat_proposal_payloads() {
    let governance_canister_id = CanisterId::from_text("2jvtu-yqaaa-aaaaq-aaama-cai").unwrap();
    let group_id = read_state(|state| state.data.nervous_systems.get_chat_id(&governance_canister_id)).unwrap();
    let proposals_response = governance_clients::sns::list_proposals(
        governance_canister_id,
        &ListProposals {
            limit: 30,
            ..Default::default()
        },
    )
    .await;

    if let Ok(raw_proposals) = proposals_response {
        let proposals: Vec<Proposal> = raw_proposals.into_iter().filter_map(|p| p.try_into().ok()).collect();
        let args: Vec<_> = read_state(|state| {
            let nervous_system = state.data.nervous_systems.get(&governance_canister_id).unwrap();

            proposals
                .into_iter()
                .map(|p| group_canister::edit_message::Args {
                    thread_root_message_index: None,
                    message_id: nervous_system.active_proposals.get(&p.id()).unwrap().1,
                    content: MessageContent::GovernanceProposal(ProposalContent {
                        governance_canister_id,
                        proposal: p.clone(),
                        my_vote: None,
                    }),
                    correlation_id: 0,
                })
                .collect()
        });

        futures::future::join_all(
            args.iter()
                .map(|a| group_canister_c2c_client::edit_message(group_id.into(), a)),
        )
        .await;
    }
}
