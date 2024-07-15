use candid_gen::generate_candid_method;

#[allow(deprecated)]
fn main() {
    generate_candid_method!(proposals_bot, lookup_proposal_message, query);

    generate_candid_method!(proposals_bot, stake_neuron_for_submitting_proposals, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
