/**
 * Landing Page Overlay Animation
 */


class WarpShader {
  constructor(imgSrc, logoSrc) {
    this.imgSrc = imgSrc;
    this.logoSrc = logoSrc;

    // Follow the mouse settings
    this.followSpeed = 0.005;
    this.focusX = Math.random() * window.innerWidth;
    this.focusY = Math.random() * window.innerHeight;
    this.targetX = this.focusX;
    this.targetY = this.focusY;

    this.disableScroll();
    this.initRenderer();
    this.initScene();
    this.initEvents();
    this.loadTexture();
    this.addLogo();
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.domElement.style.position = "fixed";
    this.renderer.domElement.style.top = "0";
    this.renderer.domElement.style.left = "0";
    this.renderer.domElement.style.zIndex = "9999";
    document.body.appendChild(this.renderer.domElement);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.scene = new THREE.Scene();
  }

  initScene() {
    this.uniforms = {
      uTexture: { value: null },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uTexAspect: { value: 1.0 }, // width / height of the source image
      uTime: { value: 0.0 },
      uFocus: { value: new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2) },
      uWarpStrength: { value: 15.0 },
      uAlpha: { value: 1.0 },
      uExitProgress: { value: 0.0 },
      uIsExiting: { value: 0 },
    };

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      vertexShader: `
        void main() {
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision mediump float;

        uniform sampler2D uTexture;
        uniform vec2 uResolution;
        uniform float uTexAspect;
        uniform vec2 uFocus;
        uniform float uTime;
        uniform float uWarpStrength;
        uniform float uAlpha;
        uniform float uExitProgress;
        uniform int uIsExiting;

        void main() {
          vec2 pos = gl_FragCoord.xy;
          vec2 toFocus = pos - uFocus;
          float dist = length(toFocus);
          
          vec2 uv;
          
          // Warp or exit offsets
          if (uIsExiting == 0) {
              float warp = sin(dist * 0.02 - uTime) * uWarpStrength;
              uv = pos + normalize(toFocus) * warp;
          } else {
              uv = pos + normalize(toFocus) * uExitProgress;
          }
          
          float screenAspect = uResolution.x / uResolution.y;
          float texAspect = uTexAspect;
          
          if (screenAspect >= texAspect) {
              // width covers, crop bottom
              float imgHeight = uResolution.x / texAspect;
              uv.x = uv.x / uResolution.x;
              uv.y = uv.y / imgHeight;
          } else {
              // height covers, crop sides
              float imgWidth = uResolution.y * texAspect;
              uv.x = uv.x / imgWidth;
              uv.y = uv.y / uResolution.y;
          }
          
          // Clamp to [0,1]
          uv = clamp(uv, 0.0, 1.0);
          
          vec4 color = texture2D(uTexture, uv);
          gl_FragColor = vec4(color.rgb, color.a * uAlpha);
        }
      `
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.mesh);
  }

  initEvents() {
    document.addEventListener("mousemove", (e) => {
      this.targetX = e.clientX;
      this.targetY = e.clientY;
    });

    document.addEventListener("click", () => this.startExit());

    window.addEventListener("resize", () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    });
  }

  loadTexture() {
    const loader = new THREE.TextureLoader();
    loader.load(this.imgSrc, (tex) => {
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      // set aspect ratio (width / height)
      this.uniforms.uTexAspect.value = tex.image.width / tex.image.height;
      this.uniforms.uTexture.value = tex;
      this.animate();
    });
  }

  addLogo() {
    this.logo = new Image();
    this.logo.src = this.logoSrc;
    this.logo.style.position = "fixed";
    this.logo.style.left = "3em";
    this.logo.style.bottom = "-3em";
    this.logo.style.zIndex = "10000";
    this.logo.style.pointerEvents = "none";
    this.logo.style.width = "400px";
    this.logo.style.maxWidth = "80%";
    this.logo.style.height = "auto";
    document.body.appendChild(this.logo);
  }

  startExit() {
    if (this.uniforms.uIsExiting.value === 0) {
      this.uniforms.uIsExiting.value = 1;
      this.uniforms.uExitProgress.value = 0.0;
      if (this.logo) this.logo.remove();
    }
  }

  _preventScroll = (e) => { e.preventDefault(); };

  disableScroll() {
    this._originalOverflow = {
      html: document.documentElement.style.overflow,
      body: document.body.style.overflow,
      htmlTouch: document.documentElement.style.touchAction
    };

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.touchAction = 'none';
    document.addEventListener("touchmove", this._preventScroll, { passive: false });
  }

  restoreScroll() {
    document.documentElement.style.overflow = this._originalOverflow.html;
    document.body.style.overflow = this._originalOverflow.body;
    document.documentElement.style.touchAction = this._originalOverflow.htmlTouch;
    document.removeEventListener("touchmove", this._preventScroll, { passive: false });
  }

  destroy() {
    this.restoreScroll();
    this.renderer.domElement.remove();
    if (this.logo) this.logo.remove();
  }

  animate() {

    // Smooth follow: move current focus toward target
    this.focusX += (this.targetX - this.focusX) * this.followSpeed;
    this.focusY += (this.targetY - this.focusY) * this.followSpeed;

    // Update shader uniform
    this.uniforms.uFocus.value.set(this.focusX, window.innerHeight - this.focusY);
    this.animationId = requestAnimationFrame(() => this.animate());
    this.uniforms.uTime.value += 0.02;

    if (this.uniforms.uIsExiting.value === 1) {
      this.uniforms.uExitProgress.value += 2.0;
      this.uniforms.uAlpha.value -= 0.01;

      if (this.uniforms.uAlpha.value <= 0.0) {
        cancelAnimationFrame(this.animationId);
        this.destroy();
        return;
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
}

if (window.WebGLRenderingContext) {
  window.addEventListener("load", () => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("mode")) {
      try {
        new WarpShader("src/img/background_2000.jpg", "src/img/logo.png");
      } catch (error) {
        console.log(error);
      }
    }
  });
}