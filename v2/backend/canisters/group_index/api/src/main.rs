use candid_gen::generate_candid_method;

fn main() {
    generate_candid_method!(group_index, recommended_groups, query);
    generate_candid_method!(group_index, search, query);

    candid::export_service!();
    std::print!("{}", __export_service());
}
