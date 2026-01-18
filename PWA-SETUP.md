# PWA Setup for Co-do

Co-do is now a Progressive Web App (PWA) that can be installed on your device and work offline!

## Features

✅ **Installable**: Add Co-do to your home screen or desktop
✅ **Offline Support**: Core app functionality works without internet
✅ **Fast Loading**: Cached assets load instantly
✅ **App-like Experience**: Standalone window without browser UI

## Generating Icons

Before deploying, you need to generate the PWA icons:

1. Open `generate-icons.html` in your browser (Chrome recommended)
2. Click the download buttons to save both icons:
   - `icon-192.png` (192x192 pixels)
   - `icon-512.png` (512x512 pixels)
3. Save both icons to the `public/` directory
4. Delete `generate-icons.html` (optional, after icons are generated)

## Files Added

### Core PWA Files
- **`public/manifest.json`** - Web app manifest defining how the app appears when installed
- **`public/sw.js`** - Service worker for offline functionality and caching
- **`generate-icons.html`** - Icon generator (run once to create icons)

### Updated Files
- **`index.html`** - Added manifest link and PWA meta tags
- **`src/main.ts`** - Added service worker registration

## How It Works

### Service Worker Caching Strategy

1. **Static Assets**: Cache-first strategy
   - App shell (HTML, CSS, JS) is cached for offline use
   - Cached assets are served immediately for fast loading

2. **API Requests**: Network-only strategy
   - AI provider requests (Anthropic, OpenAI, Google) always use the network
   - Ensures you always get fresh AI responses

3. **Dynamic Caching**:
   - New assets are cached as they're fetched
   - Cache is updated on each new deployment

### Installation

When users visit Co-do in Chrome/Edge, they'll see an install prompt. The app can then be:
- Added to home screen on mobile devices
- Installed as a desktop app on computers
- Launched from the app drawer/start menu

## Testing PWA Features

### Local Testing

```bash
npm run build
npm run preview
```

Visit the preview URL and:
1. Open Chrome DevTools > Application > Service Workers
2. Verify the service worker is registered
3. Check the Manifest tab to see the app manifest
4. Test offline mode by:
   - Going offline in DevTools (Network tab)
   - Reloading the page (it should still work)

### Install Testing

In Chrome:
1. Click the install icon in the address bar
2. Or: Menu > More Tools > Create Shortcut > Check "Open as window"

### Lighthouse Audit

Run a PWA audit:
1. Open Chrome DevTools
2. Go to Lighthouse tab
3. Select "Progressive Web App" category
4. Click "Generate report"

## Deployment Notes

- Ensure your hosting serves files over HTTPS (required for PWA)
- The `base` path in `vite.config.ts` is set to `/Co-do/`
- Update the `start_url` and `scope` in `manifest.json` if deploying to a different path
- Service worker updates automatically on new deployments

## Browser Support

PWA features are best supported in:
- Chrome/Edge 86+
- Safari 16.4+ (limited)
- Firefox 108+ (limited)

File System Access API (core feature) requires:
- Chrome 86+
- Edge 86+

For the best experience, use the latest Chrome.

## Troubleshooting

### Service Worker Not Registering
- Check browser console for errors
- Ensure HTTPS is enabled (except localhost)
- Verify `sw.js` is accessible at `/Co-do/sw.js`

### Install Prompt Not Showing
- PWA must be served over HTTPS
- Must have a valid manifest
- Icons must exist at specified paths
- Service worker must be registered

### Offline Mode Not Working
- Check Service Worker is active in DevTools
- Verify caching strategy in `sw.js`
- Check Network tab for failed requests
