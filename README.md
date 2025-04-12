# Movie Directory Application

A desktop application for organizing and playing your movie collection. Built with Electron for maximum compatibility with older macOS versions (10.12+).

## Features

- 🎬 Scan directories for movies
- 🎯 Automatic movie information fetching from IMDB
- 🗂️ Category-based organization
- 🔍 Movie filtering functionality
- 💾 Local caching of movie information and thumbnails
- ▶️ Direct playback through VLC
- 📁 Quick access to movie files in Finder

## Requirements

- macOS 10.12 (Sierra) or later
- Node.js 14.0.0 or later
- VLC media player (for playback)

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

3. Create a `.env` file in the root directory and add your IMDB API key:
   ```env
   IMDB_API_KEY=your-api-key-here
   ```

## Development

Run the application in development mode:
```bash
npm start
```

## Building

Build the application for macOS:
```bash
npm run build
```

The built application will be available in the `dist` directory.

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
- Supports common video formats (mp4, mkv, avi)
- Automatically organizes movies by directory name

### Movie Information
- Fetches detailed movie information from IMDB
- Caches information locally for faster loading
- Displays movie posters, ratings, and basic information

### Movie Organization
- Automatic category assignment based on directory structure
- Filter movies by category
- Remember last selected category

### Playback Integration
- Direct integration with VLC media player
- Quick access to movie files in Finder

## License

ISC
