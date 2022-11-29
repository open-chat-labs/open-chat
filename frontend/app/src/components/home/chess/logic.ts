import { Chess, Color, Move, Piece, Square } from "chess.js";

export class Game {
    game: Chess;

    constructor(fen?: string) {
        this.game = new Chess();
        if (fen !== undefined) {
            this.game.load(fen);
        }
    }

    validMoves(from: [number, number]): Set<string> {
        return new Set<string>(
            (this.game.moves({ square: fromCoords(from) }) as string[]).map((m) => {
                return m.slice(-2);
            })
        );
    }

    validMove(from: [number, number], to: [number, number]): boolean {
        const moves = this.game.moves({ square: fromCoords(from) });
        return moves.some((m) => {
            return typeof m === "string" && m === fromCoords(to);
        });
    }

    move(from: [number, number], to: [number, number]): Move | null {
        return this.game.move({
            from: fromCoords(from),
            to: fromCoords(to),
        });
    }

    getPiece(coord: [number, number]): Piece | null {
        return this.game.get(fromCoords(coord));
    }

    get turn(): Color {
        return this.game.turn();
    }

    toString(): string {
        return this.game.fen();
    }
}

const letters = "abcdefgh";

export function fromCoords(coords: [number, number]): Square {
    return `${letters[coords[0]]}${Math.abs(coords[1] - 8)}` as Square;
}
