# QR Detection Application

A professional desktop application for detecting QR codes from live network video feeds, generating cryptographic hashes, and triggering webhooks with contact information.

## Features

- **Live Video Feed**: Ingest video streams from local network sources (MJPEG, HLS, WebRTC)
- **Real-time QR Detection**: Automatic QR code detection with visual highlighting
- **Hash Generation**: SHA-256 hash generation for detected QR codes
- **API Integration**: Send QR hashes to configured API endpoints
- **Webhook Triggers**: Automatically trigger webhooks with contact information
- **Professional UI**: Modern, dark-themed interface built with TailwindCSS
- **Activity Monitoring**: Real-time activity logs and detection statistics
- **Duplicate Prevention**: Smart filtering to prevent duplicate detections

## Technology Stack

- **Electron**: Cross-platform desktop application framework
- **TailwindCSS**: Modern utility-first CSS framework
- **jsQR**: Fast QR code detection library
- **Node.js**: Backend processing for API calls and webhooks
- **HTML5 Video**: Network video stream handling

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- macOS (primary target, but works on Linux/Windows)
- Network camera or video stream source

## Installation

1. **Clone or download the project**:
   ```bash
   cd /home/global/Documents/QRdetection
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build TailwindCSS**:
   ```bash
   npm run build:css
   ```

   This command will generate the output CSS file. For development with auto-rebuild, you can run:
   ```bash
   npm run dev
   ```

## Running the Application

### Development Mode

To run the application in development mode with live CSS rebuilding:

```bash
npm run dev
```

### Production Mode

To run the application:

```bash
npm start
```

### Building for Distribution

To create a distributable package:

```bash
npm run package
```

This will create a `.dmg` file for macOS in the `dist` folder.

## Configuration

On first launch, click the **Settings** button (gear icon) in the top-right corner to configure:

### Video Source
- **Video Source URL**: Enter your network camera stream URL
  - Example MJPEG: `http://192.168.1.100:8080/video`
  - Example HLS: `http://192.168.1.100:8080/stream.m3u8`
  - Example RTSP (via converter): Use a tool like FFmpeg to convert RTSP to HTTP stream

### API Configuration
- **API Endpoint URL**: The endpoint where QR hashes will be sent
  - Example: `https://api.example.com/qr-hashes`
- **API Key** (optional): Bearer token for API authentication

### Webhook Configuration
- **Webhook URL**: Endpoint to receive contact information
  - Example: `https://webhook.example.com/contact-info`
  - Payload format:
    ```json
    {
      "qr_hash": "abc123...",
      "contact_info": { ... },
      "timestamp": "2025-10-18T12:00:00.000Z",
      "event_type": "qr_detected"
    }
    ```

### Detection Settings
- **Scan Interval**: Time between scans in milliseconds (100-2000ms)
  - Lower values = faster detection but higher CPU usage
  - Recommended: 500ms
- **Prevent Duplicate Detections**: Ignore the same QR code for 5 seconds

## Usage

1. **Configure Settings**: Set up your video source, API, and webhook URLs
2. **Start Detection**: Click the "Start Detection" button
3. **Monitor Activity**: Watch the video feed and activity panel for detections
4. **View Statistics**: Track QR codes detected, API calls, and webhooks triggered

## API Integration Details

### QR Hash API

When a QR code is detected, the application sends a POST request:

```javascript
POST {apiUrl}
Headers:
  Authorization: Bearer {apiKey} // if configured
  Content-Type: application/json

Body:
{
  "qr_hash": "sha256_hash_of_qr_data",
  "timestamp": "2025-10-18T12:00:00.000Z"
}
```

Expected response format (for webhook trigger):
```json
{
  "contact_info": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890"
  }
}
```

### Webhook

If the API returns contact information, the webhook is triggered:

```javascript
POST {webhookUrl}
Headers:
  Content-Type: application/json

Body:
{
  "qr_hash": "sha256_hash_of_qr_data",
  "contact_info": { ... }, // from API response
  "timestamp": "2025-10-18T12:00:00.000Z",
  "event_type": "qr_detected"
}
```

## Setting Up a Test Video Stream

For testing, you can use your smartphone as a network camera:

### iOS (iPhone)
1. Install app like "IP Camera Lite" or "EpocCam"
2. Start the camera server
3. Use the provided URL in the app settings

### Android
1. Install "IP Webcam" or "DroidCam"
2. Start the server
3. Use the provided URL (usually `http://<phone-ip>:8080/video`)

### Computer Webcam
Use FFmpeg to stream your webcam:
```bash
ffmpeg -f avfoundation -i "0" -f mjpeg -q:v 3 http://localhost:8080/video
```

## Troubleshooting

### Video Stream Not Loading
- Verify the video source URL is correct and accessible
- Check if the stream format is supported (MJPEG works best)
- Ensure your firewall allows access to the stream
- Test the stream URL in a web browser first

### QR Codes Not Detected
- Ensure QR codes are clear and well-lit
- Adjust the scan interval (lower for faster detection)
- Check if the video resolution is sufficient
- Verify the QR code is within the camera frame

### API/Webhook Errors
- Check the URLs are correct and accessible
- Verify API authentication if required
- Check the activity log for detailed error messages
- Ensure the endpoints accept POST requests with JSON payloads

### Performance Issues
- Increase the scan interval to reduce CPU usage
- Lower the video stream resolution
- Close other resource-intensive applications

## Project Structure

```
QRdetection/
├── main.js              # Electron main process
├── preload.js           # Electron preload script (security bridge)
├── index.html           # Main application UI
├── package.json         # Project dependencies and scripts
├── tailwind.config.js   # TailwindCSS configuration
├── src/
│   ├── app.js          # Main application logic
│   ├── qr-scanner.js   # QR detection module
│   ├── input.css       # TailwindCSS source
│   └── output.css      # Generated CSS (auto-generated)
└── README.md           # This file
```

## Security Considerations

- API keys are stored in localStorage (consider encryption for production)
- Video streams should use HTTPS when possible
- Validate all webhook/API endpoints before use
- The application uses Electron's context isolation for security

## Development

### Enabling DevTools

Uncomment this line in `main.js`:

```javascript
mainWindow.webContents.openDevTools();
```

### Code Structure

- **main.js**: Electron main process, handles IPC, API calls, webhooks
- **preload.js**: Secure bridge between renderer and main process
- **app.js**: UI logic, state management, event handling
- **qr-scanner.js**: QR detection algorithm, video processing

## Future Enhancements

- [ ] Multiple video source support
- [ ] Recording detected QR codes to database
- [ ] Export detection history to CSV/JSON
- [ ] Advanced filtering and search
- [ ] Email notifications
- [ ] Custom detection zones
- [ ] Multi-language support
- [ ] Cloud sync for configuration

## License

MIT License - feel free to use and modify for your needs.

## Support

For issues or questions, please check:
1. This README for troubleshooting tips
2. The activity log in the application for error details
3. Browser console (DevTools) for technical errors

---

Built with ❤️ using Electron and TailwindCSS
