// Phần cần three của lớp hiệu ứng (nạp bằng import() động trong index.ts): ba lớp tấm instancing (đất, thân, không),
// mỗi lớp một lần vẽ, dùng renderer chung của proto/src/three (không mở WebGL context riêng).
import {
  BufferAttribute,
  CanvasTexture,
  DoubleSide,
  DynamicDrawUsage,
  InstancedBufferGeometry,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  LinearFilter,
  Mesh,
  OneFactor,
  OneMinusSrcAlphaFactor,
  OrthographicCamera,
  Scene,
  ShaderMaterial,
  CustomBlending,
  AddEquation,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from "three";
import type { Program } from "../three/index.ts";
import { drawAtlas } from "./atlas.ts";
import { Emitter, LAYERS, STRIDE } from "./emit.ts";
import { FRAG, VERT } from "./shader.ts";
import type { FxCamera } from "./types.ts";

export { emitFrame } from "./canh.ts";

export interface FxProgram extends Program {
  /** Bộ đệm để ghi hình của khung tới (màn ghi trước khi gọi LiveMount.render). */
  readonly emitter: Emitter;
  /** Camera của màn Trận ở khung tới. */
  setCamera(c: FxCamera): void;
}

export function createFxProgram(cap = 6144): FxProgram {
  const emitter = new Emitter(cap);
  const scene = new Scene();
  const camera = new OrthographicCamera(); // shader tự chiếu theo uCam/uView; camera chỉ để renderer.render có đối số
  const atlas = new CanvasTexture(drawAtlas());
  atlas.flipY = false;
  atlas.minFilter = LinearFilter;
  atlas.magFilter = LinearFilter;
  atlas.generateMipmaps = false;

  const uniforms = {
    uCam: { value: [0, 0, 1, 0] as number[] },
    uView: { value: [1, 1, 0.5, 0.5] as number[] },
    uAtlas: { value: atlas },
    uPx: { value: 1 },
  };
  const material = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: DoubleSide,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
    blendEquationAlpha: AddEquation,
    blendSrcAlpha: OneFactor,
    blendDstAlpha: OneMinusSrcAlphaFactor,
    premultipliedAlpha: true,
  });

  const quad = new BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3);
  const index = new BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1);
  const layers = Array.from({ length: LAYERS }, (_, i) => {
    const buf = new InstancedInterleavedBuffer(emitter.data[i], STRIDE, 1);
    buf.setUsage(DynamicDrawUsage);
    const geo = new InstancedBufferGeometry();
    geo.setIndex(index);
    geo.setAttribute("position", quad);
    for (let k = 0; k < 5; k++) geo.setAttribute("a" + k, new InterleavedBufferAttribute(buf, 4, k * 4));
    geo.instanceCount = 0;
    const mesh = new Mesh(geo, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = i;
    scene.add(mesh);
    return { buf, geo, mesh };
  });

  let cam: FxCamera | null = null;
  let drewSomething = true;

  return {
    emitter,
    animated: true,
    setCamera(c) {
      cam = c;
    },
    resize() {
      // Cỡ lấy từ camera của màn mỗi khung; renderer đã được host đặt cỡ.
    },
    render(renderer: WebGLRenderer, target: WebGLRenderTarget | null) {
      renderer.setRenderTarget(target);
      const total = emitter.total;
      // Không có gì để vẽ và khung trước cũng trống: giữ nguyên canvas, khỏi tốn GPU.
      if (!total && !drewSomething) return;
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, false, false);
      drewSomething = total > 0;
      if (!total || !cam) return;
      const zoom = cam.zoom;
      uniforms.uCam.value = [cam.x - cam.shakeX / zoom, cam.y - cam.shakeY / zoom, zoom, 0];
      uniforms.uView.value = [cam.w, cam.h, cam.w / 2, (cam.h - cam.bottom) / 2];
      uniforms.uPx.value = 1 / zoom;
      for (let i = 0; i < LAYERS; i++) {
        const l = layers[i];
        const n = emitter.count[i];
        l.geo.instanceCount = n;
        l.mesh.visible = n > 0;
        if (n > 0) {
          l.buf.clearUpdateRanges();
          l.buf.addUpdateRange(0, n * STRIDE);
          l.buf.needsUpdate = true;
        }
      }
      renderer.render(scene, camera);
    },
    dispose() {
      for (const l of layers) l.geo.dispose();
      material.dispose();
      atlas.dispose();
    },
  };
}
