use candid_gen::generate_candid_method_no_args;

fn main() {
    generate_candid_method_no_args!(cycles_minting, neuron_maturity_modulation, query);

    candid::export_service!();
    std::print!("{}", __export_service());
}
