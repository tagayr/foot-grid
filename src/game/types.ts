export type AxisType = "club" | "sel" | "annee";

export type Mode = "cc" | "ca" | "cs";

export type CareerSpell = {
  club: string;
  annee_debut: number;
  annee_fin: number | null;
};

export type Player = {
  nom: string;
  clubs: string[];
  sels: string[];
  carriere: CareerSpell[];
};

export type Puzzle = {
  id?: string;
  rows: Array<string | number>;
  cols: Array<string | number>;
  rowType: AxisType;
  colType: AxisType;
  solutions: Record<string, string[]>;
};

export type PuzzlesByMode = Record<Mode, Puzzle>;

export type CellState = {
  remplie: boolean;
  joueur: string | null;
};

export type GameState = {
  erreurs: number;
  trouves: number;
  cellules: Record<string, CellState>;
  submissions: Array<{
    key: string;
    playerName: string;
  }>;
  termine: boolean;
};
