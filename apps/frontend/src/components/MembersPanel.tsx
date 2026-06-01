import type { User } from "../types.js";

interface MembersPanelProps {
  members: User[];
  userId: string;
}

export function MembersPanel({ members, userId }: MembersPanelProps) {
  const online = members.filter((m) => m.presence === "online");
  const offline = members.filter((m) => m.presence !== "online");

  return (
    <div className="members-panel">
      <h3 className="members-panel__title">Members</h3>

      {online.length > 0 && (
        <div className="members-panel__section">
          <div className="members-panel__section-label">
            Online — {online.length}
          </div>
          {online.map((member) => (
            <MemberRow key={member.id} member={member} isYou={member.id === userId} />
          ))}
        </div>
      )}

      {offline.length > 0 && (
        <div className="members-panel__section">
          <div className="members-panel__section-label">
            Offline — {offline.length}
          </div>
          {offline.map((member) => (
            <MemberRow key={member.id} member={member} isYou={member.id === userId} />
          ))}
        </div>
      )}
    </div>
  );
}

function MemberRow({ member, isYou }: { member: User; isYou: boolean }) {
  return (
    <div className="member-row">
      <div className="member-row__avatar">
        <span>{member.displayName.charAt(0).toUpperCase()}</span>
        <div className={`member-row__status ${member.presence}`} />
      </div>
      <div className="member-row__info">
        <span className="member-row__name">
          {member.displayName}
          {isYou && <span className="member-row__you"> (you)</span>}
        </span>
        {member.attributes?.team && (
          <span className="member-row__team">{member.attributes.team}</span>
        )}
      </div>
    </div>
  );
}
