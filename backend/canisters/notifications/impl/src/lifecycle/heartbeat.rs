use ic_cdk_macros::heartbeat;

#[heartbeat]
fn heartbeat() {
    cycles_dispenser_client::run();
}
