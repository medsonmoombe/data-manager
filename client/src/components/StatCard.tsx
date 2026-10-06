import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  subColor?: string;
  icon?: React.ReactNode;
  color?: 'green' | 'red' | 'orange' | 'blue' | 'purple' | 'black';
  link?: string;
  onClick?: () => void;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  className?: string;
  loading?: boolean;
}

const COLOR_MAP: Record<string, { bg: string; text: string; bar: string }> = {
  green: { bg: 'bg-[rgba(0,155,58,0.08)]', text: 'text-[#009B3A]', bar: 'bg-[#009B3A]' },
  red: { bg: 'bg-[rgba(206,17,38,0.08)]', text: 'text-[#CE1126]', bar: 'bg-[#CE1126]' },
  orange: { bg: 'bg-[rgba(232,97,29,0.08)]', text: 'text-[#E8611D]', bar: 'bg-[#E8611D]' },
  blue: { bg: 'bg-[rgba(37,99,235,0.08)]', text: 'text-[#2563EB]', bar: 'bg-[#2563EB]' },
  purple: { bg: 'bg-[rgba(124,58,237,0.08)]', text: 'text-[#7C3AED]', bar: 'bg-[#7C3AED]' },
  black: { bg: 'bg-[rgba(0,0,0,0.05)]', text: 'text-[#1A1F2E]', bar: 'bg-[#1A1F2E]' },
};

export default function StatCard({
  label, value, sub, subColor, icon, color = 'green', link, onClick, prefix, suffix, className = '', loading,
}: StatCardProps) {
  const c = COLOR_MAP[color] || COLOR_MAP.green;

  return (
    <div
      onClick={onClick || (link ? () => window.location.href = link : undefined)}
      className={`bg-white border border-[#E3E7EE] rounded-[10px] p-3.5 shadow-sm ${onClick || link ? 'cursor-pointer hover:shadow-md transition-all relative group' : ''} ${className}`}
    >
      <div className={`absolute top-0 left-0 right-0 h-0.5 rounded-t-[10px] ${c.bar}`} />
      <div className="flex items-center gap-2 mb-2">
        {icon && (
          <div className={`w-7 h-7 rounded-[7px] flex items-center justify-center text-[13px] ${c.bg} ${c.text}`}>
            {icon}
          </div>
        )}
        {prefix && <div className={c.text}>{prefix}</div>}
      </div>
      <div className="font-heading text-xl font-bold text-[#1A1F2E]">
        {loading ? (
          <div className="h-7 w-16 bg-[#F3F4F6] rounded animate-pulse" />
        ) : (
          <>{value}</>
        )}
      </div>
      <div className="text-[10px] text-[#99A1B3] mt-0.5">{label}</div>
      {sub && <div className="text-[11px] mt-1" style={{ color: subColor || '#99A1B3' }}>{sub}</div>}
      {suffix && <div className="mt-1">{suffix}</div>}
    </div>
  );
}

export { COLOR_MAP };
export type { StatCardProps };
