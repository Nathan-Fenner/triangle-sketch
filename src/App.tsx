import React from "react";
import "./App.css";

type RGB = readonly [number, number, number];

function interpolateRGB(palette: RGB[], t: number): RGB {
  if (palette.length === 0) {
    throw new Error("cannot interpolateRGB([]) on empty palette");
  }
  t *= palette.length;
  if (t <= 0) {
    return palette[0];
  }
  if (t >= palette.length - 1) {
    return palette[palette.length - 1];
  }
  const index = Math.floor(t);

  const amount = t - index;
  return [
    palette[index][0] * (1 - amount) + palette[index + 1][0] * amount,
    palette[index][1] * (1 - amount) + palette[index + 1][1] * amount,
    palette[index][2] * (1 - amount) + palette[index + 1][2] * amount,
  ];
}

function randChoose<T>(options: Iterable<T>): T {
  const list = [...options];
  return list[Math.floor(Math.random() * list.length)];
}

function randBetween(lo: number, hi: number): number {
  const range = hi - lo + 1;
  return Math.floor(Math.random() * range) + lo;
}

/**
 * P is a 2D point with readonly x and y fields.
 * By convention, positive x is to the right, and positive y is down.
 */
class P {
  constructor(public readonly x: number, public readonly y: number) {}

  public args(): [number, number] {
    return [this.x, this.y];
  }

  public shift(dx: number, dy: number): P {
    return new P(this.x + dx, this.y + dy);
  }
}

/**
 * `pt` is a helper for creating `P` objects. It just invokes `P`'s constructor.
 * @param x
 * @param y
 */
function pt(x: number, y: number): P {
  return new P(x, y);
}

/**
 * A `TriPt` is a corner in the triangle-grid.
 * It's described with two coordinates, `tx` and `ty`.
 * By convention, `ty` is up and `tx` is up-right.
 *
 * `TriPt` values can be correctly compared with `===` for equality.
 * To accomplish this, all `TriPt` objects are stored in a global private cache.
 *
 * The `pt()` method converts the `TriPt` to the corresponding `P`.
 */
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
    const scale = 25;
    return pt(
      400 + scale * Math.cos(Math.PI / 6) * this.tx,
      400 - scale * this.ty - scale * Math.sin(Math.PI / 6) * this.tx,
    );
  }
  public shift(dx: number, dy: number): TriPt {
    return new TriPt(this.tx + dx, this.ty + dy);
  }
}

/**
 * A `Pt3` is an (integer) point in 3D space.
 * Points can be correctly compared with `===`.
 *
 * `tri()` projects the `Pt3` into the corresponding `TriPt` (at its center).
 * `depth()` returns a sortable "depth" value for the cube (valid at the point only).
 */
class Pt3 {
  private static cache: Record<string, Pt3> = {};
  constructor(
    public readonly cx: number,
    public readonly cy: number,
    public readonly cz: number,
  ) {
    const k = `${cx};${cy};${cz}`;
    if (k in Pt3.cache) {
      return Pt3.cache[k];
    }
    Pt3.cache[k] = this;
  }

  public tri(): TriPt {
    return new TriPt(this.cx + this.cz, this.cy - this.cz);
  }
  /**
   * Returns the "depth" of the point in the screen (if it were to be projected).
   * I was lazy on the math, so it's only valid near the origin and for cubes
   * that project to the same point; use with caution.
   */
  public depth(): number {
    return -this.cy - this.cz * 1.01 + this.cx * 1.01;
  }
  public shift(dx: number, dy: number, dz: number): Pt3 {
    return new Pt3(this.cx + dx, this.cy + dy, this.cz + dz);
  }
}

/**
 * `pt3(...)` is an abbreviation for `new Pt3(...)`.
 */
function pt3(cx: number, cy: number, cz: number): Pt3 {
  return new Pt3(cx, cy, cz);
}

/**
 * `rgb` converts an RGB triplet into a usable string.
 * The inputs should be in the range [0, 1]; values outside this range will be clamped.
 */
function rgb(r: number, g: number, b: number): string {
  const clamp = (x: number) => Math.floor(Math.max(0, Math.min(255, x * 256)));
  return `rgb(${clamp(r)}, ${clamp(g)}, ${clamp(b)})`;
}

/**
 * `fillUpRight(ctx, c, color)` fills a right-facing triangle whose lower-left
 * corner is located at `c` (specifically, the point that `c` projects to).
 */
