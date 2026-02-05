type Props = { onSettings: () => void };

export function TopBar({ onSettings }: Props) {
  const prefix = process.env.NEXT_PUBLIC_BASE_PATH || "";

  return (
    <div className="topbar">
      <div className="brand-mark">
        <img
          src={`${prefix}/assets/logo.png`}
          alt="SpritePacker logo"
          className="logo-img"
        />
        <span className="brand-name">SpritePacker</span>
      </div>
      <button className="secondary" onClick={onSettings}>
        Menu
      </button>
    </div>
  );
}
