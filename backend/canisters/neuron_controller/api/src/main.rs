use candid_gen::generate_candid_method;

fn main() {
    generate_candid_method!(neuron_controller, manage_nns_neuron, update);
    generate_candid_method!(neuron_controller, stake_nns_neuron, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
