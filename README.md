# Movie Directory Application

A desktop application for organizing and playing your movie collection. Built with Electron for maximum compatibility with older macOS versions (10.12+).

## Features

- 🎬 Smart directory scanning with automatic categorization
- 🎯 Intelligent movie information fetching from web
- 🗂️ Category-based organization with persistent settings
- 🔍 Real-time movie filtering and search
- 💾 Enhanced local caching system for posters and movie data
- ▶️ Direct playback integration with VLC
- 📁 Quick access to movie files in Finder
- ⚙️ Configurable auto-scan on startup
- 🔄 Batch poster download functionality
- 📂 Improved movie data organization with _data subdirectories

## Requirements

- macOS 10.12 (Sierra) or later
- Node.js 14.0.0 or later
- VLC media player (for playback)

## Directory Structure

The application requires a specific directory structure for proper movie organization:

```
Main Directory/
├── Action/                 # Category/Genre directory
│   ├── Movie Name 1/      # Each movie in its own directory
│   │   ├── movie.mp4
│   │   └── _data/        # Movie metadata
│   └── Movie Name 2/
├── Comedy/
│   └── Another Movie/
└── Cartoons/
    └── Animated Movie/
```

Each movie **must** be in its own directory within a category folder. This structure is required for proper movie detection and metadata organization.

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd movie-directory
   ```

2. Install dependencies:
   ```bash
   npm install
   ```



## Development

Run the application in development mode:
```bash
npm start
```

## Building

### Current Build Configuration
The default configuration in `package.json` targets:
- macOS 10.12+ (Sierra)
- x86_64 architecture
- Electron 11.0.0

### Building for Different Platforms

1. For modern macOS (10.15+) with Apple Silicon support:
   ```bash
   # Update package.json first:
   # Change "minimumSystemVersion": "10.12.0" to "10.15.0"
   # Update "arch" to include arm64:
   # "arch": ["x64", "arm64"]
   npm run build
   ```

2. For modern macOS (10.15+) x86_64 only:
   ```bash
   # Update package.json:
   # Change "minimumSystemVersion": "10.12.0" to "10.15.0"
   npm run build
   ```

3. For legacy macOS (current default):
   ```bash
   npm run build
   ```

To customize the build configuration, modify the following in `package.json`:
```json
{
  "build": {
    "mac": {
      "target": [{
        "target": "dmg",
        "arch": ["x64"] // Add "arm64" for Apple Silicon
      }],
      "minimumSystemVersion": "10.12.0" // Adjust for target macOS version
    }
  }
}
```

### Electron Version
The current build uses Electron 11.0.0 for maximum compatibility. For modern macOS versions, you can update to a newer Electron version:

```bash
# For modern macOS (10.15+)
npm uninstall electron
npm install electron@latest --save-dev
```

The built application will be available in the `dist` directory with the naming format:
`Movie Directory-{version}-{arch}.dmg`

## Project Structure

```
movie-directory/
├── public/              # Static assets
│   ├── index.html
│   └── styles.css
├── src/
│   ├── main/           # Main process code
│   │   └── main.js
│   └── renderer/       # Renderer process code
│       └── renderer.js
├── package.json
└── .gitignore
```

## Usage

1. Launch the application
2. Click "Scan Directory" to select a movie directory
3. The application will scan for movies and fetch their information from IMDB
4. Use the category dropdown to filter movies
5. Click "Play" to open a movie in VLC
6. Click "Show in Finder" to locate the movie file

## Features in Detail

### Directory Scanning
- Supports common video formats (mp4, mkv, avi, mov, wmv)
- Smart directory structure detection with genre/category-based organization
- Configurable auto-scan feature on application startup

### Movie Information
- Intelligent movie information fetching with improved accuracy
- Enhanced local caching in dedicated _data directories
- Batch poster download functionality with progress tracking
- Displays movie posters, ratings, year, and genre information

### Movie Organization
- Dynamic category management based on directory structure
- Persistent category selection between sessions
- Real-time movie filtering within categories
- Improved poster management with automatic migration

### Playback Integration
- Seamless VLC media player integration
- Quick access to movie files in Finder
- Improved error handling for missing files

## License

ISC
