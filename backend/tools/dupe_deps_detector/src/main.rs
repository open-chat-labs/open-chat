use std::collections::BTreeSet;

fn main() {
    let package = std::env::args().nth(1).unwrap();
    let output = std::process::Command::new("cargo").args(["tree", "-p", &package]).output().unwrap();

    let mut deps = BTreeSet::new();
    for line in String::from_utf8(output.stdout).unwrap().lines().filter(|line| !line.ends_with("(*)")) {
        let dep = line.chars().skip_while(|c| !c.is_alphabetic()).collect::<String>();
        deps.insert(dep);
    }

    let mut dupes = BTreeSet::new();
    for (left, right) in deps.iter().zip(deps.iter().skip(1)) {
        let left_package_name = left.chars().take_while(|c| !c.is_whitespace()).collect::<String>();
        let right_package_name = right.chars().take_while(|c| !c.is_whitespace()).collect::<String>();

        if left_package_name == right_package_name {
            dupes.insert(left);
            dupes.insert(right);
        }
    }

    for dupe in dupes {
        println!("{dupe}");
    }
}
