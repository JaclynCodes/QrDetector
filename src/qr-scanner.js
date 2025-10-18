// QR Scanner Module using jsQR
// This file handles QR code detection from video feed

class QRScanner {
  constructor() {
    this.video = document.getElementById('videoElement');
    this.canvas = document.getElementById('canvasElement');
    this.canvasContext = this.canvas.getContext('2d');
    this.isScanning = false;
    this.scanInterval = 500; // milliseconds
    this.preventDuplicates = true;
    this.recentQRCodes = new Map(); // Store recent QR codes with timestamps
    this.duplicateTimeout = 5000; // 5 seconds
    this.onQRDetected = null; // Callback function
  }

  async initialize() {
    // Set canvas size to match video
    this.video.addEventListener('loadedmetadata', () => {
      this.canvas.width = this.video.videoWidth;
      this.canvas.height = this.video.videoHeight;
    });
  }

  startScanning() {
    if (this.isScanning) return;
    this.isScanning = true;
    this.scan();
  }

  stopScanning() {
    this.isScanning = false;
  }

  scan() {
    if (!this.isScanning) return;

    if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
      // Draw video frame to canvas
      this.canvasContext.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

      // Get image data
      const imageData = this.canvasContext.getImageData(0, 0, this.canvas.width, this.canvas.height);

      // Detect QR code
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code) {
        this.handleQRDetection(code);
      } else {
        // Clear canvas if no QR code detected
        this.canvasContext.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }

    // Continue scanning
    setTimeout(() => this.scan(), this.scanInterval);
  }

  handleQRDetection(code) {
    const qrData = code.data;
    const now = Date.now();

    // Check if this is a duplicate detection
    if (this.preventDuplicates && this.recentQRCodes.has(qrData)) {
      const lastDetected = this.recentQRCodes.get(qrData);
      if (now - lastDetected < this.duplicateTimeout) {
        // Still within duplicate timeout, just draw the highlight
        this.drawQRHighlight(code);
        return;
      }
    }

    // Record this detection
    this.recentQRCodes.set(qrData, now);

    // Clean up old entries
    this.cleanupRecentQRCodes(now);

    // Draw highlight on detected QR code
    this.drawQRHighlight(code);

    // Trigger callback
    if (this.onQRDetected) {
      this.onQRDetected({
        data: qrData,
        location: code.location,
        timestamp: new Date().toISOString()
      });
    }
  }

  drawQRHighlight(code) {
    const ctx = this.canvasContext;

    // Clear previous drawings
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw corner points
    const points = code.location;

    // Draw bounding box
    ctx.beginPath();
    ctx.moveTo(points.topLeftCorner.x, points.topLeftCorner.y);
    ctx.lineTo(points.topRightCorner.x, points.topRightCorner.y);
    ctx.lineTo(points.bottomRightCorner.x, points.bottomRightCorner.y);
    ctx.lineTo(points.bottomLeftCorner.x, points.bottomLeftCorner.y);
    ctx.closePath();

    ctx.lineWidth = 4;
    ctx.strokeStyle = '#10b981';
    ctx.stroke();

    // Draw corner markers
    [points.topLeftCorner, points.topRightCorner, points.bottomLeftCorner, points.bottomRightCorner].forEach(corner => {
      ctx.beginPath();
      ctx.arc(corner.x, corner.y, 8, 0, 2 * Math.PI);
      ctx.fillStyle = '#10b981';
      ctx.fill();
    });

    // Draw data preview
    ctx.font = '16px monospace';
    ctx.fillStyle = '#10b981';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    const text = code.data.substring(0, 50) + (code.data.length > 50 ? '...' : '');
    const textY = points.topLeftCorner.y - 10;
    ctx.strokeText(text, points.topLeftCorner.x, textY);
    ctx.fillText(text, points.topLeftCorner.x, textY);
  }

  cleanupRecentQRCodes(now) {
    for (const [qrData, timestamp] of this.recentQRCodes.entries()) {
      if (now - timestamp > this.duplicateTimeout) {
        this.recentQRCodes.delete(qrData);
      }
    }
  }

  setScanInterval(interval) {
    this.scanInterval = interval;
  }

  setPreventDuplicates(prevent) {
    this.preventDuplicates = prevent;
  }
}

// Export for use in main app
window.QRScanner = QRScanner;
