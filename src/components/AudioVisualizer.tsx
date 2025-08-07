import React, { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface AudioVisualizerProps {
  className?: string;
  isPlaying: boolean;
  intensity?: number;
  colorScheme?: 'default' | 'neon' | 'fire' | 'ocean' | 'galaxy' | 'matrix' | 'rainbow';
  visualizerType?: 'bars' | 'wave' | 'circle' | 'spectrum' | 'orbit' | 'dna' | 'particle' | 'liquid';
  showControls?: boolean;
  responsive?: boolean;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ 
  className, 
  isPlaying,
  intensity = 0.7,
  colorScheme = 'default',
  visualizerType = 'bars',
  showControls = true,
  responsive = true
}) => {
  const [currentType, setCurrentType] = useState(visualizerType);
  const [animationSpeed, setAnimationSpeed] = useState(1);
  const [particleCount, setParticleCount] = useState(50);
  const [glowEffect, setGlowEffect] = useState(true);
  const [mirrorMode, setMirrorMode] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const timeRef = useRef(0);

  // Color schemes
  const colorSchemes = {
    default: ['#8B5CF6', '#06B6D4', '#10B981'],
    neon: ['#FF0080', '#00FF80', '#8000FF', '#FF8000'],
    fire: ['#FF4500', '#FF6347', '#FFD700', '#FF8C00'],
    ocean: ['#0080FF', '#00BFFF', '#1E90FF', '#4169E1'],
    galaxy: ['#9932CC', '#8A2BE2', '#4B0082', '#6A5ACD'],
    matrix: ['#00FF00', '#32CD32', '#7FFF00', '#ADFF2F'],
    rainbow: ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3']
  };

  const getColors = () => colorSchemes[colorScheme] || colorSchemes.default;

  // Advanced bar visualizer with multiple variations
  const renderBars = () => {
    const barCount = responsive ? Math.min(64, Math.max(20, Math.floor(window.innerWidth / 20))) : 40;
    const bars = [];
    const colors = getColors();
    
    for (let i = 0; i < barCount; i++) {
      const baseHeight = 10;
      const animatedHeight = isPlaying 
        ? baseHeight + Math.sin(timeRef.current * 0.01 + i * 0.2) * 30 * intensity + 
          Math.cos(timeRef.current * 0.015 + i * 0.15) * 25 * intensity +
          Math.random() * 20 * intensity
        : baseHeight + Math.sin(i * 0.5) * 5;
      
      const heightPercentage = Math.max(5, Math.min(95, animatedHeight));
      const colorIndex = Math.floor((i / barCount) * colors.length);
      const color = colors[colorIndex];
      
      bars.push(
        <div 
          key={i} 
          className={cn(
            "rounded-full transition-all duration-200 relative",
            glowEffect && "shadow-lg",
            mirrorMode && "transform-gpu"
          )} 
          style={{ 
            height: `${heightPercentage}%`,
            width: `${Math.max(2, 100 / barCount - 1)}%`,
            backgroundColor: color,
            boxShadow: glowEffect ? `0 0 20px ${color}40` : 'none',
            transform: mirrorMode ? `scaleY(${1 + Math.sin(timeRef.current * 0.01 + i * 0.1) * 0.3})` : 'none',
            animationDelay: `${i * 20}ms`,
            filter: `hue-rotate(${Math.sin(timeRef.current * 0.005 + i * 0.1) * 30}deg)`
          }}
        >
          {glowEffect && (
            <div 
              className="absolute inset-0 rounded-full animate-pulse"
              style={{ 
                backgroundColor: color,
                opacity: 0.3,
                filter: 'blur(4px)'
              }}
            />
          )}
        </div>
      );
    }
    
    return (
      <div className="flex items-end justify-center w-full h-full gap-1 px-4">
        {bars}
      </div>
    );
  };

  // Advanced wave visualizer with multiple sine waves
  const renderWave = () => {
    const colors = getColors();
    const waveCount = colors.length;
    
    return (
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        <svg width="100%" height="100%" className="absolute inset-0">
          {Array.from({ length: waveCount }, (_, i) => {
            const amplitude = isPlaying ? 30 + i * 10 : 5;
            const frequency = 0.02 + i * 0.01;
            const phase = timeRef.current * 0.01 + i * Math.PI / 2;
            
            const pathData = Array.from({ length: 100 }, (_, x) => {
              const xPos = (x / 99) * 100;
              const yPos = 50 + Math.sin(x * frequency + phase) * amplitude * intensity;
              return `${x === 0 ? 'M' : 'L'} ${xPos} ${yPos}`;
            }).join(' ');
            
            return (
              <path
                key={i}
                d={pathData}
                stroke={colors[i]}
                strokeWidth="2"
                fill="none"
                opacity={0.8 - i * 0.2}
                style={{
                  filter: glowEffect ? `drop-shadow(0 0 10px ${colors[i]}60)` : 'none',
                  transform: `translateY(${Math.sin(phase + i) * 10}px)`
                }}
              />
            );
          })}
        </svg>
      </div>
    );
  };

  // Orbital visualizer with rotating elements
  const renderOrbit = () => {
    const colors = getColors();
    const orbitCount = 3;
    
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        {Array.from({ length: orbitCount }, (_, i) => {
          const radius = 20 + i * 25;
          const speed = isPlaying ? 1 + i * 0.5 : 0.1;
          const particlesInOrbit = 6 + i * 2;
          
          return (
            <div
              key={i}
              className="absolute rounded-full border border-opacity-30"
              style={{
                width: `${radius * 2}px`,
                height: `${radius * 2}px`,
                borderColor: colors[i % colors.length],
                animation: isPlaying ? `spin ${10 / speed}s linear infinite` : 'none'
              }}
            >
              {Array.from({ length: particlesInOrbit }, (_, j) => {
                const angle = (j / particlesInOrbit) * 2 * Math.PI;
                const x = Math.cos(angle + timeRef.current * 0.01 * speed) * radius;
                const y = Math.sin(angle + timeRef.current * 0.01 * speed) * radius;
                
                return (
                  <div
                    key={j}
                    className="absolute w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: colors[(i + j) % colors.length],
                      left: `calc(50% + ${x}px)`,
                      top: `calc(50% + ${y}px)`,
                      transform: 'translate(-50%, -50%)',
                      boxShadow: glowEffect ? `0 0 10px ${colors[(i + j) % colors.length]}` : 'none',
                      opacity: isPlaying ? 0.8 + Math.sin(timeRef.current * 0.02 + j) * 0.2 : 0.3
                    }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  // DNA helix visualizer
  const renderDNA = () => {
    const colors = getColors();
    const helixHeight = 200;
    const helixWidth = 100;
    const segments = 20;
    
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        <svg width={helixWidth} height={helixHeight} className="absolute">
          {Array.from({ length: segments }, (_, i) => {
            const t = i / segments;
            const angle1 = t * 4 * Math.PI + (isPlaying ? timeRef.current * 0.02 : 0);
            const angle2 = angle1 + Math.PI;
            
            const x1 = helixWidth / 2 + Math.cos(angle1) * 30;
            const y1 = t * helixHeight;
            const x2 = helixWidth / 2 + Math.cos(angle2) * 30;
            const y2 = t * helixHeight;
            
            return (
              <g key={i}>
                <circle
                  cx={x1}
                  cy={y1}
                  r={3 + (isPlaying ? Math.sin(timeRef.current * 0.01 + i) * 2 * intensity : 0)}
                  fill={colors[0]}
                  opacity={0.8}
                  style={{ filter: glowEffect ? `drop-shadow(0 0 5px ${colors[0]})` : 'none' }}
                />
                <circle
                  cx={x2}
                  cy={y2}
                  r={3 + (isPlaying ? Math.cos(timeRef.current * 0.01 + i) * 2 * intensity : 0)}
                  fill={colors[1] || colors[0]}
                  opacity={0.8}
                  style={{ filter: glowEffect ? `drop-shadow(0 0 5px ${colors[1] || colors[0]})` : 'none' }}
                />
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={colors[2] || colors[0]}
                  strokeWidth="1"
                  opacity={0.5}
                />
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  // Particle system visualizer
  const renderParticle = () => {
    const colors = getColors();
    const particles = Array.from({ length: particleCount }, (_, i) => {
      const size = 2 + Math.random() * 4;
      const speed = isPlaying ? 0.5 + Math.random() * 2 : 0.1;
      const x = 10 + Math.random() * 80;
      const y = 10 + Math.random() * 80;
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      return (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: `${size}px`,
            height: `${size}px`,
            left: `${x}%`,
            top: `${y}%`,
            backgroundColor: color,
            opacity: isPlaying ? 0.6 + Math.sin(timeRef.current * 0.01 + i) * 0.3 : 0.2,
            transform: isPlaying 
              ? `translate(${Math.sin(timeRef.current * 0.005 + i) * 50}px, ${Math.cos(timeRef.current * 0.007 + i) * 30}px) scale(${1 + Math.sin(timeRef.current * 0.01 + i) * 0.5})`
              : 'none',
            boxShadow: glowEffect ? `0 0 ${size * 2}px ${color}` : 'none',
            filter: `blur(${Math.sin(timeRef.current * 0.01 + i) * 1}px)`,
            transition: 'all 0.3s ease'
          }}
        />
      );
    });
    
    return (
      <div className="relative w-full h-full overflow-hidden">
        {particles}
      </div>
    );
  };

  // Liquid/fluid visualizer
  const renderLiquid = () => {
    const colors = getColors();
    const blobCount = 5;
    
    return (
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        {Array.from({ length: blobCount }, (_, i) => {
          const size = 40 + i * 20;
          const speed = isPlaying ? 0.5 + i * 0.2 : 0.1;
          const x = 50 + Math.sin(timeRef.current * 0.003 + i) * 30;
          const y = 50 + Math.cos(timeRef.current * 0.004 + i * 1.5) * 25;
          
          return (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: `${size + (isPlaying ? Math.sin(timeRef.current * 0.01 + i) * 20 * intensity : 0)}px`,
                height: `${size + (isPlaying ? Math.cos(timeRef.current * 0.012 + i) * 15 * intensity : 0)}px`,
                left: `${x}%`,
                top: `${y}%`,
                background: `radial-gradient(circle, ${colors[i % colors.length]}40 0%, ${colors[i % colors.length]}80 50%, transparent 100%)`,
                transform: 'translate(-50%, -50%)',
                filter: `blur(${2 + Math.sin(timeRef.current * 0.01 + i) * 2}px) hue-rotate(${Math.sin(timeRef.current * 0.005) * 60}deg)`,
                opacity: 0.7,
                mixBlendMode: 'screen'
              }}
            />
          );
        })}
      </div>
    );
  };

  // Spectrum analyzer with frequency bands
  const renderSpectrum = () => {
    const colors = getColors();
    const bands = 32;
    const frequencyData = Array.from({ length: bands }, (_, i) => {
      const frequency = i / bands;
      const amplitude = isPlaying 
        ? Math.sin(timeRef.current * 0.01 + frequency * 10) * 0.5 + 0.5
        : 0.1;
      return amplitude * intensity;
    });
    
    return (
      <div className="flex items-end justify-center w-full h-full gap-1 px-2">
        {frequencyData.map((amplitude, i) => {
          const height = 10 + amplitude * 80;
          const colorIndex = Math.floor((i / bands) * colors.length);
          const color = colors[colorIndex];
          
          return (
            <div
              key={i}
              className="rounded-t-lg transition-all duration-100"
              style={{
                height: `${height}%`,
                width: `${100 / bands - 1}%`,
                background: `linear-gradient(to top, ${color}20 0%, ${color} 100%)`,
                boxShadow: glowEffect ? `0 0 10px ${color}60` : 'none',
                transform: `scaleY(${0.5 + amplitude})`,
                filter: `hue-rotate(${Math.sin(timeRef.current * 0.005 + i * 0.1) * 30}deg)`
              }}
            />
          );
        })}
      </div>
    );
  };

  // Enhanced circle visualizer with multiple rings
  const renderCircle = () => {
    const colors = getColors();
    const rings = 4;
    
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        {Array.from({ length: rings }, (_, i) => {
          const size = 50 + i * 30;
          const rotation = isPlaying ? timeRef.current * 0.01 * (i + 1) : 0;
          const pulse = isPlaying ? 1 + Math.sin(timeRef.current * 0.02 + i) * 0.3 * intensity : 1;
          
          return (
            <div
              key={i}
              className="absolute rounded-full border-2"
              style={{
                width: `${size * pulse}px`,
                height: `${size * pulse}px`,
                borderColor: colors[i % colors.length],
                opacity: 0.8 - i * 0.15,
                transform: `rotate(${rotation * (i % 2 === 0 ? 1 : -1)}rad)`,
                borderStyle: i % 2 === 0 ? 'solid' : 'dashed',
                boxShadow: glowEffect ? `0 0 20px ${colors[i % colors.length]}40` : 'none',
                filter: `blur(${i * 0.5}px)`
              }}
            />
          );
        })}
        
        {/* Center dot */}
        <div
          className="absolute w-4 h-4 rounded-full"
          style={{
            backgroundColor: colors[0],
            transform: isPlaying ? `scale(${1 + Math.sin(timeRef.current * 0.02) * 0.5})` : 'scale(1)',
            boxShadow: glowEffect ? `0 0 15px ${colors[0]}` : 'none'
          }}
        />
      </div>
    );
  };

  // Animation loop
  useEffect(() => {
    if (!isPlaying) return;

    const animate = () => {
      timeRef.current += animationSpeed;
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, animationSpeed]);

  const renderVisualizer = () => {
    switch(currentType) {
      case 'wave':
        return renderWave();
      case 'circle':
        return renderCircle();
      case 'spectrum':
        return renderSpectrum();
      case 'orbit':
        return renderOrbit();
      case 'dna':
        return renderDNA();
      case 'particle':
        return renderParticle();
      case 'liquid':
        return renderLiquid();
      case 'bars':
      default:
        return renderBars();
    }
  };

  const visualizerTypes = ['bars', 'wave', 'circle', 'spectrum', 'orbit', 'dna', 'particle', 'liquid'] as const;

  const nextVisualizer = () => {
    const currentIndex = visualizerTypes.indexOf(currentType);
    const nextIndex = (currentIndex + 1) % visualizerTypes.length;
    setCurrentType(visualizerTypes[nextIndex]);
  };

  return (
    <div className={cn("relative w-full h-full select-none", className)}>
      <div 
        className="w-full h-full cursor-pointer transition-all duration-300 hover:scale-105"
        onClick={nextVisualizer}
        style={{
          background: isPlaying 
            ? `radial-gradient(ellipse at center, ${getColors()[0]}10 0%, transparent 70%)`
            : 'transparent'
        }}
      >
        {renderVisualizer()}
      </div>
      
      {showControls && (
        <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 hover:opacity-100 transition-opacity duration-300">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setGlowEffect(!glowEffect);
            }}
            className="px-2 py-1 text-xs bg-black/50 text-white rounded hover:bg-black/70"
            title="Toggle Glow Effect"
          >
            ✨
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMirrorMode(!mirrorMode);
            }}
            className="px-2 py-1 text-xs bg-black/50 text-white rounded hover:bg-black/70"
            title="Toggle Mirror Mode"
          >
            🪞
          </button>
        </div>
      )}
      
      {showControls && (
        <div className="absolute bottom-2 left-2 text-xs text-white/70 bg-black/30 px-2 py-1 rounded">
          {currentType.toUpperCase()}
        </div>
      )}
      
      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .animate-wave-1 { animation: wave1 0.6s ease-in-out infinite alternate; }
        .animate-wave-2 { animation: wave2 0.7s ease-in-out infinite alternate; }
        .animate-wave-3 { animation: wave3 0.8s ease-in-out infinite alternate; }
        .animate-wave-4 { animation: wave4 0.9s ease-in-out infinite alternate; }
        .animate-wave-5 { animation: wave5 1.0s ease-in-out infinite alternate; }
        
        @keyframes wave1 { 0% { transform: scaleY(0.5); } 100% { transform: scaleY(1.2); } }
        @keyframes wave2 { 0% { transform: scaleY(0.6); } 100% { transform: scaleY(1.1); } }
        @keyframes wave3 { 0% { transform: scaleY(0.4); } 100% { transform: scaleY(1.3); } }
        @keyframes wave4 { 0% { transform: scaleY(0.7); } 100% { transform: scaleY(1.0); } }
        @keyframes wave5 { 0% { transform: scaleY(0.5); } 100% { transform: scaleY(1.4); } }
      `}</style>
    </div>
  );
};

export default AudioVisualizer;