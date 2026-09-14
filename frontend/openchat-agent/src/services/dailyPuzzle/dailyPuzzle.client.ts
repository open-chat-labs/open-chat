import type { HttpAgent, Identity } from "@icp-sdk/core/agent";
import type {
    DailyPuzzleConfig,
    DailyPuzzleResult,
    GameConfig,
    OCError,
    PublicDailyPuzzle,
    Success,
} from "@shared";
import { Empty, UnitResult } from "../../typebox";
import { principalStringToBytes } from "../../utils/mapping";
import { SingleCanisterMsgpackAgent } from "../canisterAgent/msgpack";
import { unitResult } from "../common/chatMappersV2";
import {
    apiDailyPuzzleConfig,
    currentPuzzlesResponse,
    dailyPuzzleConfigResponse,
    dailyPuzzleGameConfigsResponse,
    dailyPuzzleResultsResponse,
} from "./mappers";
import {
    DailyPuzzleConfigResponse,
    DailyPuzzleCurrentPuzzlesResponse,
    DailyPuzzleGameConfigsResponse,
    DailyPuzzleRegenerateTodayArgs,
    DailyPuzzleResultsArgs,
    DailyPuzzleResultsResponse,
    DailyPuzzleSetConfigArgs,
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

    gameConfigs(): Promise<[string, GameConfig][] | OCError> {
        return this.query(
            "game_configs",
            {},
            dailyPuzzleGameConfigsResponse,
            Empty,
            DailyPuzzleGameConfigsResponse,
        );
    }

    setConfig(config: DailyPuzzleConfig): Promise<Success | OCError> {
        return this.update(
            "set_config",
            { config: apiDailyPuzzleConfig(config) },
            unitResult,
            DailyPuzzleSetConfigArgs,
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
