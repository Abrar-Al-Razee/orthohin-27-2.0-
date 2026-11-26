import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'motion/react';
import { RotateCw } from 'lucide-react';
import type { ThemeMode } from '../utils/theme';

interface SpatialMeshCanvasProps {
  theme: ThemeMode;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// Architectural 3D icosahedron vertices + subtle ambient particle nodes projected in perspective
const PHI = (1 + Math.sqrt(5)) / 2;
const RAW_VERTS: Vec3[] = [
  { x: -1, y: PHI, z: 0 },
  { x: 1, y: PHI, z: 0 },
  { x: -1, y: -PHI, z: 0 },
  { x: 1, y: -PHI, z: 0 },
  { x: 0, y: -1, z: PHI },
  { x: 0, y: 1, z: PHI },
  { x: 0, y: -1, z: -PHI },
  { x: 0, y: 1, z: -PHI },
  { x: PHI, y: 0, z: -1 },
  { x: PHI, y: 0, z: 1 },
  { x: -PHI, y: 0, z: -1 },
  { x: -PHI, y: 0, z: 1 },
].map((v) => {
  const len = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / len, y: v.y / len, z: v.z / len };
});

const ICO_EDGES: Array<[number, number]> = [];
for (let i = 0; i < RAW_VERTS.length; i++) {
  for (let j = i + 1; j < RAW_VERTS.length; j++) {
    const d = Math.hypot(
      RAW_VERTS[i].x - RAW_VERTS[j].x,
      RAW_VERTS[i].y - RAW_VERTS[j].y,
      RAW_VERTS[i].z - RAW_VERTS[j].z
    );
    if (d < 1.15) ICO_EDGES.push([i, j]);
  }
}

const ORBIT_NODES: Vec3[] = Array.from({ length: 28 }, (_, i) => {
  const angle = (i / 28) * Math.PI * 2;
  const tilt = Math.sin(i * 1.7) * 0.65;
  const radius = 1.45 + (i % 3) * 0.28;
  return {
    x: Math.cos(angle) * radius,
    y: tilt * radius * 0.6,
    z: Math.sin(angle) * radius,
  };
});

