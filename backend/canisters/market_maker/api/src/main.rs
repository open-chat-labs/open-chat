use candid_gen::generate_candid_method;

fn main() {
    generate_candid_method!(market_maker, update_config, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
