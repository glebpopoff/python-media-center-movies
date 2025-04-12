const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const Store = require('electron-store');
const IMDB = require('imdb-api');
const https = require('https');

let mainWindow;
const store = new Store();

// Supported video formats
const VIDEO_FORMATS = ['.mp4', '.mkv', '.avi', '.mov', '.wmv'];

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('public/index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Helper function to download image
async function downloadImage(url, filepath) {
  if (!url) return null;
  
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download image: ${response.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(filepath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve(filepath);
      });

      fileStream.on('error', reject);
    }).on('error', reject);
  });
}

// Get all subdirectories
async function getSubdirectories(directory) {
    if (!directory) return [];
    
    try {
        console.log('Scanning directory:', directory);
        const items = await fs.readdir(directory, { withFileTypes: true });
        const dirs = items
            .filter(item => item.isDirectory())
            .map(item => item.name)
            .sort((a, b) => a.localeCompare(b));
        
        console.log('Found directories:', dirs);
        return dirs;
    } catch (error) {
        console.error('Error reading directories:', error);
        return [];
    }
}

// Scan directory for movies
async function scanDirectory(directory) {
    const movies = [];
    const cacheDir = path.join(app.getPath('userData'), 'cache');
    
    try {
        await fs.mkdir(cacheDir, { recursive: true });
    } catch (error) {
        console.error('Error creating cache directory:', error);
    }

    // Get immediate subdirectories first
    const items = await fs.readdir(directory, { withFileTypes: true });
    const dirs = items
        .filter(item => item.isDirectory())
        .map(item => item.name);

    // Process each directory
    for (const dir of dirs) {
        const dirPath = path.join(directory, dir);
        const files = await fs.readdir(dirPath);
        
        for (const file of files) {
            const fullPath = path.join(dirPath, file);
            const stat = await fs.stat(fullPath);
            
            if (!stat.isDirectory() && VIDEO_FORMATS.includes(path.extname(file).toLowerCase())) {
                const movieName = path.basename(file, path.extname(file));
                
                try {
                    const movie = await IMDB.get({ name: movieName }, { apiKey: store.get('imdbApiKey') });
                    if (movie && movie.poster) {
                        const posterPath = path.join(cacheDir, `${movie.imdbid}.jpg`);
                        try {
                            await downloadImage(movie.poster, posterPath);
                            movie.localPoster = posterPath;
                        } catch (error) {
                            console.error(`Error downloading poster for ${movieName}:`, error);
                        }
                    }
                    
                    movies.push({
                        name: movieName,
                        path: fullPath,
                        category: dir,
                        info: movie
                    });
                } catch (error) {
                    console.error(`Error fetching info for ${movieName}:`, error);
                    movies.push({
                        name: movieName,
                        path: fullPath,
                        category: dir,
                        info: null
                    });
                }
            }
        }
    }

    return movies;
}

// IPC handlers
ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });

    if (!result.canceled) {
        return result.filePaths[0];
    }
    return null;
});

ipcMain.handle('get-categories', async (event, directory) => {
    if (!directory) return [];
    return await getSubdirectories(directory);
});

ipcMain.handle('get-movie-folders', async (event, categoryPath) => {
    try {
        console.log('Reading category path:', categoryPath);
        const items = await fs.readdir(categoryPath, { withFileTypes: true });
        const movieFolders = items
            .filter(item => item.isDirectory())
            .map(folder => ({
                name: folder.name,
                path: path.join(categoryPath, folder.name)
            }));

        console.log('Found movie folders:', movieFolders);
        return movieFolders;
    } catch (error) {
        console.error('Error reading movie folders:', error);
        return [];
    }
});

ipcMain.handle('play-in-vlc', async (event, moviePath) => {
    try {
        exec(`open -a VLC '${moviePath}'`, (error) => {
            if (error) {
                console.error('Error opening VLC:', error);
                return false;
            }
        });
        return true;
    } catch (error) {
        console.error('Error launching VLC:', error);
        return false;
    }
});

ipcMain.handle('open-in-finder', async (event, dirPath) => {
    try {
        await shell.openPath(dirPath);
        return true;
    } catch (error) {
        console.error('Error opening Finder:', error);
        return false;
    }
});

ipcMain.handle('scan-directory', async (event, directory) => {
  return await scanDirectory(directory);
});

ipcMain.handle('fetch-movie-info', async (event, movieName) => {
  try {
    const client = new IMDB.Client({ apiKey: process.env.IMDB_API_KEY || 'your-api-key' });
    const movie = await client.get({ name: movieName });
    return movie;
  } catch (error) {
    console.error('Error fetching movie info:', error);
    return null;
  }
});

// Handle opening movie in VLC
ipcMain.handle('open-movie', async (event, path) => {
  const { exec } = require('child_process');
  exec(`open -a VLC "${path}"`);
});

// Handle opening directory in Finder
ipcMain.handle('open-directory', async (event, path) => {
  const { shell } = require('electron');
  shell.showItemInFolder(path);
});
