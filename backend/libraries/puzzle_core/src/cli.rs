//! Shared pieces of the six `*_cli` development binaries.
//!
//! Everything here is generic over [`Puzzle`], so a canister build that
//! never names a game pays nothing for it.

use crate::{Generated, Puzzle, PuzzleError, Tier};
use std::fmt::Write;

pub fn tier(arg: &str) -> Tier {
    match arg {
        "easy" => Tier::Easy,
        "tricky" => Tier::Tricky,
        other => panic!("unknown tier {other}, expected easy or tricky"),
    }
}

pub fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// The puzzle, the solution, the deduction trace and the wire bytes.
pub fn report<P: Puzzle>(g: &Generated<P::Technique>) -> Result<String, PuzzleError> {
    let mut out = String::new();
    out.push_str(&P::render_ascii(&g.description, None)?);
    out.push('\n');
    out.push_str(&P::render_ascii(&g.description, Some(&g.solution))?);
    out.push('\n');
    for hint in &g.hints {
        let _ = writeln!(
            out,
            "{:?} target={:?} focus={:?} conclusions={:?}",
            hint.technique, hint.target, hint.focus, hint.conclusions
        );
    }
    let _ = writeln!(out, "\ntier={:?}", g.tier);
    let _ = writeln!(out, "{}", hex(&g.description));
    let _ = writeln!(out, "{}", hex(&g.solution));
    Ok(out)
}

/// Print the puzzle, or the reason there isn't one, and exit non-zero on
/// failure so a sweep script can tell the difference.
pub fn print<P: Puzzle>(generated: Result<Generated<P::Technique>, crate::GenerateError>) -> ! {
    match generated {
        Ok(g) => match report::<P>(&g) {
            Ok(text) => {
                print!("{text}");
                std::process::exit(0)
            }
            Err(e) => {
                eprintln!("{}: {e}", P::GAME_ID);
                std::process::exit(1)
            }
        },
        Err(e) => {
            eprintln!("{}: {e}", P::GAME_ID);
            std::process::exit(1)
        }
    }
}
