interface UserSwitcherProps {
  userId: string;
  onSwitch: (userId: string) => void;
}

const users = [
  { id: "u1", label: "Alex" },
  { id: "u2", label: "Jordan" },
  { id: "u3", label: "Sam" }
];

export function UserSwitcher({ userId, onSwitch }: UserSwitcherProps) {
  const current = users.find((u) => u.id === userId);

  return (
    <div className="user-switcher">
      <div className="user-switcher__current">
        <div className="user-switcher__avatar">
          {current?.label.charAt(0).toUpperCase() ?? "?"}
        </div>
        <span className="user-switcher__name">{current?.label ?? userId}</span>
      </div>
      <select
        className="user-switcher__select"
        value={userId}
        onChange={(e) => onSwitch(e.target.value)}
      >
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.label}</option>
        ))}
      </select>
    </div>
  );
}
