# 🚀 Remote Desktop - Build Instructions

## Prerequisites

Make sure you have Node.js and npm installed for building:
```bash
npm install
```

## Building Executables

### Quick Build (Current Platform)
```bash
npm run make
```

### Platform-Specific Builds (PKG Method)

**For macOS (ARM64 - M1/M2):**
```bash
npm run make:mac
# or with nexe (better for native modules):
node build.js mac nexe
```

**For Windows (x64):**
```bash
npm run make:win
# or with nexe:
node build.js win nexe
```

**For Linux (x64):**
```bash
npm run make:linux
# or with nexe:
node build.js linux nexe
```

**For All Platforms:**
```bash
npm run make:all
```

### Alternative with nexe (Recommended for native modules)

```bash
# Current platform
npm run build-nexe

# Specific platforms
npm run build-nexe:mac
npm run build-nexe:win
npm run build-nexe:linux
```

## Output

Built executables will be located in the `dist/` folder:

- `remote-desktop-local-macos` - macOS ARM64 executable
- `remote-desktop-local-win.exe` - Windows x64 executable  
- `remote-desktop-local-linux` - Linux x64 executable

## Usage

1. Copy the appropriate executable to your target device
2. Run the executable directly (no Node.js installation required)
3. Open browser and go to `http://localhost:3000`
4. For network access: `http://[device-ip]:3000`

## File Sizes

Typical executable sizes:
- macOS: ~50-70 MB
- Windows: ~50-70 MB  
- Linux: ~50-70 MB

## Notes

- The executable includes Node.js runtime and all dependencies
- First run might be slower due to extraction
- Firewall may prompt for network access permissions
- For ARM64 Windows, use the Linux build as fallback

## Troubleshooting

**"Permission denied" on macOS/Linux:**
```bash
chmod +x ./dist/remote-desktop-local-*
```

**Antivirus blocking on Windows:**
- Add executable to antivirus whitelist
- Or use code signing for production builds 