import type { CandidateGroupChat, CreateGroupChatResponse } from "../../domain/chat/chat";
import { randomWord } from "../../utils/mockutils";
import type { IGroupIndexClient } from "./groupIndex.client.interface";

export class GroupIndexClientMock implements IGroupIndexClient {
    createGroup(_candidate: CandidateGroupChat): Promise<CreateGroupChatResponse> {
        return new Promise((res) => {
            setTimeout(() => {
                res(randomWord(16));
            }, 300);
        });
    }
}
