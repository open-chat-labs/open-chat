mod burn_icp_into_cycles;
mod top_up_sns_canisters;

pub(crate) fn start() {
    burn_icp_into_cycles::start_job();
    top_up_sns_canisters::start_job();
}
