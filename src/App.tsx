import React from "react";
import "./App.css";

class P {
  constructor(public readonly x: number, public readonly y: number) {}

  public args(): [number, number] {
    return [this.x, this.y];
  }
}

function pt(x: number, y: number): P {
  return new P(x, y);
}

// need a "triangle-mapping" function

class TriPt {
  private static cache: Record<string, TriPt> = {};
  constructor(public readonly tx: number, public readonly ty: number) {
    // ty is vertical; tx is up-right
    const k = `${tx};${ty}`;
    if (k in TriPt.cache) {
      return TriPt.cache[k];
    }
    TriPt.cache[k] = this;
  }

  public pt(): P {
    const scale = 30;
    return pt(
      400 + scale * Math.cos(Math.PI / 6) * this.tx,
      400 - scale * this.ty - scale * Math.sin(Math.PI / 6) * this.tx,
    );
  }
  public shift(dx: number, dy: number): TriPt {
    return new TriPt(this.tx + dx, this.ty + dy);
  }
}

class Pt3 {
  private static cache: Record<string, Pt3> = {};
  constructor(
    public readonly cx: number,
    public readonly cy: number,
    public readonly cz: number,
  ) {
    // ty is vertical; tx is up-right
    const k = `${cx};${cy};${cz}`;
    if (k in Pt3.cache) {
      return Pt3.cache[k];
    }
    Pt3.cache[k] = this;
  }

  public tri(): TriPt {
    return new TriPt(this.cx + this.cz, this.cy - this.cz);
  }
  public depth(): number {
    return -this.cy - this.cz * 0.01 + this.cx * 0.01;
  }
  public shift(dx: number, dy: number, dz: number): Pt3 {
    return new Pt3(this.cx + dx, this.cy + dy, this.cz + dz);
  }
}

function tri(tx: number, ty: number): TriPt {
  return new TriPt(tx, ty);
}

function pt3(cx: number, cy: number, cz: number): Pt3 {
  return new Pt3(cx, cy, cz);
}

function fillUpRight(ctx: CanvasRenderingContext2D, c: TriPt, color: string) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(...c.pt().args());
  ctx.lineTo(...c.shift(0, 1).pt().args());
  ctx.lineTo(...c.shift(1, 0).pt().args());
  ctx.closePath();
  ctx.fill();
  // ctx.stroke();
}

function fillUpLeft(ctx: CanvasRenderingContext2D, c: TriPt, color: string) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(...c.pt().args());
  ctx.lineTo(...c.shift(-1, 1).pt().args());
  ctx.lineTo(...c.shift(0, 1).pt().args());
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

class Mesh<T> {
  right = new Map<TriPt, T>();
  left = new Map<TriPt, T>();

  fill(t: TriPt, side: "left" | "right", color: T): void {
    this[side].set(t, color);
  }
  get(t: TriPt, side: "left" | "right"): T | null {
    if (!this[side].has(t)) {
      return null;
    }
    return this[side].get(t)!;
  }
  update(t: TriPt, side: "left" | "right", change: (old: T | null) => T): void {
    this[side].set(t, change(this[side].has(t) ? this[side].get(t)! : null));
  }

  map<R>(func: (value: T) => R): Mesh<R> {
    const copy = new Mesh<R>();
    for (const [t, v] of this.left) {
      copy.left.set(t, func(v));
    }
    for (const [t, v] of this.right) {
      copy.right.set(t, func(v));
    }
    return copy;
  }
}

function drawMesh(ctx: CanvasRenderingContext2D, mesh: Mesh<string>) {
  for (const [t, color] of mesh.left) {
    fillUpLeft(ctx, t, color);
  }
  for (const [t, color] of mesh.right) {
    fillUpRight(ctx, t, color);
  }
}

function cubeFace<T>(
  mesh: Mesh<T>,
  c: TriPt,
  face: "up" | "left" | "right",
  change: (old: T | null) => T,
) {
  switch (face) {
    case "up":
      mesh.update(c, "right", change);
      mesh.update(c, "left", change);
      return;
    case "right":
      mesh.update(c.shift(1, -1), "left", change);
      mesh.update(c.shift(0, -1), "right", change);
      return;
    case "left":
      mesh.update(c.shift(0, -1), "left", change);
      mesh.update(c.shift(-1, 0), "right", change);
      return;
  }
}

