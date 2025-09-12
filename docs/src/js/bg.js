/**
 * Landing Page Overlay Animation
 */

class WarpCanvas {
    constructor(imgSrc, canvasId) {
        // Config
        this.warpSpeed = 0.02;
        this.sliceSize = 30;
        this.warpStrength = 15;
        this.alphaValue = 1;
        this.followSpeed = 0.02;
        this.exitSpeed = 2;
        this.exitFade = 0.01;
        this.baseOverlap = 15;
        this.extraOverlap = 20;

        this.imgSrc = imgSrc;
        this.canvasId = canvasId;

        this.timing = 0;
        this.isDestroying = false;
        this.exitProgress = 0;
        this.exitVectors = [];

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
        this.canvas.addEventListener("click", () => this.exit());

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

    exit() {
        if (!this.isDestroying) {
            this.isDestroying = true;
            this.exitProgress = 0;
            this.exitVectors = [];

            // assign outward directions per tile
            const { width, height } = this.canvas;
            const cx = this.focusX;
            const cy = this.focusY;

            for (let y = 0; y < height; y += this.sliceSize) {
                for (let x = 0; x < width; x += this.sliceSize) {
                    const dx = x - cx;
                    const dy = y - cy;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    this.exitVectors.push({
                        x, y,
                        dirX: dx / dist,
                        dirY: dy / dist
                    });
                }
            }
        }
    }

    destroy() {
        this.canvas.remove();
    }

    animate() {
        this.timing += this.warpSpeed;
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

       if (!this.isDestroying) {
            for (let y = 0; y < height; y += this.sliceSize) {
                for (let x = 0; x < width; x += this.sliceSize) {
                    const dx = x - this.focusX;
                    const dy = y - this.focusY;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

                    // Scale warp strength with motion
                    //const movement = Math.abs(this.targetX - this.focusX) + Math.abs(this.targetY - this.focusY);
                    // this.warpFactor = (this.warpFactor || 1) * 0.1 + Math.min(0.5, movement * 0.1);
                    this.warpFactor = 1.0;


                    const warp = Math.sin(dist * 0.02 - this.timing) * this.warpStrength * this.warpFactor;
                    const srcX = (x - offsetX) / drawW * this.img.width;
                    const srcY = (y - offsetY) / drawH * this.img.height;

                    this.drawTile(
                        srcX, srcY,
                        drawW, drawH,
                        x + (dx / dist) * warp, y + (dy / dist) * warp
                    );
                }
            }
        } else {
            this.exitProgress += this.exitSpeed;

            for (let i = 0; i < this.exitVectors.length; i++) {
                const tile = this.exitVectors[i];
                const x = tile.x + tile.dirX * this.exitProgress;
                const y = tile.y + tile.dirY * this.exitProgress;

                const srcX = (tile.x - offsetX) / drawW * this.img.width;
                const srcY = (tile.y - offsetY) / drawH * this.img.height;

                this.drawTile(srcX, srcY,drawW, drawH,x, y);

            }

            this.alphaValue -= this.exitFade;
        }

        if (this.alphaValue <= 0) {
            this.destroy();
            return;
        }

        this.animationFrame = requestAnimationFrame(() => this.animate());
    }

    drawTile(srcX, srcY, drawW, drawH, x, y) {
        const sW = (this.sliceSize / drawW) * this.img.width;
        const sH = (this.sliceSize / drawH) * this.img.height;

        // Distance from the current tile to the focal point
        const dx = x - this.focusX;
        const dy = y - this.focusY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Adaptive overlap: bigger near the focal point
        const influence = Math.max(0, 1 - dist / 200); // within 200px from focus
        const overlap = this.baseOverlap + this.extraOverlap * influence;

        this.ctx.drawImage(
            this.img,
            Math.floor(srcX), Math.floor(srcY),
            Math.ceil(sW) + overlap, Math.ceil(sH) + overlap,
            Math.floor(x), Math.floor(y),
            this.sliceSize + overlap, this.sliceSize + overlap
        );
    }
}

window.addEventListener("load", () => {
  new WarpCanvas("src/img/background_2000.jpg", "warpCanvas");
});