export function SpatialMeshCanvas({ theme }: SpatialMeshCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let targetMouseX = 0;
    let targetMouseY = 0;
    let mouseX = 0;
    let mouseY = 0;
    let scrollRatio = 0;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (width <= 0 || height <= 0) return;
      targetMouseX = (e.clientX / width - 0.5) * 2;
      targetMouseY = (e.clientY / height - 0.5) * 2;
    };

    const onScroll = () => {
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      scrollRatio = Math.min(1, Math.max(0, window.scrollY / maxScroll));
    };

    resize();
    onScroll();
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    const project = (p: Vec3, ax: number, ay: number, cx: number, cy: number, scale: number) => {
      const cosY = Math.cos(ay);
      const sinY = Math.sin(ay);
      const x1 = p.x * cosY - p.z * sinY;
      const z1 = p.x * sinY + p.z * cosY;

      const cosX = Math.cos(ax);
      const sinX = Math.sin(ax);
      const y2 = p.y * cosX - z1 * sinX;
      const z2 = p.y * sinX + z1 * cosX;

      const fov = 4.2;
      const persp = fov / (fov + z2 + 1.4);
      return {
        x: cx + x1 * scale * persp,
        y: cy + y2 * scale * persp,
        z: z2,
        persp,
      };
    };

    let t = 0;
    const render = () => {
      if (document.visibilityState === 'hidden' && !reducedMotion) {
        rafId = window.requestAnimationFrame(render);
        return;
      }

      mouseX += (targetMouseX - mouseX) * 0.045;
      mouseY += (targetMouseY - mouseY) * 0.045;
      if (!reducedMotion) t += 0.0032;

      ctx.clearRect(0, 0, width, height);

      const isDark = theme === 'dark';
      const edgeStroke = isDark ? 'rgba(244, 244, 245, 0.075)' : 'rgba(24, 24, 27, 0.065)';
      const accentStroke = isDark ? 'rgba(244, 63, 94, 0.16)' : 'rgba(225, 29, 72, 0.12)';
      const nodeFill = isDark ? 'rgba(244, 63, 94, 0.34)' : 'rgba(225, 29, 72, 0.24)';
      const secondaryNodeFill = isDark ? 'rgba(161, 161, 170, 0.22)' : 'rgba(82, 82, 91, 0.18)';

      const cx = width * (width >= 1024 ? 0.77 : 0.5) + mouseX * 18;
      const cy = height * 0.42 - scrollRatio * 90 + mouseY * 14;
      const scale = Math.min(width, height) * (width >= 1024 ? 0.34 : 0.28);

      const rotY = t + mouseX * 0.35 + scrollRatio * 1.1;
      const rotX = t * 0.65 + mouseY * 0.25 + 0.35;

      const projectedVerts = RAW_VERTS.map((v) => project(v, rotX, rotY, cx, cy, scale));

      // Draw architectural icosahedral wireframe edges
      ctx.lineWidth = 1;
      for (let idx = 0; idx < ICO_EDGES.length; idx++) {
        const [a, b] = ICO_EDGES[idx];
        const va = projectedVerts[a];
        const vb = projectedVerts[b];
        ctx.strokeStyle = idx % 5 === 0 ? accentStroke : edgeStroke;
        ctx.beginPath();
        ctx.moveTo(va.x, va.y);
        ctx.lineTo(vb.x, vb.y);
        ctx.stroke();
      }

      // Inner nested wireframe at 0.54 scale counter-rotating cleanly
      const innerVerts = RAW_VERTS.map((v) =>
        project(
          { x: v.x * 0.54, y: v.y * 0.54, z: v.z * 0.54 },
          -rotX * 0.8,
          -rotY * 1.15,
          cx,
          cy,
          scale
        )
      );
      ctx.strokeStyle = accentStroke;
      ctx.lineWidth = 0.85;
      for (const [a, b] of ICO_EDGES) {
        ctx.beginPath();
        ctx.moveTo(innerVerts[a].x, innerVerts[a].y);
        ctx.lineTo(innerVerts[b].x, innerVerts[b].y);
        ctx.stroke();
      }

      // Draw outer orbital 3D nodes & subtle ring arcs
      const orbitProj = ORBIT_NODES.map((n) => project(n, rotX * 0.45 + 0.4, -rotY * 0.7, cx, cy, scale));
      ctx.strokeStyle = edgeStroke;
      ctx.beginPath();
      orbitProj.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.stroke();

      for (let i = 0; i < projectedVerts.length; i++) {
        const p = projectedVerts[i];
        ctx.fillStyle = i % 3 === 0 ? nodeFill : secondaryNodeFill;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1.4, p.persp * 2.5), 0, Math.PI * 2);
        ctx.fill();
      }

      for (let i = 0; i < orbitProj.length; i += 2) {
        const p = orbitProj[i];
        ctx.fillStyle = i % 4 === 0 ? nodeFill : secondaryNodeFill;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1.1, p.persp * 1.9), 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reducedMotion) {
        rafId = window.requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', onScroll);
    };
  }, [theme, reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 w-full h-full pointer-events-none z-0 opacity-90"
    />
  );
}

interface TiltStage3DProps {
  children: ReactNode;
  className?: string;
  maxTilt?: number;
  glare?: boolean;
  scaleOnHover?: number;
}

