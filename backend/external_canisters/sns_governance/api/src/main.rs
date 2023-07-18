use candid_gen::generate_candid_method;

fn main() {
    generate_candid_method!(sns_governance, get_metadata, query);
    generate_candid_method!(sns_governance, list_neurons, query);
    generate_candid_method!(sns_governance, list_proposals, query);

    generate_candid_method!(sns_governance, manage_neuron, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
