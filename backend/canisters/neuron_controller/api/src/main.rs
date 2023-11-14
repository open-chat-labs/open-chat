use candid_gen::generate_candid_method;

#[allow(deprecated)]
fn main() {
    generate_candid_method!(neuron_controller, manage_neuron, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
