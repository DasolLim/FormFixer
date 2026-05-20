import type { CSSProperties, ReactNode } from 'react';

export type TabItem<T extends string = string> = {
  key: T;
  label: ReactNode;
};

type TabsProps<T extends string = string> = {
  tabs: TabItem<T>[];
  active: T;
  onChange: (key: T) => void;
  style?: CSSProperties;
};

export function Tabs<T extends string = string>({ tabs, active, onChange, style }: TabsProps<T>) {
  return (
    <div
      style={{
        display: 'inline-flex',
        background: 'var(--bg-input)',
        borderRadius: '999px',
        padding: '4px',
        gap: '2px',
        ...style,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            style={{
              height: '36px',
              padding: '0 18px',
              borderRadius: '999px',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '13px',
              fontWeight: isActive ? 700 : 500,
              background: isActive ? 'var(--accent)' : 'transparent',
              color: isActive ? 'var(--text-on-lime)' : 'var(--text-secondary)',
              transition: 'background 0.15s ease, color 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
