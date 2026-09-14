import type { HttpAgent, Identity } from "@icp-sdk/core/agent";
import type {
    DailyPuzzleConfig,
    DailyPuzzleResult,
    OCError,
    PublicDailyPuzzle,
    Success,
} from "@shared";
import { Empty, UnitResult } from "../../typebox";
import { principalStringToBytes } from "../../utils/mapping";
import { SingleCanisterMsgpackAgent } from "../canisterAgent/msgpack";
import { unitResult } from "../common/chatMappersV2";
import {
    currentPuzzlesResponse,
    dailyPuzzleConfigResponse,
    dailyPuzzleResultsResponse,
} from "./mappers";
import {
    DailyPuzzleConfigResponse,
    DailyPuzzleCurrentPuzzlesResponse,
    DailyPuzzleRegenerateTodayArgs,
    DailyPuzzleResultsArgs,
    DailyPuzzleResultsResponse,
    DailyPuzzleSetEnabledArgs,
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

    config(): Promise<DailyPuzzleConfig | OCError> {
        return this.query(
            "config",
            {},
            dailyPuzzleConfigResponse,
            Empty,
            DailyPuzzleConfigResponse,
        );
    }

    setEnabled(enabled: boolean): Promise<Success | OCError> {
        return this.update(
            "set_enabled",
            { enabled },
            unitResult,
            DailyPuzzleSetEnabledArgs,
            UnitResult,
        );
    }

    regenerateToday(gameId: string | undefined): Promise<Success | OCError> {
        return this.update(
            "regenerate_today",
            { game_id: gameId },
            unitResult,
            DailyPuzzleRegenerateTodayArgs,
            UnitResult,
        );
    }
}
