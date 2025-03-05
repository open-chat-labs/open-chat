use types::Cycles;

pub fn accept_cycles() -> Cycles {
    ic_cdk::api::msg_cycles_accept(u128::MAX)
}
