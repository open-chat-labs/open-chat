import type { HttpAgent, Identity } from "@icp-sdk/core/agent";
import type {
    DailyPuzzleConfig,
    DailyPuzzleResult,
    GameConfig,
    OCError,
    PublicDailyPuzzle,
    PuzzleParams,
    Success,
} from "@shared";
import { Empty, UnitResult } from "../../typebox";
import { principalStringToBytes } from "../../utils/mapping";
import { SingleCanisterMsgpackAgent } from "../canisterAgent/msgpack";
import { unitResult } from "../common/chatMappersV2";
import {
    apiDailyPuzzleConfig,
    apiGameConfig,
    apiPuzzleParams,
    currentPuzzlesResponse,
    dailyPuzzleConfigResponse,
    dailyPuzzleGameConfigsResponse,
    dailyPuzzleScheduleResponse,
    dailyPuzzleResultsResponse,
} from "./mappers";
import {
    DailyPuzzleConfigResponse,
    DailyPuzzleCurrentPuzzlesResponse,
    DailyPuzzleGameConfigsResponse,
    DailyPuzzleScheduleResponse,
    DailyPuzzleRegenerateTodayArgs,
    DailyPuzzleResultsArgs,
    DailyPuzzleResultsResponse,
    DailyPuzzleSetConfigArgs,
    DailyPuzzleSetGameConfigArgs,
    DailyPuzzleSetScheduleArgs,
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

    schedule(): Promise<PuzzleParams[] | OCError> {
        return this.query(
            "schedule",
            {},
            dailyPuzzleScheduleResponse,
            Empty,
            DailyPuzzleScheduleResponse,
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

    setGameConfig(gameId: string, config: GameConfig): Promise<Success | OCError> {
        return this.update(
            "set_game_config",
            { game_id: gameId, config: apiGameConfig(config) },
            unitResult,
            DailyPuzzleSetGameConfigArgs,
            UnitResult,
        );
    }

    setSchedule(schedule: PuzzleParams[]): Promise<Success | OCError> {
        return this.update(
            "set_schedule",
            { schedule: schedule.map(apiPuzzleParams) },
            unitResult,
            DailyPuzzleSetScheduleArgs,
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

    pushNow(): Promise<Success | OCError> {
        return this.update("push_now", {}, unitResult, Empty, UnitResult);
    }
}
