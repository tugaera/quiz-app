// components/session/PlayerList.tsx — Live updating player list
"use client";

import { Badge } from "@/components/ui/badge";
import type { Player } from "@/types";

interface PlayerListProps {
  players: Player[];
}

export function PlayerList({ players }: PlayerListProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold">Players</h3>
        <Badge variant="secondary">{players.length}</Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        {players.map((player) => (
          <Badge key={player.id} variant="outline" className="text-sm py-1">
            {player.nickname}
          </Badge>
        ))}
        {players.length === 0 && (
          <p className="text-sm text-muted-foreground">No players yet</p>
        )}
      </div>
    </div>
  );
}
