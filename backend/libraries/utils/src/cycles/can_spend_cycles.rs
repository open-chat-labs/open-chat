use types::Cycles;

pub fn can_spend_cycles(to_spend: Cycles, min_cycles_balance: Cycles) -> bool {
    let cycles_balance = ic_cdk::api::canister_balance128();

    cycles_balance.saturating_sub(to_spend) > min_cycles_balance
}
