use cycles_utils::accept_cycles;
use ic_cdk_macros::update;

#[update]
fn wallet_receive() {
    accept_cycles();
}
