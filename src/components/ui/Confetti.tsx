'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface ConfettiOptions {
  particleCount?: number;
  spread?: number;
  startVelocity?: number;
  gravity?: number;
  drift?: number;
  colors?: string[];
  shapes?: ('square' | 'circle' | 'star')[];
  duration?: number;
  onComplete?: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  shape: 'square' | 'circle' | 'star';
  size: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
}

export function Confetti({
  particleCount = 100,
  spread = 50,
  startVelocity = 45,
  gravity = 0.5,
  drift = 0,
  colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#FFA07A'],
  shapes = ['square', 'circle'],
  duration = 3000,
  onComplete,
}: ConfettiOptions) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number | undefined>(undefined);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Initialize particles
    const particles: Particle[] = [];
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * spread * (Math.PI / 180);
      const velocity = startVelocity * (0.5 + Math.random() * 0.5);

      particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - Math.random() * 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        size: 10 + Math.random() * 10,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        opacity: 1,
      });
    }

    particlesRef.current = particles;
    startTimeRef.current = Date.now();

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const elapsed = Date.now() - startTimeRef.current!;
      const progress = Math.min(elapsed / duration, 1);

      particlesRef.current.forEach((particle) => {
        // Update physics
        particle.vy += gravity;
        particle.vx += drift;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.rotation += particle.rotationSpeed;
        particle.opacity = 1 - progress;

        // Draw particle
        ctx.save();
        ctx.globalAlpha = particle.opacity;
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rotation);

        switch (particle.shape) {
          case 'square':
            ctx.fillStyle = particle.color;
            ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
            break;
          case 'circle':
            ctx.fillStyle = particle.color;
            ctx.beginPath();
            ctx.arc(0, 0, particle.size / 2, 0, Math.PI * 2);
            ctx.fill();
            break;
          case 'star':
            drawStar(ctx, 0, 0, 5, particle.size / 2, particle.size / 4, particle.color);
            break;
        }

        ctx.restore();
      });

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        onComplete?.();
      }
    };

    animate();

    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 50, 50]);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [particleCount, spread, startVelocity, gravity, drift, colors, shapes, duration, onComplete]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
      style={{ width: '100%', height: '100%' }}
    />
  );
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spikes: number,
  outerRadius: number,
  innerRadius: number,
  color: string
) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);

  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }

  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
  ctx.fill();
}

// Fireworks Animation Component
export function Fireworks({ onComplete }: { onComplete?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const fireworks: any[] = [];
    const particles: any[] = [];

    // Create firework
    const createFirework = () => {
      fireworks.push({
        x: Math.random() * canvas.width,
        y: canvas.height,
        vx: (Math.random() - 0.5) * 2,
        vy: -(10 + Math.random() * 5),
        color: `hsl(${Math.random() * 360}, 100%, 60%)`,
        trail: [],
      });
    };

    // Create explosion
    const createExplosion = (x: number, y: number, color: string) => {
      const particleCount = 30 + Math.random() * 30;
      for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 * i) / particleCount;
        const velocity = 2 + Math.random() * 4;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity,
          color,
          size: 2 + Math.random() * 2,
          life: 1,
        });
      }

      // Haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(100);
      }
    };

    // Animation loop
    const animate = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update and draw fireworks
      for (let i = fireworks.length - 1; i >= 0; i--) {
        const fw = fireworks[i];
        fw.vy += 0.2; // gravity
        fw.x += fw.vx;
        fw.y += fw.vy;

        // Trail
        fw.trail.push({ x: fw.x, y: fw.y });
        if (fw.trail.length > 10) fw.trail.shift();

        // Draw trail
        ctx.strokeStyle = fw.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        fw.trail.forEach((point: any, index: number) => {
          if (index === 0) {
            ctx.moveTo(point.x, point.y);
          } else {
            ctx.lineTo(point.x, point.y);
          }
        });
        ctx.stroke();

        // Draw firework
        ctx.fillStyle = fw.color;
        ctx.beginPath();
        ctx.arc(fw.x, fw.y, 3, 0, Math.PI * 2);
        ctx.fill();

        // Explode at peak
        if (fw.vy > 0) {
          createExplosion(fw.x, fw.y, fw.color);
          fireworks.splice(i, 1);
        }
      }

      // Update and draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= 0.02;
        p.vy += 0.1; // gravity
        p.x += p.vx;
        p.y += p.vy;

        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        if (p.life <= 0) {
          particles.splice(i, 1);
        }
      }

      ctx.globalAlpha = 1;

      // Create new fireworks
      if (Math.random() < 0.05) {
        createFirework();
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    // Stop after duration
    setTimeout(() => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      onComplete?.();
    }, 5000);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [onComplete]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
      style={{ width: '100%', height: '100%' }}
    />
  );
}

// Success Animation Component
export function SuccessAnimation({ message = '성공!' }: { message?: string }) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
      <div className="animate-scale-in">
        <div className="relative">
          {/* Success checkmark */}
          <div className="w-32 h-32 rounded-full bg-green-500 flex items-center justify-center shadow-2xl">
            <svg
              className="w-20 h-20 text-white animate-draw"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M 20 50 L 40 70 L 75 25" />
            </svg>
          </div>
          {/* Pulsing rings */}
          <div className="absolute inset-0 rounded-full bg-green-500 animate-ping" />
        </div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-4 text-center animate-fadeIn">
          {message}
        </p>
      </div>
    </div>
  );
}

// Celebration hook
export function useCelebration() {
  const [celebrating, setCelebrating] = useState(false);

  const celebrate = (type: 'confetti' | 'fireworks' | 'success' = 'confetti') => {
    setCelebrating(true);
    setTimeout(() => setCelebrating(false), 5000);
  };

  return { celebrating, celebrate };
}