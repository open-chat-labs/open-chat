use ic_principal::Principal;

// Input should be of the form "openc-hatbo-t"
fn main() {
    let args = std::env::args().collect::<Vec<_>>();
    let Some(target_name) = args.get(1).cloned() else {
        panic!("No target name provided");
    };

    run(target_name);
}

fn run(target_name: String) -> Option<String> {
    let mut best = None;
    let mut fixed_bytes = [0; 10];
    fixed_bytes[9] = 1;

    let input: String = target_name.chars().filter(|c| *c != '-').take(11).collect();
    let prefix = format!("aaaaa{input}");
    let prefix_base32 = &data_encoding::BASE32_NOPAD
        .decode(prefix.to_ascii_uppercase().as_bytes())
        .unwrap()[4..];
    fixed_bytes[..prefix_base32.len()].copy_from_slice(prefix_base32);

    for inner in 0u32..1 << 24 {
        let mut canister_id_bytes = fixed_bytes;
        canister_id_bytes[6..9].copy_from_slice(&inner.to_be_bytes()[1..]);

        let canister_id = Principal::from_slice(&canister_id_bytes);
        let canister_id_string = canister_id.to_string();

        if canister_id_string.as_str()[6..6 + target_name.len()] == target_name
            && canister_id_string.ends_with("cai")
            && best.as_ref().map_or(true, |s| canister_id_string > *s)
        {
            println!("Principal: {canister_id_string}. Bytes: {canister_id_bytes:?}");
            best = Some(canister_id_string);
        }
    }

    best
}
