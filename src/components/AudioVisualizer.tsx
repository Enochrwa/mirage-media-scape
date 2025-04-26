
import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface AudioVisualizerProps {
  className?: string;
  isPlaying: boolean;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ className, isPlaying }) => {
  const [visualizationType, setVisualizationType] = useState<'bars' | 'wave' | 'circle'>('bars');
  
  const renderBars = () => {
    const barCount = 27;
    const bars = [];
    
    for (let i = 0; i < barCount; i++) {
      // Generate pseudo-random heights that look good
      const heightPercentage = isPlaying 
        ? 40 + Math.sin(i * 0.5) * 30 + Math.cos(i * 0.3) * 30 + Math.random() * 20
        : 10 + Math.sin(i * 0.5) * 5;
      
      bars.push(
        <div 
          key={i} 
          className={cn(
            "bg-accent w-1 rounded-full transition-all duration-300", 
            isPlaying ? "animate-wave-" + ((i % 5) + 1) : "h-1"
          )} 
          style={{ 
            height: `${heightPercentage}%`,
            animationDelay: `${i * 0.05}s` 
          }}
        />
      );
    }
    
    return (
      <div className="flex items-end justify-center w-full h-full gap-1">
        {bars}
      </div>
    );
  };
  
  const renderWave = () => {
    return (
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <div 
            className={cn(
              "w-full h-[1px] bg-gradient-to-r from-transparent via-accent to-transparent",
              isPlaying && "animate-pulse-slow"
            )}
          ></div>
        </div>
        <div className="relative w-40 h-40">
          <div 
            className={cn(
              "absolute inset-0 rounded-full border-2 border-accent/30",
              isPlaying && "animate-spin-slow"
            )}
          ></div>
          <div 
            className={cn(
              "absolute inset-2 rounded-full border border-accent/60",
              isPlaying && "animate-spin-slow"
            )}
            style={{ animationDirection: 'reverse', animationDuration: '5s' }}
          ></div>
          <div 
            className={cn(
              "absolute inset-4 rounded-full border border-accent/80",
              isPlaying && "animate-pulse-slow"
            )}
          ></div>
        </div>
      </div>
    );
  };
  
  const renderCircle = () => {
    const circleCount = 3;
    const circles = [];
    
    for (let i = 0; i < circleCount; i++) {
      circles.push(
        <div 
          key={i} 
          className={cn(
            "absolute rounded-full border border-accent/80",
            isPlaying && "animate-pulse-slow"
          )}
          style={{ 
            inset: `${10 * i}%`, 
            animationDelay: `${i * 0.2}s` 
          }}
        ></div>
      );
    }
    
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        {circles}
        <div className={cn(
          "w-8 h-8 rounded-full bg-accent/80",
          isPlaying && "animate-bounce-slow"
        )}></div>
      </div>
    );
  };
  
  const renderVisualizer = () => {
    switch(visualizationType) {
      case 'wave':
        return renderWave();
      case 'circle':
        return renderCircle();
      case 'bars':
      default:
        return renderBars();
    }
  };
  
  return (
    <div 
      className={cn("w-full h-full", className)} 
      onClick={() => setVisualizationType(prevType => {
        const types: ('bars' | 'wave' | 'circle')[] = ['bars', 'wave', 'circle'];
        const currentIndex = types.indexOf(prevType);
        const nextIndex = (currentIndex + 1) % types.length;
        return types[nextIndex];
      })}
    >
      {renderVisualizer()}
    </div>
  );
};

export default AudioVisualizer;
