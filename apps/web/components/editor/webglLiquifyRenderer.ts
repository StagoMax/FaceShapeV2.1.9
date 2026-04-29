'use client';

type LiquifyMesh = {
  cols: number;
  rows: number;
  deformX: Float32Array;
  deformY: Float32Array;
  indices: Uint16Array;
};

const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
attribute vec2 a_uv;
attribute vec2 a_baseUv;
uniform float u_showOriginal;
varying vec2 v_uv;

void main() {
  v_uv = mix(a_uv, a_baseUv, u_showOriginal);
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SOURCE = `
precision highp float;

uniform sampler2D u_source;
varying vec2 v_uv;

void main() {
  gl_FragColor = texture2D(u_source, clamp(v_uv, 0.0, 1.0));
}
`;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('Failed to create shader');
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? 'Unknown shader compile error';
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
};

const createProgram = (gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string) => {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    throw new Error('Failed to create WebGL program');
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? 'Unknown program link error';
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
};

const createTexture = (gl: WebGLRenderingContext) => {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error('Failed to create WebGL texture');
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return texture;
};

export class WebGLLiquifyRenderer {
  private canvas: HTMLCanvasElement;

  private gl: WebGLRenderingContext;

  private program: WebGLProgram;

  private sourceTexture: WebGLTexture;

  private positionBuffer: WebGLBuffer;

  private uvBuffer: WebGLBuffer;

  private baseUvBuffer: WebGLBuffer;

  private indexBuffer: WebGLBuffer;

  private positionLocation: number;

  private uvLocation: number;

  private baseUvLocation: number;

  private sourceUniform: WebGLUniformLocation | null;

  private showOriginalUniform: WebGLUniformLocation | null;

  private width = 0;

  private height = 0;

  private meshCols = 0;

  private meshRows = 0;

  private indexCount = 0;

  private baseUvs: Float32Array | null = null;

  constructor() {
    this.canvas = document.createElement('canvas');
    const gl = this.canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
      premultipliedAlpha: false,
    });
    if (!gl) {
      throw new Error('WebGL is not available');
    }
    this.gl = gl;
    this.program = createProgram(gl, VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE);
    this.sourceTexture = createTexture(gl);

    const positionBuffer = gl.createBuffer();
    const uvBuffer = gl.createBuffer();
    const baseUvBuffer = gl.createBuffer();
    const indexBuffer = gl.createBuffer();
    if (!positionBuffer || !uvBuffer || !baseUvBuffer || !indexBuffer) {
      gl.deleteTexture(this.sourceTexture);
      gl.deleteProgram(this.program);
      throw new Error('Failed to create WebGL mesh buffers');
    }
    this.positionBuffer = positionBuffer;
    this.uvBuffer = uvBuffer;
    this.baseUvBuffer = baseUvBuffer;
    this.indexBuffer = indexBuffer;

    this.positionLocation = gl.getAttribLocation(this.program, 'a_position');
    this.uvLocation = gl.getAttribLocation(this.program, 'a_uv');
    this.baseUvLocation = gl.getAttribLocation(this.program, 'a_baseUv');
    this.sourceUniform = gl.getUniformLocation(this.program, 'u_source');
    this.showOriginalUniform = gl.getUniformLocation(this.program, 'u_showOriginal');
  }

  getCanvas() {
    return this.canvas;
  }

  setSource(imageData: ImageData) {
    if (this.width !== imageData.width || this.height !== imageData.height) {
      this.width = imageData.width;
      this.height = imageData.height;
      this.canvas.width = imageData.width;
      this.canvas.height = imageData.height;
    }

    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      imageData
    );
  }

  private ensureMeshGeometry(mesh: LiquifyMesh) {
    if (mesh.cols === this.meshCols && mesh.rows === this.meshRows && this.baseUvs) {
      return;
    }

    const vertexCount = mesh.cols * mesh.rows;
    const positions = new Float32Array(vertexCount * 2);
    const baseUvs = new Float32Array(vertexCount * 2);

    for (let y = 0; y < mesh.rows; y += 1) {
      const v = mesh.rows === 1 ? 0 : y / (mesh.rows - 1);
      for (let x = 0; x < mesh.cols; x += 1) {
        const u = mesh.cols === 1 ? 0 : x / (mesh.cols - 1);
        const idx = (y * mesh.cols + x) * 2;
        positions[idx] = u * 2 - 1;
        positions[idx + 1] = 1 - v * 2;
        baseUvs[idx] = u;
        baseUvs[idx + 1] = v;
      }
    }

    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.baseUvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, baseUvs, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

    this.meshCols = mesh.cols;
    this.meshRows = mesh.rows;
    this.indexCount = mesh.indices.length;
    this.baseUvs = baseUvs;
  }

  render(mesh: LiquifyMesh, _maxMagnitude: number, showOriginal = false) {
    if (!this.width || !this.height) {
      return false;
    }

    this.ensureMeshGeometry(mesh);
    if (!this.baseUvs) {
      return false;
    }

    const uvs = new Float32Array(this.baseUvs.length);
    for (let i = 0; i < mesh.cols * mesh.rows; i += 1) {
      const idx = i * 2;
      uvs[idx] = clamp(this.baseUvs[idx] + mesh.deformX[i], 0, 1);
      uvs[idx + 1] = clamp(this.baseUvs[idx + 1] + mesh.deformY[i], 0, 1);
    }

    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.positionLocation);
    gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.uvLocation);
    gl.vertexAttribPointer(this.uvLocation, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.baseUvBuffer);
    gl.enableVertexAttribArray(this.baseUvLocation);
    gl.vertexAttribPointer(this.baseUvLocation, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    gl.uniform1i(this.sourceUniform, 0);
    gl.uniform1f(this.showOriginalUniform, showOriginal ? 1 : 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);

    gl.disableVertexAttribArray(this.positionLocation);
    gl.disableVertexAttribArray(this.uvLocation);
    gl.disableVertexAttribArray(this.baseUvLocation);
    return true;
  }

  destroy() {
    const gl = this.gl;
    gl.deleteTexture(this.sourceTexture);
    gl.deleteBuffer(this.positionBuffer);
    gl.deleteBuffer(this.uvBuffer);
    gl.deleteBuffer(this.baseUvBuffer);
    gl.deleteBuffer(this.indexBuffer);
    gl.deleteProgram(this.program);
  }
}
