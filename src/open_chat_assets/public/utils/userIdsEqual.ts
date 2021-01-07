import { UserId } from "../model/users";

export default function(userId1: UserId, userId2: UserId) : boolean {
    // TODO: Sort this!
    return Boolean(userId1 && userId2 && userId1.toString() === userId2.toString());
}