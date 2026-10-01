//! CHAT Rooms generator, technique solver and rule checker.
//!
//! An n x n grid is split into n rooms. Place n CHAT logos so that every
//! row, every column and every room holds exactly one, and no two logos
//! touch, diagonally included. This is the one-star form of Star Battle,
//! the genre LinkedIn's Queens also belongs to.
//!
//! Unlike the other games this is not a port: there is no Tatham
//! generator for it. The generator places a random solution, grows a room
//! outwards from each logo, and keeps the layout only when the technique
//! solver can finish it without guessing, which also makes the solution
//! unique.
//!
//! # Wire encodings
//!
//! Description: byte 0 = format version (1), byte 1 = width, byte 2 =
//! height (always equal), then width*height room ids in row-major order.
//! Every id in `0..n` appears, and ids are numbered in the order their
//! room is first met reading the grid, so an id says nothing about where
//! its logo sits.
//!
//! Solution / grid: width*height bytes row-major, 1 = logo, 0 = no logo.
//!
//! Hint keys are cell indices (y*width+x) and conclusion values are 1
//! (logo) or 0 (no logo). `target` is the non-empty subset of `focus`
//! that the technique's sentence points at; the rest of `focus` is the
//! cells the step asks the player to mark.
//!
//! # Techniques
//!
//! | id | name | target | explanation |
//! |----|------|--------|-------------|
//! | 1 | Shadow | the logo | A logo rules out every other cell in its row, its column and its room, and the eight cells around it. |
//! | 2 | LastCell | the row, column or room's ruled-out cells | This row, column or room has only one cell left that can hold its logo. |
//! | 3 | Confined | the room's (or line's) open cells | Every cell this room can still use is in one row (or column), so nothing else in that line can hold a logo. The same the other way round: a line whose open cells all sit in one room rules out the rest of that room. |
//! | 4 | Pigeonhole | the rooms' (or lines') open cells | These rooms can only use these rows (or columns), as many as there are rooms, so those lines' logos all belong to these rooms and nothing else in them can hold one. The same with lines and rooms swapped. |
//! | 5 | Blocked | the open cells of the line or room it would empty | A logo here would rule out every cell this row, column or room has left, so this cell cannot hold one. |
//!
//! Easy uses 1-3. Tricky adds 4 and 5, and a Tricky puzzle is one the
//! Easy techniques cannot finish.

mod generate;
mod solver;
mod state;

use puzzle_core::{GenerateError, Puzzle, PuzzleError, SearchBudget, checked_grid_values};
use state::Board;

pub use puzzle_core::Tier;

/// This game, as the [`Puzzle`] trait sees it.
#[derive(Clone, Copy, Debug, Default)]
pub struct ChatRooms;

/// Generator work budget, in solver runs (see [`puzzle_core::Budget`]).
/// Each attempt grows one room layout and runs the solver on it once, or
/// twice for Tricky.
const MAX_WORK: u32 = 20_000;

pub const GAME_ID: &str = "chat_rooms";

const FORMAT_VERSION: u8 = 1;
pub const NO_LOGO: u8 = 0;
pub const LOGO: u8 = 1;

/// A one-cell room gives its logo away for free: one per puzzle is a
/// gift, more makes the start trivial. Decided 2026-09-30.
pub const MAX_ONE_CELL_ROOMS: usize = 1;

/// The smallest board with a room layout worth solving. Four is the
/// smallest side that has any solution at all, and it has only two.
pub const MIN_SIZE: usize = 5;
/// The largest board this game accepts. Measured 2026-09-30, once at most
/// one room may be a single cell: 9x9 generates every time in about a
/// quarter of a second natively, while 10x10 fails some seeds even on
/// twice the budget and takes up to 3.4s on others. Nothing larger than
/// the generator can reliably produce is accepted.
pub const MAX_SIZE: usize = 9;

#[derive(Clone, Copy, Debug)]
pub struct Params {
    pub width: u8,
    pub height: u8,
    pub tier: Tier,
}