function fillUpRight(
  ctx: CanvasRenderingContext2D,
  c: TriPt,
  color: readonly [number, number, number],
) {
  ctx.fillStyle = rgb(...color);
  ctx.beginPath();
  ctx.moveTo(...c.pt().args());
  ctx.lineTo(...c.shift(0, 1).pt().args());
  ctx.lineTo(...c.shift(1, 0).pt().args());
  ctx.closePath();
  ctx.fill();
}

function triangleCorner1(t: TriPt, side: "left" | "right"): P {
  if (side === "left") {
    return t.shift(-1, 1).pt();
  } else {
    return t.shift(0, 1).pt();
  }
}
function triangleCorner2(t: TriPt, side: "left" | "right"): P {
  if (side === "left") {
    return t.shift(0, 1).pt();
  } else {
    return t.shift(1, 0).pt();
  }
}

function triangleCenter(t: TriPt, side: "left" | "right"): P {
  if (side === "left") {
    const c1 = t.pt();
    const c2 = t.shift(-1, 1).pt();
    const c3 = t.shift(0, 1).pt();
    return pt((c1.x + c2.x + c3.x) / 3, (c1.y + c2.y + c3.y) / 3);
  } else {
    const c1 = t.pt();
    const c2 = t.shift(0, 1).pt();
    const c3 = t.shift(1, 0).pt();
    return pt((c1.x + c2.x + c3.x) / 3, (c1.y + c2.y + c3.y) / 3);
  }
}

/**
 * `fillUpLeft(ctx, c, color)` fills a left-facing triangle whose lower-right
 * corner is located at `c` (specifically, the point that `c` projects to).
 */
function fillUpLeft(
  ctx: CanvasRenderingContext2D,
  c: TriPt,
  color: readonly [number, number, number],
) {
  ctx.fillStyle = rgb(...color);
  ctx.beginPath();
  ctx.moveTo(...c.pt().args());
  ctx.lineTo(...c.shift(-1, 1).pt().args());
  ctx.lineTo(...c.shift(0, 1).pt().args());
  ctx.closePath();
  ctx.fill();
}

/**
 * A `Mesh` is a mapping from triangles to any value.
 * Each triangle is either left- or right-facing and identified by its
 * bottom corner.
 */
class Mesh<T> {
  right = new Map<TriPt, T>();
  left = new Map<TriPt, T>();

  /**
   * `set` replaces the value stored at the given triangle.
   */
  set(t: TriPt, side: "left" | "right", color: T): void {
    this[side].set(t, color);
  }
  /**
   * `get` returns the value stored at the given triangle, or `null`
   * if no value has been stored there yet.
   */
  get(t: TriPt, side: "left" | "right"): T | null {
    if (!this[side].has(t)) {
      return null;
    }
    return this[side].get(t)!;
  }
  /**
   * `update` combines `get` and `set` by transforming the point by the
   * provided `change` function.
   * The function receives `null` if the triangle has not been given a
   * value yet.
   */
  update(t: TriPt, side: "left" | "right", change: (old: T | null) => T): void {
    this[side].set(t, change(this[side].has(t) ? this[side].get(t)! : null));
  }

