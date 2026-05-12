import { useState, useEffect } from 'react';
import { ResourceMonitor } from '@/engines/ResourceMonitor';

export function useLowPowerMode(): boolean {
  const [lowPower, setLowPower] = useState(
    ResourceMonitor.getInstance().isLowPowerMode()
  );

  useEffect(() => {
    return ResourceMonitor.getInstance().subscribe(setLowPower);
  }, []);

  return lowPower;
}