impl Params {
    /// The board is square; a width and height that differ are rejected by
    /// `generate` rather than silently squared up.
    pub fn default_for(width: u8, height: u8, tier: Tier) -> Params {
        Params { width, height, tier }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum Technique {
    Shadow = 1,
    LastCell = 2,
    Confined = 3,
    Pigeonhole = 4,
    Blocked = 5,
}

impl From<Technique> for u8 {
    fn from(technique: Technique) -> u8 {
        technique as u8
    }
}

/// Keys are cell indices (y*width+x); conclusion values are 1 or 0.
pub type Hint = puzzle_core::Hint<Technique>;
pub type Generated = puzzle_core::Generated<Technique>;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Description {
    pub size: u8,
    /// size*size room ids, row-major.
    pub rooms: Vec<u8>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Violation {
    /// This row holds more than one logo; `cells` are the logos.
    Row { row: u16, cells: Vec<u16> },
    /// This column holds more than one logo; `cells` are the logos.
    Column { column: u16, cells: Vec<u16> },
    /// This room holds more than one logo; `cells` are the logos.
    Room { room: u8, cells: Vec<u16> },
    /// Two logos touch, across, down or diagonally. `a < b`.
    Touching { a: u16, b: u16 },
}

/// Deterministic: the same seed and params always give the same bytes.
pub fn generate(seed: u64, params: Params) -> Result<Generated, GenerateError> {
    generate::generate(seed, params)
}

/// What one pass over a player's grid finds.
struct Scan {
    violations: Vec<Violation>,
    /// Exactly one logo in every row, column and room.
    complete: bool,
}

fn scan(description: &[u8], grid: &[u8]) -> Result<Scan, PuzzleError> {
    let d = parse_description(description)?;
    let board = Board::new(&d);
    let n = board.n;
    let grid = checked_grid_values(grid, n * n, LOGO)?;
    let logo = |i: usize| grid[i] == LOGO;

    let mut out = Vec::new();
    let mut complete = true;
    for (g, cells) in board.groups.iter().enumerate() {
        let logos: Vec<u16> = cells.iter().filter(|&&i| logo(i)).map(|&i| i as u16).collect();
        complete &= logos.len() == 1;
        if logos.len() > 1 {
            out.push(match g / n {
                0 => Violation::Row {
                    row: g as u16,
                    cells: logos,
                },
                1 => Violation::Column {
                    column: (g - n) as u16,
                    cells: logos,
                },
                _ => Violation::Room {
                    room: (g - 2 * n) as u8,
                    cells: logos,
                },
            });
        }
    }
    for a in 0..n * n {
        if !logo(a) {
            continue;
        }
        for b in board.touching_after(a) {
            if logo(b) {
                out.push(Violation::Touching {
                    a: a as u16,
                    b: b as u16,
                });
            }
        }
    }
    Ok(Scan {
        violations: out,
        complete,
    })
}

/// Rule check used by tests and mirrored by the client. Reports only what
/// is definitely wrong: a row, column or room with no logo yet is
/// unfinished, not broken. See [`is_complete`] for whether the grid is
/// finished.
pub fn check_rules(description: &[u8], grid: &[u8]) -> Result<Vec<Violation>, PuzzleError> {
    Ok(scan(description, grid)?.violations)
}

/// Whether every row, column and room holds exactly one logo. Says
/// nothing about logos touching: pair it with [`check_rules`], or use
/// [`Puzzle::is_solved`].
pub fn is_complete(description: &[u8], grid: &[u8]) -> Result<bool, PuzzleError> {
    Ok(scan(description, grid)?.complete)
}

/// The solution in hint-key space: `(cell index, 0 or 1)` for every cell,
/// sorted by cell. Same keys and values as hint conclusions.
pub fn solution_pairs(description: &[u8], solution: &[u8]) -> Result<Vec<(u16, u8)>, PuzzleError> {
    let d = parse_description(description)?;
    let n = d.size as usize;
    let solution = checked_grid_values(solution, n * n, LOGO)?;
    Ok(solution.iter().enumerate().map(|(i, &v)| (i as u16, v)).collect())
}

/// Number of solutions, capped at `cap`, via backtracking.
pub fn count_solutions(description: &[u8], cap: u32) -> Result<u32, PuzzleError> {
    let d = parse_description(description)?;
    Ok(solver::count_solutions(&Board::new(&d), cap, &mut SearchBudget::default()))
}

/// Technique solver from the bare rooms; returns the trace and the
/// solution if it was reached without guessing.
pub fn solve_with_trace(description: &[u8], tier: Tier) -> Result<(Vec<Hint>, Option<Vec<u8>>), PuzzleError> {
    let d = parse_description(description)?;
    let board = Board::new(&d);
    let mut hints = Vec::new();
    let (outcome, marks) = solver::solve(&board, tier, Some(&mut hints));
    let solution = (outcome == solver::Outcome::Solved).then(|| solver::solution_bytes(&marks));
    Ok((hints, solution))
}

pub fn parse_description(bytes: &[u8]) -> Result<Description, PuzzleError> {
    if bytes.len() < 3 {
        return Err(PuzzleError::description("description too short"));
    }
    if bytes[0] != FORMAT_VERSION {
        return Err(PuzzleError::description(format!("unsupported format version {}", bytes[0])));
    }
    let (width, height) = (bytes[1] as usize, bytes[2] as usize);
    if width != height {
        return Err(PuzzleError::description(format!(
            "the grid must be square, got {width}x{height}"
        )));
    }
    // The same bounds `generate` validates against, so bytes no generator
    // can produce are bytes no entry point accepts.
    if !(MIN_SIZE..=MAX_SIZE).contains(&width) {
        return Err(PuzzleError::description(format!(
            "size must be within {MIN_SIZE}..={MAX_SIZE}, got {width}"
        )));
    }
    let expected = 3 + width * width;
    if bytes.len() != expected {
        return Err(PuzzleError::description(format!(
            "expected {expected} bytes, got {}",
            bytes.len()
        )));
    }
    let rooms = bytes[3..].to_vec();
    let mut seen = vec![false; width];
    for &r in &rooms {
        match seen.get_mut(r as usize) {
            Some(s) => *s = true,
            None => return Err(PuzzleError::description(format!("room id {r} is not below {width}"))),
        }
    }
    if let Some(missing) = seen.iter().position(|s| !s) {
        return Err(PuzzleError::description(format!("room {missing} has no cells")));
    }
    Ok(Description {
        size: width as u8,
        rooms,
    })
}

pub(crate) fn encode_description(n: usize, rooms: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(3 + rooms.len());
    out.push(FORMAT_VERSION);
    out.push(n as u8);
    out.push(n as u8);
    out.extend_from_slice(rooms);
    out
}

/// One line per row: each cell as its room's letter, or `*` for a logo
/// when a grid is given.
pub fn render_ascii(description: &[u8], grid: Option<&[u8]>) -> Result<String, PuzzleError> {
    let d = parse_description(description)?;
    let n = d.size as usize;
    let grid = grid.map(|g| checked_grid_values(g, n * n, LOGO)).transpose()?;
    let mut out = String::with_capacity((2 * n + 1) * n);
    for y in 0..n {
        for x in 0..n {
            let i = y * n + x;
            out.push(if grid.is_some_and(|g| g[i] == LOGO) { '*' } else { (b'a' + d.rooms[i]) as char });
            out.push(' ');
        }
        out.push('\n');
    }
    Ok(out)
}

impl Puzzle for ChatRooms {
    type Params = Params;
    type Technique = Technique;
    type Description = Description;
    type Violation = Violation;

    const GAME_ID: &'static str = GAME_ID;

    fn generate(seed: u64, params: Params) -> Result<Generated, GenerateError> {
        generate(seed, params)
    }

    fn parse_description(bytes: &[u8]) -> Result<Description, PuzzleError> {
        parse_description(bytes)
    }

    fn check_rules(description: &[u8], grid: &[u8]) -> Result<Vec<Violation>, PuzzleError> {
        check_rules(description, grid)
    }

    fn is_complete(description: &[u8], grid: &[u8]) -> Result<bool, PuzzleError> {
        is_complete(description, grid)
    }

    fn solution_pairs(description: &[u8], solution: &[u8]) -> Result<Vec<(u16, u8)>, PuzzleError> {
        solution_pairs(description, solution)
    }

    fn count_solutions(description: &[u8], cap: u32) -> Result<u32, PuzzleError> {
        count_solutions(description, cap)
    }

    fn solve_with_trace(description: &[u8], tier: Tier) -> Result<(Vec<Hint>, Option<Vec<u8>>), PuzzleError> {
        solve_with_trace(description, tier)
    }

    fn render_ascii(description: &[u8], grid: Option<&[u8]>) -> Result<String, PuzzleError> {
        render_ascii(description, grid)
    }

    /// One `scan` answers both halves.
    fn is_solved(description: &[u8], grid: &[u8]) -> Result<bool, PuzzleError> {
        let scan = scan(description, grid)?;
        Ok(scan.violations.is_empty() && scan.complete)
    }
}
