use candid_gen::generate_candid_method;

fn main() {
    generate_candid_method!(proposals_bot, add_governance_canister, update);
    generate_candid_method!(proposals_bot, remove_governance_canister, update);
    generate_candid_method!(proposals_bot, update_group_details, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
