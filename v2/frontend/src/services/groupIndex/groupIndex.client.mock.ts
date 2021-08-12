import type { IGroupIndexClient } from "./groupIndex.client.interface";

export class GroupIndexClientMock implements IGroupIndexClient {
    todo(): string {
        return "todo";
    }
}