function colorBase(r: number, g: number, b: number): string {
  r *= 255;
  g *= 255;
  b *= 255;

  r += Math.random() * 20 - 10;
  g += Math.random() * 20 - 10;
  b += Math.random() * 20 - 10;
  r = Math.floor(Math.max(0, Math.min(255, r)));
  g = Math.floor(Math.max(0, Math.min(255, g)));
  b = Math.floor(Math.max(0, Math.min(255, b)));
  return `rgb(${r}, ${g}, ${b})`;
}

function App() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null as any);
  React.useLayoutEffect(() => {
    function orange(v: number) {
      return colorBase(1 + v / 30, 0.7 + v / 30, v / 30);
    }
    function white(v: number) {
      return colorBase(0.9 + v / 60, 0.9 + v / 60, 0.95 + v / 120);
    }
    function brown(v: number) {
      return colorBase(0.6 + v / 30, 0.4 + v / 30, 0.3);
    }

    const depthMesh = new Mesh<{ color: string; depth: number }>();

    function drawCube(
      p: Pt3,
      colorUp: string,
      colorRight: string,
      colorLeft: string,
    ) {
      cubeFace(depthMesh, p.tri(), "up", old => {
        if (!old || old.depth > p.depth()) {
          return { depth: p.depth(), color: colorUp };
        }
        return old;
      });
      cubeFace(depthMesh, p.tri(), "right", old => {
        if (!old || old.depth > p.depth()) {
          return { depth: p.depth(), color: colorRight };
        }
        return old;
      });
      cubeFace(depthMesh, p.tri(), "left", old => {
        if (!old || old.depth > p.depth()) {
          return { depth: p.depth(), color: colorLeft };
        }
        return old;
      });
    }

    function randBetween(lo: number, hi: number): number {
      const range = hi - lo + 1;
      return Math.floor(Math.random() * range) + lo;
    }

    const cubes = new Set<Pt3>();

    for (let x = -5; x <= 5; x++) {
      for (let z = -5; z <= 5; z++) {
        for (let y = -5; y <= 0; y++) {
          cubes.add(pt3(x, y, z));
        }
      }
    }
    for (let i = 0; i < 3; i++) {
      const cx = randBetween(-5, 5);
      const cz = randBetween(-5, 5);
      const d = randBetween(1, 4);
      const r = randBetween(1, 2);
      for (let x = cx - r; x <= cx + r; x++) {
        for (let z = cz - r; z <= cz + r; z++) {
          for (let y = -d; y <= 0; y++) {
            cubes.delete(pt3(x, y, z));
          }
        }
      }
    }
    for (let i = 0; i < 6; i++) {
      const x = randBetween(-5, 5);
      const z = randBetween(-5, 5);
      if (!cubes.has(pt3(x, 0, z))) {
        continue;
      }
      const r = randBetween(1, 8);
      for (let y = 1; y <= r; y++) {
        cubes.add(pt3(x, y, z));
      }
    }

    function brightnessShadow(p: Pt3) {
      for (let t = 0; t < 10; t += 0.25) {
        const q = pt3(
          Math.round(p.cx + t),
          Math.round(p.cy + t),
          Math.round(p.cz + t * 0.1),
        );
        if (cubes.has(q)) {
          return -10 + t;
        }
      }
      return 0;
    }

    function brightnessAt(p: Pt3) {
      return brightnessShadow(p) + p.cy / 2;
    }

    cubes.forEach(cube => {
      drawCube(
        cube,
        orange(brightnessAt(cube.shift(0, 1, 0))),
        white(brightnessAt(cube.shift(0, 0, 1))),
        brown(0),
      );
    });

    const ctx = canvasRef.current.getContext("2d")!;
    const mesh = depthMesh.map(({ color }) => color);
    drawMesh(ctx, mesh);
  }, []);
  return (
    <canvas
      ref={canvasRef}
      style={{ width: 800, height: 800 }}
      width={800}
      height={800}
    ></canvas>
  );
}

export default App;
