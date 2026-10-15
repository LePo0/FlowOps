// algorithme de Kahn
interface EdgeLike {
    source: string;
    target: string;
}

/**
 * Retourne les ids dans un ordre où chaque nœud passe après ses dépendances,
 * ou null si le graphe contient un cycle. Complexité : O(nœuds + arêtes).
 */
export function topologicalSort(nodeIds: string[], edges: EdgeLike[]): string[] | null {
    const inDegree = new Map<string, number>(nodeIds.map((id) => [id, 0]));
    const outgoing = new Map<string, string[]>(nodeIds.map((id) => [id, []]));

    for (const { source, target } of edges) {
        outgoing.get(source)?.push(target);
        inDegree.set(target, (inDegree.get(target) ?? 0) + 1);
    }

    // On démarre avec les nœuds sans dépendance
    const queue = nodeIds.filter((id) => inDegree.get(id) === 0);

    for (let head = 0; head < queue.length; head++) {
        const id = queue[head];
        if (id === undefined) break;
        for (const next of outgoing.get(id) ?? []) {
            const remaining = (inDegree.get(next) ?? 0) - 1;
            inDegree.set(next, remaining);
            if (remaining === 0) queue.push(next);
        }
    }

    // Si certains nœuds n'ont jamais atteint un degré 0, ils sont dans un cycle
    return queue.length === nodeIds.length ? queue : null;
}
