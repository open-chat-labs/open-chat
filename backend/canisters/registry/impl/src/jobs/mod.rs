use crate::RuntimeState;

mod check_for_sns_updates;
mod check_for_token_updates;
mod check_for_updates_to_supported_standards;
mod update_chat_supply;
mod update_evm_contract_addresses;

pub(crate) fn start(_state: &RuntimeState) {
    check_for_sns_updates::start_job();
    check_for_token_updates::start_job();
    check_for_updates_to_supported_standards::start_job();
    update_chat_supply::start_job();
    update_evm_contract_addresses::start_job();
}
