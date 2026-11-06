/**
 * Convierte la experiencia en filas de un git graph. Cada fila dibuja sus carriles:
 * en la parte superior (alto fijo) ocurren las ramas y los merges, alineados con el título,
 * y el resto solo estira líneas, para que el alto del texto no descuadre el dibujo.
 */
export const TOP = 64;
const COMMIT_Y = 34;
const LANE_GAP = 15;
const LANE_LEFT = 8;

export const laneX = (lane: number): number => LANE_LEFT + lane * LANE_GAP;
export const GRAPH_WIDTH = laneX(4) + LANE_LEFT;

export interface RowSpec {
  commit: number;
  branch?: number;
  live?: boolean;
  merge?: number[];
}

export interface Segment {
  d: string;
  live: boolean;
}

export interface Row {
  top: Segment[];
  rest: Segment[];
  commitX: number;
  commitY: number;
  commitLive: boolean;
}

/** Orden igual a `content.experience.commits`, más la fila final "Hoy". */
export const SPEC: RowSpec[] = [
  { commit: 2, branch: 2 },
  { commit: 1, branch: 1, live: true },
  { commit: 3, branch: 3 },
  { commit: 2 },
  { commit: 2 },
  { commit: 2, merge: [2, 3], branch: 2, live: true },
  { commit: 3, branch: 3 },
  { commit: 4, branch: 4 },
  { commit: 4, merge: [4], branch: 4, live: true },
  { commit: 0, merge: [3] },
];

export function buildRows(spec: RowSpec[] = SPEC): Row[] {
  const lanes = new Map<number, boolean>([[0, false]]);
  return spec.map((row) => {
    const top: Segment[] = [];
    const merges = new Set(row.merge ?? []);

    for (const [lane, live] of lanes) {
      const x = laneX(lane);
      if (merges.has(lane)) {
        top.push({ d: `M${x} 0 C${x} 12 ${laneX(0)} 10 ${laneX(0)} 24`, live });
      } else {
        top.push({ d: `M${x} 0 V${TOP}`, live });
      }
    }
    for (const lane of merges) lanes.delete(lane);

    if (row.branch !== undefined) {
      const x = laneX(row.branch);
      const live = row.live ?? false;
      top.push({ d: `M${laneX(0)} 26 C${laneX(0)} 42 ${x} 34 ${x} 52 V${TOP}`, live });
      lanes.set(row.branch, live);
    }

    const rest = [...lanes].map(([lane, live]) => ({ d: `M${laneX(lane)} 0 V100`, live }));
    return {
      top,
      rest,
      commitX: laneX(row.commit),
      commitY: row.branch !== undefined ? 52 : COMMIT_Y,
      commitLive: lanes.get(row.commit) ?? false,
    };
  });
}
