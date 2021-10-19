use types::Cycles;

pub fn can_spend_cycles(to_spend: Cycles, min_cycles_balance: Cycles) -> bool {
    let cycles_balance: Cycles = ic_cdk::api::canister_balance().into();

    cycles_balance.saturating_sub(to_spend) > min_cycles_balance
}
