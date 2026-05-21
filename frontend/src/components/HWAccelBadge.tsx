import React from 'react';
import { useHardwareDecoding } from '@/hooks/useHardwareDecoding';
import { Cpu } from 'lucide-react';

export const HWAccelBadge: React.FC = () => {
  const hwSupport = useHardwareDecoding();
  const isEnabled = Object.values(hwSupport).some(supported => supported);

  if (!isEnabled) return null;

  return (
    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-[10px] font-bold uppercase tracking-wider border border-green-500/20">
      <Cpu className="w-3 h-3" />
      <span>HW ACCEL</span>
    </div>
  );
};
