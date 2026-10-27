mod burn_icp_into_cycles;
mod record_cycles_balance;
mod top_up_sns_canisters;

pub(crate) fn start() {
    burn_icp_into_cycles::start_job();
    record_cycles_balance::start_job();
    top_up_sns_canisters::start_job();
}
