/**
 * Landing Page Overlay Animation
 */

class WarpCanvas {
    constructor(imgSrc, canvasId) {
        // Config
        this.timing = 0;
        this.sliceSize = 25;
        this.warpStrength = 15;
        this.alphaValue = 0.3;
        this.followSpeed = 0.02;

        this.imgSrc = imgSrc;
        this.canvasId = canvasId;

        this.initCanvas();
        this.initEvents();
    }

    initEvents() {
        // Mouse tracking
        document.addEventListener("mousemove", e => {
            this.targetX = e.clientX;
            this.targetY = e.clientY;
        });

        // Remove canvas on click
        this.canvas.addEventListener("click", () => this.destroy());

        // Handle resize
        window.addEventListener("resize", () => this.resize());
        this.resize();

        // Start animation when image is loaded
        this.img.onload = () => this.animate();
    }

    initCanvas() {
        this.canvas = document.getElementById(this.canvasId);
        this.ctx = this.canvas.getContext("2d");

        this.img = new Image();
        this.img.src = this.imgSrc;

        // Focal point
        this.focusX = Math.random() * window.innerWidth;
        this.focusY = Math.random() * window.innerHeight;
        this.targetX = this.focusX;
        this.targetY = this.focusY;

        // Setup canvas style
        this.canvas.style.position = "fixed";
        this.canvas.style.top = "0";
        this.canvas.style.left = "0";
        this.canvas.style.width = "100%";
        this.canvas.style.height = "100%";
        this.canvas.style.pointerEvents = "auto";
        this.canvas.style.zIndex = "9999";
    }
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    destroy() {
        cancelAnimationFrame(this.animationFrame);
        this.canvas.remove();
    }

    animate() {
        this.timing += 0.02;
        const {width, height} = this.canvas;
        const ctx = this.ctx;

        ctx.clearRect(0, 0, width, height);

        // Smooth attraction to mouse
        this.focusX += (this.targetX - this.focusX) * this.followSpeed;
        this.focusY += (this.targetY - this.focusY) * this.followSpeed;

        // Compute scale like CSS background-size: cover
        const scale = Math.max(width / this.img.width, height / this.img.height);
        const safeScale = scale * 1.1;

        const drawW = this.img.width * safeScale;
        const drawH = this.img.height * safeScale;
        const offsetX = (width - drawW) / 2;
        const offsetY = (height - drawH) / 2;

        const cx = this.focusX;
        const cy = this.focusY;

        ctx.globalAlpha = this.alphaValue;

        for (let y = 0; y < height; y += this.sliceSize) {
            for (let x = 0; x < width; x += this.sliceSize) {
                const dx = x - cx;
                const dy = y - cy;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;

                const warp = Math.sin(dist * 0.02 - this.timing) * this.warpStrength;

                const srcX = (x - offsetX) / drawW * this.img.width;
                const srcY = (y - offsetY) / drawH * this.img.height;

                ctx.drawImage(
                    this.img,
                    srcX, srcY,
                    (this.sliceSize / drawW) * this.img.width,
                    (this.sliceSize / drawH) * this.img.height,
                    x + (dx / dist) * warp,
                    y + (dy / dist) * warp,
                    this.sliceSize,
                    this.sliceSize
                );
            }
        }

        this.animationFrame = requestAnimationFrame(() => this.animate());
    }
}

window.addEventListener("load", () => {
  new WarpCanvas("getimg/img/background.jpg", "warpCanvas");
});