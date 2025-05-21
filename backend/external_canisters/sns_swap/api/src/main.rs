use candid_gen::generate_candid_method;

fn main() {
    generate_candid_method!(sns_swap, get_lifecycle, query);

    candid::export_service!();
    std::print!("{}", __export_service());
}
