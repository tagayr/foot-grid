"use client";

import { useState } from "react";
import { FLAGS } from "@/game/constants";
import { searchPlayers } from "@/game/search";
import type { AxisType, Player } from "@/game/types";
import type { ActiveCell } from "./types";

type SearchModalProps = {
  activeCell: ActiveCell;
  loading?: boolean;
  players: Player[];
  onClose: () => void;
  onSelect: (name: string) => void;
};

export default function SearchModal({ activeCell, loading = false, players, onClose, onSelect }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const matches = searchPlayers(players, query);
  const rowLabel = formatCellHint(activeCell.row, activeCell.rowType);
  const colLabel = formatCellHint(activeCell.col, activeCell.colType);
  const hint = getCellHint(activeCell, rowLabel, colLabel);

  return (
    <div className="modal-overlay open" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <div className="modal">
        <div className="modal-title">Sélectionner un joueur</div>
        <div className="modal-hint">{hint}</div>
        <input
          autoFocus
          type="text"
          className="search-input"
          value={query}
          placeholder="NOM DU JOUEUR..."
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="suggestions">
          {query.length >= 2 && loading ? <div className="no-results">Chargement des joueurs...</div> : null}
          {query.length >= 2 && !loading && matches.length === 0 ? <div className="no-results">Aucun joueur trouvé...</div> : null}
          {matches.map((player) => (
            <button key={player.nom} className="sug-item" onClick={() => onSelect(player.nom)}>
              <span className="sug-name">{player.nom}</span>
            </button>
          ))}
        </div>
        <button className="modal-close" onClick={onClose}>
          ✕ Annuler
        </button>
      </div>
    </div>
  );
}

function getCellHint(activeCell: ActiveCell, rowLabel: string, colLabel: string) {
  if (activeCell.rowType === "club" && activeCell.colType === "club") {
    return `A joué à ${rowLabel} ET à ${colLabel}`;
  }
  if (activeCell.rowType === "club" && activeCell.colType === "annee") {
    return `Était à ${rowLabel} en saison ${colLabel}`;
  }
  if (activeCell.rowType === "club" && activeCell.colType === "sel") {
    return `A joué à ${rowLabel} ET nationalité ${colLabel}`;
  }
  return `Nationalité ${rowLabel} ET a joué à ${colLabel}`;
}

function formatCellHint(value: string | number, type: AxisType) {
  if (type === "sel") {
    return `${FLAGS[String(value)] ?? ""} ${value}`.trim();
  }
  if (type === "annee") {
    const year = Number(value);
    return `${year}/${String(year + 1).slice(2)}`;
  }
  return String(value);
}
