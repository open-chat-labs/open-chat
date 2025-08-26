export function apiOptional<D, A>(mapper: (d: D) => A, domain: D | undefined): [] | [A] {
    return domain !== undefined ? [mapper(domain)] : [];
}

export function proposalVote(vote: number): boolean | undefined {
    if (vote === 1) return true;
    if (vote === 2) return false;
    return undefined;
}

export function apiProposalVote(vote: boolean): number {
    return vote ? 1 : 2;
}
