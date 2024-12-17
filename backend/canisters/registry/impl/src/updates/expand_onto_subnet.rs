use crate::guards::caller_is_governance_principal;
use crate::timer_job_types::ExpandOntoNewSubnetJob;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::proposal;
use canister_timer_jobs::Job;
use canister_tracing_macros::trace;
use registry_canister::expand_onto_subnet::{Response::*, *};

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
fn expand_onto_subnet(args: Args) -> Response {
    match mutate_state(|state| expand_onto_subnet_impl(args, state)) {
        Ok(job) => {
            job.execute();
            Success
        }
        Err(response) => response,
    }
}

fn expand_onto_subnet_impl(args: Args, state: &mut RuntimeState) -> Result<ExpandOntoNewSubnetJob, Response> {
    if state.data.subnets.subnets().iter().any(|s| s.subnet_id == args.subnet_id) {
        Err(AlreadyOnSubnet)
    } else if state.data.subnets.in_progress().is_some() {
        Err(AlreadyInProgress)
    } else {
        state.data.subnets.start_new(args.subnet_id, state.env.now());

        Ok(ExpandOntoNewSubnetJob {
            subnet_id: args.subnet_id,
            this_canister_id: state.env.canister_id(),
            user_index: state.data.user_index_canister_id,
            group_index: state.data.group_index_canister_id,
            notifications_index: state.data.notifications_index_canister_id,
            event_relay: state.data.event_relay_canister_id,
            cycles_dispenser: state.data.cycles_dispenser_canister_id,
            ledger: state.data.icp_ledger_canister_id,
            cmc: state.data.cycles_minting_canister_id,
            create_canister_block_index: None,
        })
    }
}
