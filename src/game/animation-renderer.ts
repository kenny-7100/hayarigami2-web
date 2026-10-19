import { animationScale } from "./animation";
import type { AnimationData, AnimationDraw } from "./animation";
import { decodedImage } from "./media";

// Textured triangle strips preserve four vertex colors and subtractive light.
export async function createAnimationRenderer(canvas: HTMLCanvasElement, data: AnimationData, id = 0) {
  const [scaleX, scaleY] = animationScale(id);
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
  if (!gl) throw new Error("Animation renderer: WebGL unavailable");
  const program = gl.createProgram()!;
  const shaders: WebGLShader[] = [];
  const textures = new Map<string, WebGLTexture>();
  const buffer = gl.createBuffer();
  function dispose() {
    for (const texture of textures.values()) gl!.deleteTexture(texture);
    for (const shader of shaders) gl!.deleteShader(shader);
    gl!.deleteBuffer(buffer);
    gl!.deleteProgram(program);
  }
  try {
    for (const [type, source] of [
      [gl.VERTEX_SHADER, `
        attribute vec2 position;
        attribute vec2 uv;
        attribute vec4 color;
        varying vec2 texcoord;
        varying vec4 tint;
        void main() {
          gl_Position = vec4(position.x / 240.0 - 1.0, 1.0 - position.y / 136.0, 0.0, 1.0);
          texcoord = uv;
          tint = color;
        }`],
      // 08863194 enables GU_FRAGMENT_2X (state 21): RGB doubles, alpha does not.
      [gl.FRAGMENT_SHADER, `
        precision mediump float;
        uniform sampler2D atlas;
        varying vec2 texcoord;
        varying vec4 tint;
        void main() {
          vec4 pixel = texture2D(atlas, texcoord) * tint;
          gl_FragColor = vec4(min(pixel.rgb * 2.0, vec3(1.0)), pixel.a);
        }`],
    ] as const) {
      const shader = gl.createShader(type)!;
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "Animation shader failed");
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "Animation program failed");
    // Present only complete scenes, after every atlas has decoded.
    const images = await Promise.all(Object.entries(data.textures).map(async ([key, texture]) => {
      const img = await decodedImage(texture.file);
      return { key, img };
    }));
    for (const { key, img } of images) {
      const texture = gl.createTexture()!;
      textures.set(key, texture);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    }
    const attributes = [["position", 2, 0], ["uv", 2, 8], ["color", 4, 16]].map(
      ([name, size, offset]) => ({ location: gl.getAttribLocation(program, String(name)), size: Number(size), offset: Number(offset) }));
    gl.enable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    return {
      dispose,
      draw(draws: AnimationDraw[], position: [number, number] = [0, 0]) {
        // An obsolete async load in React StrictMode may have used this context.
        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        for (const { location, size, offset } of attributes) {
          gl.enableVertexAttribArray(location);
          gl.vertexAttribPointer(location, size, gl.FLOAT, false, 32, offset);
        }
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT);
        for (const d of draws) {
          const matrix = new DOMMatrix();
          for (const match of d.transform.matchAll(/(translate|rotate|scale)\(([^)]+)\)/g)) {
            const values = match[2].split(/\s+/).map(Number);
            if (match[1] === "translate") matrix.translateSelf(values[0], values[1]);
            if (match[1] === "rotate") matrix.rotateSelf(values[0]);
            if (match[1] === "scale") matrix.scaleSelf(values[0], values[1]);
          }
          const vertices: number[] = [];
          // Native vertices TL, TR, BL, BR; stored colors TL, TR, BR, BL.
          for (const [x, y, colorIndex] of [[0, 0, 0], [1, 0, 1], [0, 1, 3], [1, 1, 2]]) {
            const p = matrix.transformPoint({
              x: d.x + (d.cell.flipX ? 1 - x : x) * d.cell.width,
              y: d.y + (d.cell.flipY ? 1 - y : y) * d.cell.height,
            });
            vertices.push(
              Math.trunc(Math.trunc(p.x) * scaleX) + position[0], Math.trunc(Math.trunc(p.y) * scaleY) + position[1],
              (d.cell.u + 1.5 + x * (d.cell.width - 3)) / d.texture.width,
              (d.cell.v + 1.5 + y * (d.cell.height - 3)) / d.texture.height,
              ...d.colors.slice(colorIndex * 4, colorIndex * 4 + 4).map(n => n / 255),
            );
          }
          const blend = d.cell.blend >>> 8;
          if (![0, 2, 3].includes(blend)) throw new Error(`Unsupported animation blend ${blend}`);
          // 08811bac: mode 2 adds src * alpha; mode 3 subtracts it.
          gl.blendEquationSeparate(blend === 3 ? gl.FUNC_REVERSE_SUBTRACT : gl.FUNC_ADD, gl.FUNC_ADD);
          gl.blendFuncSeparate(gl.SRC_ALPHA, blend ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
          gl.bindTexture(gl.TEXTURE_2D, textures.get(d.cell.texture)!);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
      },
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
