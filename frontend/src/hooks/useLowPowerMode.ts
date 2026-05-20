import { useState, useEffect } from 'react';
import { resourceMonitor } from '@/engines/ResourceMonitor';

export function useLowPowerMode(): boolean {
  const [lowPower, setLowPower] = useState(resourceMonitor.isLowPowerMode());

  useEffect(() => {
    return resourceMonitor.subscribe(() => {
      setLowPower(resourceMonitor.isLowPowerMode());
    });
  }, []);

  return lowPower;
}
