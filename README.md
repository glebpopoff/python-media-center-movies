# Movie Directory

Electron app is published to a different branch: electron_macos_10_12_x86 for max compatibility.

The main branch contains a PyQt6 app (10.13 or later), requires PyQt6 

A PyQt6-based media center app to manage your locally stored movie files. Features include:
- Automatic movie metadata fetching from IMDB
- Movie thumbnails and information display
- Category-based organization
- VLC integration for playback
- Finder/Explorer integration for file management

## Requirements
- macOS 10.13 or later
- VLC media player for movie playback

## Installation
1. Download the latest release from the `dist` folder
2. Copy `Movie Directory.app` to your Applications folder
3. When running for the first time, right-click and select "Open" to bypass Gatekeeper

## Usage
1. Launch the app
2. Select your movies base directory when prompted
3. Choose a category from the dropdown
4. Click "Scan" to find movies
5. Use the Play button to watch movies in VLC
6. Use the Folder button to open movie locations in Finder

## Building from Source
```bash
# Install dependencies
pip3 install -r requirements.txt
pip3 install pyinstaller

# Build executable
pyinstaller --name="Movie Directory" --windowed --onefile --add-data "ui:ui" --add-data "core:core" main.py
```

The executable will be created in the `dist` folder.
