import React from 'react';
import { Typography } from 'antd';

const { Text } = Typography;

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export default function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`bg-white border border-[#E3E7EE] rounded-[10px] p-10 shadow-sm text-center ${className}`}>
      {icon && (
        <div className="w-12 h-12 rounded-[10px] bg-[rgba(0,155,58,0.08)] flex items-center justify-center mx-auto mb-3 text-lg text-[#009B3A]">
          {icon}
        </div>
      )}
      <h3 className="font-heading text-sm font-bold text-[#1A1F2E] m-0">{title}</h3>
      {description && <p className="text-[11px] text-[#99A1B3] mt-1 mb-4 max-w-[400px] mx-auto">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}
