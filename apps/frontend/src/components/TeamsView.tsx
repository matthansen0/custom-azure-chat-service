import type { Room } from "../types.js";

interface TeamsViewProps {
  rooms: Room[];
  userId: string;
  onSelectRoom: (roomId: string) => void;
}

export function TeamsView({ rooms, userId, onSelectRoom }: TeamsViewProps) {
  const groupRooms = rooms.filter((r) => r.type === "group");
  const announcementRooms = rooms.filter((r) => r.type === "announcement");

  return (
    <div className="teams-view">
      <div className="teams-view__header">
        <h2 className="teams-view__title">Teams</h2>
      </div>
      <div className="teams-view__content">
        {groupRooms.length > 0 && (
          <div className="teams-view__section">
            <div className="teams-view__section-label">Your teams</div>
            <div className="teams-view__grid">
              {groupRooms.map((room) => (
                <button
                  key={room.id}
                  className="teams-view__card"
                  onClick={() => onSelectRoom(room.id)}
                >
                  <div className="teams-view__card-avatar">
                    {room.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="teams-view__card-name">{room.name}</div>
                  <div className="teams-view__card-meta">
                    {room.participantIds.length} member{room.participantIds.length !== 1 ? "s" : ""}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {announcementRooms.length > 0 && (
          <div className="teams-view__section">
            <div className="teams-view__section-label">Channels</div>
            <div className="teams-view__grid">
              {announcementRooms.map((room) => (
                <button
                  key={room.id}
                  className="teams-view__card"
                  onClick={() => onSelectRoom(room.id)}
                >
                  <div className="teams-view__card-avatar announcement">
                    📢
                  </div>
                  <div className="teams-view__card-name">{room.name}</div>
                  <div className="teams-view__card-meta">
                    {room.participantIds.length} member{room.participantIds.length !== 1 ? "s" : ""}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {groupRooms.length === 0 && announcementRooms.length === 0 && (
          <div className="teams-view__empty">
            <p>No teams yet. Create a group chat to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
