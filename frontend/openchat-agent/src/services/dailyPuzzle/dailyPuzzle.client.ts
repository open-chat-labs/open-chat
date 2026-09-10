import type { HttpAgent, Identity } from "@icp-sdk/core/agent";
import type { DailyPuzzleResult, PublicDailyPuzzle } from "@shared";
import { Empty } from "../../typebox";
import { principalStringToBytes } from "../../utils/mapping";
import { SingleCanisterMsgpackAgent } from "../canisterAgent/msgpack";
import { currentPuzzlesResponse, dailyPuzzleResultsResponse } from "./mappers";
import {
    DailyPuzzleCurrentPuzzlesResponse,
    DailyPuzzleResultsArgs,
    DailyPuzzleResultsResponse,
} from "./typebox";

export class DailyPuzzleClient extends SingleCanisterMsgpackAgent {
    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId, "DailyPuzzle");
    }

    currentPuzzles(): Promise<PublicDailyPuzzle[]> {
        return this.query(
            "current_puzzles",
            {},
            currentPuzzlesResponse,
            Empty,
            DailyPuzzleCurrentPuzzlesResponse,
        );
    }

    results(gameId: string, number: number, userIds: string[]): Promise<DailyPuzzleResult[]> {
        return this.query(
            "results",
            {
                game_id: gameId,
                number,
                user_ids: userIds.map(principalStringToBytes),
            },
            dailyPuzzleResultsResponse,
            DailyPuzzleResultsArgs,
            DailyPuzzleResultsResponse,
        );
    }
}
