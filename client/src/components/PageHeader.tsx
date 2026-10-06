import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
}

export default function PageHeader({ title, subtitle, children, className = '' }: PageHeaderProps) {
  return (
    <div className={`mb-4 ${className}`}>
      <div className="h-0.5 rounded-sm mb-4 opacity-70"
        style={{ background: 'linear-gradient(90deg, #009B3A 0%, #009B3A 35%, #CE1126 35%, #CE1126 55%, #1A1A1A 55%, #1A1A1A 75%, #E8611D 75%, #E8611D 100%)' }}
      />
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-[18px] font-bold text-[#1A1F2E] tracking-tight m-0">{title}</h1>
          {subtitle && <p className="text-[12px] text-[#99A1B3] mt-0.5 mb-0">{subtitle}</p>}
        </div>
        {children && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