  /**
   * `map` copies the `Mesh`, transforming the value stored in each triangle.
   */
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

/**
 * `drawMesh` assumes the provided `mesh` contains colors.
 */
function drawMesh(
  ctx: CanvasRenderingContext2D,
  mesh: Mesh<{ depth: number; color: RGB; style: "grass" | "stone" }>,
) {
  const triangles = [
    ...[...mesh.left].map(([t, item]) => ({
      ...item,
      t,
      effect: false,
      side: "left" as const,
    })),
    ...[...mesh.left].map(([t, item]) => ({
      ...item,
      t,
      effect: true,
      depth: item.depth - 0.5,
      side: "left" as const,
    })),
    ...[...mesh.right].map(([t, item]) => ({
      ...item,
      effect: false,
      t,
      side: "right" as const,
    })),
    ...[...mesh.right].map(([t, item]) => ({
      ...item,
      effect: true,
      depth: item.depth - 0.5,
      t,
      side: "right" as const,
    })),
  ];
  triangles.sort((a, b) => {
    // return Math.random() - 0.5;
    return b.depth - a.depth;
  });

  triangles.forEach(item => {
    if (!item.effect) {
      if (item.side === "left") {
        fillUpLeft(ctx, item.t, item.color);
      } else {
        fillUpRight(ctx, item.t, item.color);
      }
    }
    if (item.effect && item.style === "grass") {
      const c1 = triangleCorner1(item.t, item.side);
      const c2 = triangleCorner2(item.t, item.side);
      const c3 = item.t.pt();

      const onEdge1 = (r: number) => {
        return pt(c1.x * r + c2.x * (1 - r), c1.y * r + c2.y * (1 - r));
      };
      const onEdge2 = (r: number) => {
        if (item.side === "right") {
          return pt(c2.x * r + c3.x * (1 - r), c2.y * r + c3.y * (1 - r));
        } else {
          return pt(c3.x * r + c1.x * (1 - r), c3.y * r + c1.y * (1 - r));
        }
      };

      ctx.fillStyle = rgb(...item.color);
      for (let i = 0; i < 12; i++) {
        const onEdge = i % 2 === 0 ? onEdge1 : onEdge2;
        const r = Math.random() * 0.8 + 0.1;
        const edge1 = onEdge(r - 0.1);
        const edge2 = onEdge(r + 0.1);
        const edgeMid = onEdge(r);
        const out = pt(-(edge2.y - edge1.y), edge2.x - edge1.x);
        const edgeOut = pt(edgeMid.x + out.x * 0.5, edgeMid.y + out.y * 0.5);
        ctx.beginPath();
        ctx.moveTo(...edge1.shift(-out.x * 0.2, -out.y * 0.2).args());
        ctx.lineTo(...edge2.shift(-out.x * 0.2, -out.y * 0.2).args());
        ctx.lineTo(...edgeOut.args());
        ctx.closePath();
        ctx.fill();
      }
    }
  });
}

/**
 * `cubeFace` stores values for both triangles in one face of a unit cube.
 * @param mesh
 */
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

/**
 * `perturbColor` returns the input color with some random variation.
 */
function perturbColor(color: RGB, strength: number): RGB {
  return [
    color[0] + (Math.random() * 2 - 1) * strength,
    color[1] + (Math.random() * 2 - 1) * strength,
    color[2] + (Math.random() * 2 - 1) * strength,
  ];
}

/**
 * `surfaceColor` describes the colors for all 3 visible sides of each cube.
 * Each receives as a parameter a "lightness" score.
 */
const surfaceColors = {
  desert_stone: {
    top: (v: number) =>
      interpolateRGB(
        [
          [176 / 255, 112 / 255, 0],
          [243 / 255, 166 / 255, 0],
          [254 / 255, 175 / 255, 0],
          [251 / 255, 225 / 255, 38 / 255],
        ],
        v,
      ),
    right: (v: number) =>
      interpolateRGB(
        [
          [0.55, 0.55, 0.6],
          [0.7, 0.7, 0.8],
          [0.8, 0.8, 0.85],
        ],
        v,
      ),
    left: (v: number) =>
      interpolateRGB(
        [
          [0.4, 0.3, 0.3],
          [0.5, 0.45, 0.3],
        ],
        v,
      ),
  },
  blossoms: {
    top: (v: number) =>
      interpolateRGB(
        [
          [100 / 255, 30 / 255 / 3, 76 / 255],
          [183 / 255, 55 / 255, 146 / 255],
          [190 / 255, 150 / 255, 220 / 255],
        ],
        v,
      ),
    right: (v: number) =>
      interpolateRGB(
        [
          [0.55, 0.55, 0.6],
          [0.7, 0.7, 0.8],
          [0.8, 0.8, 0.85],
        ],
        v,
      ),
    left: (v: number) =>
      interpolateRGB(
        [
          [0.6, 0.5, 0.65],
          [0.9, 0.7, 0.85],
          [0.95, 0.8, 0.9],
        ],
        v,
      ),
  },
};

type Triplet<T> = {
  top: T;
  right: T;
  left: T;
};

/**
 * `cubeDepth` stamps a cube onto the `Mesh` and stores depth information.
 * The cube will not be stamped in front of nearer values.
 * @param mesh
 * @param p
 * @param surface
 */
function cubeDepth<Style>(
  mesh: Mesh<{ depth: number; color: RGB; style: Style }>,
  p: Pt3,
  surface: Triplet<{ color: RGB; style: Style }>,
): void {
  cubeFace(mesh, p.tri(), "up", old => {
    if (!old || old.depth > p.depth()) {
      return { depth: p.depth(), ...surface.top };
    }
    return old;
  });
  cubeFace(mesh, p.tri(), "right", old => {
    if (!old || old.depth > p.depth()) {
      return { depth: p.depth(), ...surface.right };
    }
    return old;
  });
  cubeFace(mesh, p.tri(), "left", old => {
    if (!old || old.depth > p.depth()) {
      return { depth: p.depth(), ...surface.left };
    }
    return old;
  });
}

/**
 * `castRay` checks whether a sun-ray (starting from the center of a cube) intersects with any cube in a set.
 * @param from
 */
function castSunRay(
  cubes: Set<Pt3>,
  from: Pt3,
  maxDistance = 20,
  stepSize = 0.25,
): boolean {
  for (let t = 0; t < maxDistance; t += stepSize) {
    const q = pt3(
      Math.round(from.cx + t),
      Math.round(from.cy + t * 0.95),
      Math.round(from.cz),
    );
    if (cubes.has(q)) {
      return true;
    }
  }
  return false;
}

const scenes = {
  canyon_city: () => {
    const cubes = new Set<Pt3>();

    for (let x = -30; x <= 30; x++) {
      for (let z = -30; z <= 30; z++) {
        cubes.add(pt3(x, 0, z));
      }
    }
    for (let i = 0; i < 100; i++) {
      const cx = randBetween(-30, 30);
      const cz = randBetween(-30, 30);
      const size = randChoose([1, 1, 1, 1, 1, 3]);
      for (let x = cx - size; x <= cx + size; x++) {
        for (let z = cz - size; z <= cz + size; z++) {
          for (let y = 1; y <= 2 * size + 1; y++) {
            if ((x === cx || z === cz) && y < size + 1) {
              continue;
            }
            cubes.add(pt3(x, y, z));
          }
        }
      }
    }

    for (let x = -4; x <= 4; x += 8) {
      for (let z = -40; z <= 40; z++) {
        for (let y = -20; y <= 0; y++) {
          cubes.add(pt3(x, y, z));
        }
      }
    }

    for (let x = -3; x <= 3; x++) {
      for (let z = -40; z <= 40; z++) {
        for (let y = -20; y <= 20; y++) {
          cubes.delete(pt3(x, y, z));
        }
      }
    }

    return cubes;
  },

  island: () => {
    const cubes = new Set<Pt3>();
    for (let x = -40; x <= 40; x++) {
      for (let z = -40; z <= 40; z++) {
        cubes.add(pt3(x, -4, z));
      }
    }
    for (let x = -6; x <= 6; x++) {
      for (let z = -6; z <= 6; z++) {
        for (let y = -6; y <= 0; y++) {
          cubes.add(pt3(x, y, z));
        }
      }
    }
    for (let i = 0; i < 20; i++) {
      const x = randBetween(-6, 6);
      const z = randBetween(-6, 6);
      const r = randBetween(1, 6);
      for (let y = 1; y <= r; y++) {
        cubes.add(pt3(x, y, z));
      }
    }
    return cubes;
  },
};

type Gradient = (v: number) => RGB;

function drawScene(
  ctx: CanvasRenderingContext2D,
  cubes: Set<Pt3>,
  surface: { top: Gradient; right: Gradient; left: Gradient },
) {
  const depthMesh = new Mesh<{
    color: readonly [number, number, number];
    depth: number;
    style: "grass" | "stone";
  }>();

  cubes.forEach(cube => {
    cubeDepth(depthMesh, cube, {
      top: {
        style: "grass",
        color: perturbColor(
          surface.top(
            (castSunRay(cubes, cube.shift(0, 1, 0)) ? 0 : 0.3) +
              cube.cy / 20 +
              0.08,
          ),
          0.05,
        ),
      },
      right: {
        style: "stone",
        color: surface.right(
          (castSunRay(cubes, cube.shift(0, 0, 1)) ? 0 : 0.3) +
            cube.cz / 20 +
            0.25,
        ),
      },
      left: {
        style: "stone",
        color: surface.left(cube.cx / 30),
      },
    });
  });

  drawMesh(ctx, depthMesh);
}

function App() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null as any);

  const [cubes, setCubes] = React.useState(() => scenes.canyon_city());
  const [surface, setSurface] = React.useState(surfaceColors.desert_stone);

  React.useLayoutEffect(() => {
    const ctx = canvasRef.current.getContext("2d")!;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    ctx.save();
    ctx.scale(2, 2);
    drawScene(ctx, cubes, surface);
    ctx.restore();
    const data = ctx.getImageData(
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height,
    );
    for (let i = 0; i < data.height * data.height; i++) {
      data.data[4 * i + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
  }, [surface, cubes]);
  return (
    <div className="app">
      <canvas ref={canvasRef} width={1600} height={1600} />
      <div style={{ padding: 24, minWidth: 300 }}>
        <div>
          {Object.keys(scenes).map(name => (
            <button
              onClick={() => setCubes(scenes[name as keyof typeof scenes])}
            >
              {name}
            </button>
          ))}
        </div>
        <div>
          {Object.keys(surfaceColors).map(name => (
            <button
              onClick={() =>
                setSurface(surfaceColors[name as keyof typeof surfaceColors])
              }
            >
              {name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