export function TiltStage3D({
  children,
  className = '',
  maxTilt = 7,
  glare = true,
  scaleOnHover = 1.012,
}: TiltStage3DProps) {
  const reducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rawRotateX = useMotionValue(0);
  const rawRotateY = useMotionValue(0);
  const rawGlareX = useMotionValue(50);
  const rawGlareY = useMotionValue(50);
  const [hovered, setHovered] = useState(false);

  const rotateX = useSpring(rawRotateX, { stiffness: 260, damping: 24, mass: 0.5 });
  const rotateY = useSpring(rawRotateY, { stiffness: 260, damping: 24, mass: 0.5 });
  const glareBg = useMotionTemplate`radial-gradient(circle at ${rawGlareX}% ${rawGlareY}%, rgba(255,255,255,0.16), rgba(225,29,72,0.06) 35%, transparent 72%)`;

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    rawRotateY.set((px - 0.5) * 2 * maxTilt);
    rawRotateX.set((0.5 - py) * 2 * maxTilt);
    rawGlareX.set(px * 100);
    rawGlareY.set(py * 100);
  };

  const handlePointerLeave = () => {
    setHovered(false);
    rawRotateX.set(0);
    rawRotateY.set(0);
  };

  return (
    <div
      ref={containerRef}
      onPointerEnter={(e) => {
        if (e.pointerType !== 'touch') setHovered(true);
      }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`perspective-1200 ${className}`}
    >
      <motion.div
        style={{
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
        }}
        animate={{
          scale: hovered ? scaleOnHover : 1,
        }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full h-full will-change-transform"
      >
        {children}
        {glare && (
          <motion.div
            aria-hidden="true"
            style={{ background: glareBg }}
            animate={{ opacity: hovered ? 1 : 0 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-none absolute inset-0 rounded-[inherit] z-20"
          />
        )}
      </motion.div>
    </div>
  );
}

interface Reveal3DProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  yOffset?: number;
  immediate?: boolean;
}

export function Reveal3D({
  children,
  className = '',
  delay = 0,
  yOffset = 18,
  immediate = false,
}: Reveal3DProps) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  if (immediate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: yOffset, rotateX: 6, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
        transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
        style={{ transformPerspective: 1100 }}
        className={className}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: yOffset, rotateX: 6, scale: 0.985 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{ transformPerspective: 1100 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface PageStage3DProps {
  viewKey: string;
  children: ReactNode;
}

export function PageStage3D({ viewKey, children }: PageStage3DProps) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <>{children}</>;
  }

  return (
    <motion.div
      key={viewKey}
      initial={{ opacity: 0, y: 12, rotateX: 2.5 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      style={{ transformPerspective: 1400 }}
    >
      {children}
    </motion.div>
  );
}

interface Hoodie3DStageProps {
  activeSide: 'front' | 'back';
  frontImage: string;
  backImage: string;
  frontLabel?: string;
  backLabel?: string;
  onToggleSide: () => void;
}

export function Hoodie3DStage({
  activeSide,
  frontImage,
  backImage,
  frontLabel = 'RCS Crest',
  backLabel = "Orthohin '27",
  onToggleSide,
}: Hoodie3DStageProps) {
  const reducedMotion = useReducedMotion();
  const isBack = activeSide === 'back';

  return (
    <TiltStage3D maxTilt={9} scaleOnHover={1.015} className="w-full">
      <div
        role="button"
        tabIndex={0}
        onClick={onToggleSide}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleSide();
          }
        }}
        aria-label={`RCS Hoodie 3D Showcase, currently showing ${isBack ? 'back' : 'front'} view. Click to flip 3D.`}
        className="perspective-1400 relative w-full aspect-[4/3] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded-2xl group"
      >
        <motion.div
          animate={{ rotateY: isBack ? 180 : 0 }}
          transition={
            reducedMotion
              ? { duration: 0.01 }
              : { type: 'spring', stiffness: 190, damping: 24, mass: 0.9 }
          }
          style={{ transformStyle: 'preserve-3d' }}
          className="relative w-full h-full rounded-2xl"
        >
          {/* FRONT FACE */}
          <div className="absolute inset-0 backface-hidden rounded-2xl overflow-hidden border border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 shadow-lg dark:shadow-2xl">
            <img
              src={frontImage}
              alt="RCS Hoodie — Front View"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
            <div
              style={{ transform: 'translateZ(24px)' }}
              className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 pointer-events-none"
            >
              <div className="px-3 py-1.5 rounded-lg bg-zinc-950/88 backdrop-blur-md border border-white/15 text-xs font-semibold text-white">
                Front View · {frontLabel}
              </div>
              <div className="px-2.5 py-1.5 rounded-lg bg-rose-600/90 backdrop-blur-md text-[11px] font-semibold text-white inline-flex items-center gap-1.5">
                <RotateCw className="w-3 h-3" />
                Flip 3D
              </div>
            </div>
          </div>

          {/* BACK FACE */}
          <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-2xl overflow-hidden border border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 shadow-lg dark:shadow-2xl">
            <img
              src={backImage}
              alt="RCS Hoodie — Back View"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
            <div
              style={{ transform: 'translateZ(24px)' }}
              className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 pointer-events-none"
            >
              <div className="px-3 py-1.5 rounded-lg bg-zinc-950/88 backdrop-blur-md border border-white/15 text-xs font-semibold text-white">
                Back View · {backLabel}
              </div>
              <div className="px-2.5 py-1.5 rounded-lg bg-rose-600/90 backdrop-blur-md text-[11px] font-semibold text-white inline-flex items-center gap-1.5">
                <RotateCw className="w-3 h-3" />
                Flip 3D
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </TiltStage3D>
  );
}
