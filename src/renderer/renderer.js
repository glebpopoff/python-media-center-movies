const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const Store = require('electron-store');
const store = new Store({
    defaults: {
        defaultDirectory: '',
        autoScan: false,
        lastCategory: 'all'
    }
});

// Cache for movies and categories
let moviesCache = [];
let categoriesCache = [];

// DOM Elements
const categorySelect = document.getElementById('categorySelect');
const moviesGrid = document.getElementById('moviesGrid');
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
const defaultDirectoryInput = document.getElementById('defaultDirectory');
const selectDefaultDirectoryButton = document.getElementById('selectDefaultDirectory');
const autoScanCheckbox = document.getElementById('autoScan');
const saveConfigButton = document.getElementById('saveConfig');

// Load configuration
const config = {
    defaultDirectory: store.get('defaultDirectory'),
    autoScan: store.get('autoScan'),
    lastCategory: store.get('lastCategory', 'all')
};

// Initialize UI with stored values
defaultDirectoryInput.value = config.defaultDirectory;
autoScanCheckbox.checked = config.autoScan;

// Load categories if directory is configured
if (config.defaultDirectory) {
    console.log('Loading categories from:', config.defaultDirectory);
    updateCategories(config.defaultDirectory);
} else {
    console.log('No default directory configured');
    moviesGrid.innerHTML = '<div class="no-movies">Please configure your movies directory in the Configuration tab</div>';
}

// Function to update categories dropdown
async function updateCategories(directory) {
    try {
        console.log('Updating categories for directory:', directory);
        const categories = await ipcRenderer.invoke('get-categories', directory);
        console.log('Received categories:', categories);
        categoriesCache = categories;

        // Clear existing options
        categorySelect.innerHTML = '';
        
        // Add placeholder option
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Select Category';
        placeholder.disabled = true;
        placeholder.selected = !categories.length;
        categorySelect.appendChild(placeholder);
        
        // Add categories to dropdown
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categorySelect.appendChild(option);
        });

        // Set last selected category if it exists
        const lastCategory = store.get('lastCategory');
        if (lastCategory && categories.includes(lastCategory)) {
            categorySelect.value = lastCategory;
            filterMovies(lastCategory);
        } else if (categories.length > 0) {
            // Select first category if no last category
            categorySelect.value = categories[0];
            filterMovies(categories[0]);
        }

        if (categories.length === 0) {
            moviesGrid.innerHTML = '<div class="no-movies">No categories found. Add some movie directories to your configured folder.</div>';
        }
    } catch (error) {
        console.error('Error updating categories:', error);
        moviesGrid.innerHTML = '<div class="error">Error loading categories. Please check your directory settings.</div>';
    }
}

// Function to display movie folders
async function displayDirectoryContent(category) {
    if (!category) {
        moviesGrid.innerHTML = '<div class="no-movies">Please select a category</div>';
        return;
    }

    store.set('lastCategory', category);
    moviesGrid.innerHTML = '<div class="loading">Loading movies...</div>';

    const categoryPath = path.join(config.defaultDirectory, category);
    try {
        console.log('Fetching movies from:', categoryPath);
        const movieFolders = await ipcRenderer.invoke('get-movie-folders', categoryPath);
        console.log('Received movie folders:', movieFolders);

        moviesGrid.innerHTML = '';
        
        if (movieFolders.length === 0) {
            moviesGrid.innerHTML = '<div class="no-movies">No movie folders found in this category</div>';
            return;
        }

        movieFolders.forEach(movie => {
            const movieCard = document.createElement('div');
            movieCard.className = 'movie-card';
            
            // Thumbnail container
            const thumbnailContainer = document.createElement('div');
            thumbnailContainer.className = 'thumbnail-container';
            
            // Thumbnail image (using default for now)
            const thumbnail = document.createElement('img');
            thumbnail.src = 'assets/default-poster.jpg';
            thumbnail.alt = movie.name;
            thumbnailContainer.appendChild(thumbnail);
            
            // Movie title
            const title = document.createElement('div');
            title.className = 'movie-title';
            title.textContent = movie.name.replace(/[._]/g, ' ');
            
            // Action buttons
            const actions = document.createElement('div');
            actions.className = 'movie-actions';
            
            // IMDB button
            const imdbButton = document.createElement('button');
            imdbButton.className = 'action-button imdb';
            imdbButton.title = 'Fetch from IMDB';
            imdbButton.innerHTML = '<i class="fas fa-database"></i>';
            imdbButton.onclick = () => fetchFromIMDB(movie.name);
            
            // Play button
            const playButton = document.createElement('button');
            playButton.className = 'action-button play';
            playButton.title = 'Play in VLC';
            playButton.innerHTML = '<i class="fas fa-play"></i>';
            playButton.onclick = () => playInVLC(movie.path);
            
            // Finder button
            const finderButton = document.createElement('button');
            finderButton.className = 'action-button finder';
            finderButton.title = 'Open in Finder';
            finderButton.innerHTML = '<i class="fas fa-folder-open"></i>';
            finderButton.onclick = () => openInFinder(movie.path);
            
            actions.appendChild(imdbButton);
            actions.appendChild(playButton);
            actions.appendChild(finderButton);
            
            movieCard.appendChild(thumbnailContainer);
            movieCard.appendChild(title);
            movieCard.appendChild(actions);
            
            moviesGrid.appendChild(movieCard);
        });

    } catch (error) {
        console.error('Error displaying movies:', error);
        moviesGrid.innerHTML = '<div class="error">Error loading movies</div>';
    }
}

// Helper functions for actions
async function fetchFromIMDB(movieName) {
    try {
        // Clean up movie name by removing extension and replacing dots/underscores
        const cleanName = movieName
            .replace(/\.[^/.]+$/, '') // Remove extension
            .replace(/[._]/g, ' '); // Replace dots and underscores with spaces
        
        // TODO: Implement IMDB fetching
        alert(`Will fetch IMDB info for: ${cleanName}`);
    } catch (error) {
        console.error('Error fetching from IMDB:', error);
        alert('Error fetching from IMDB');
    }
}

async function playInVLC(moviePath) {
    try {
        const success = await ipcRenderer.invoke('play-in-vlc', moviePath);
        if (!success) {
            alert('Error launching VLC. Please make sure VLC is installed.');
        }
    } catch (error) {
        console.error('Error playing in VLC:', error);
        alert('Error launching VLC');
    }
}

async function openInFinder(dirPath) {
    try {
        const success = await ipcRenderer.invoke('open-in-finder', dirPath);
        if (!success) {
            alert('Error opening Finder');
        }
    } catch (error) {
        console.error('Error opening Finder:', error);
        alert('Error opening Finder');
    }
}

// Function to display a movie
function displayMovie(movie) {
    const movieCard = document.createElement('div');
    movieCard.className = 'movie-card';

    const posterImg = document.createElement('img');
    if (movie.info && movie.info.localPoster && fs.existsSync(movie.info.localPoster)) {
        posterImg.src = `file://${movie.info.localPoster}`;
    } else {
        posterImg.src = 'placeholder.png';
    }
    posterImg.alt = movie.name;

    const movieInfo = document.createElement('div');
    movieInfo.className = 'movie-info';
    movieInfo.innerHTML = `
        <h3>${movie.name}</h3>
        ${movie.info ? `
            <p>Rating: ${movie.info.rating || 'N/A'}</p>
            <p>Year: ${movie.info.year || 'N/A'}</p>
        ` : ''}
        <p>Category: ${movie.category}</p>
        <div class="movie-controls">
            <button onclick="playMovie('${movie.path}')">Play</button>
            <button onclick="showInFinder('${movie.path}')">Show in Finder</button>
        </div>
    `;

    movieCard.appendChild(posterImg);
    movieCard.appendChild(movieInfo);
    moviesGrid.appendChild(movieCard);
}

// Function to scan directory
async function scanDirectory(directory) {
    try {
        moviesGrid.innerHTML = '<div class="loading">Scanning directory and fetching movie information...</div>';

        // Update categories first
        await updateCategories(directory);

        // Then scan for movies
        moviesCache = await ipcRenderer.invoke('scan-directory', directory);
        
        // Filter movies based on current category
        filterMovies(categorySelect.value);

        // Update the default directory in configuration if this was triggered by scan button
        if (!config.defaultDirectory) {
            defaultDirectoryInput.value = directory;
            store.set('defaultDirectory', directory);
        }
    } catch (error) {
        console.error('Error scanning directory:', error);
        moviesGrid.innerHTML = '<div class="error">Error scanning directory. Please check the console for details.</div>';
    }
}

// Auto-scan if enabled
if (config.autoScan && config.defaultDirectory) {
    scanDirectory(config.defaultDirectory);
}

// Tab switching
tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        const tabId = button.dataset.tab + 'Tab';
        tabContents.forEach(content => {
            content.style.display = content.id === tabId ? 'block' : 'none';
        });
    });
});

// Configuration events
selectDefaultDirectoryButton.addEventListener('click', async () => {
    const directory = await ipcRenderer.invoke('select-directory');
    if (directory) {
        defaultDirectoryInput.value = directory;
    }
});

saveConfigButton.addEventListener('click', () => {
    store.set('defaultDirectory', defaultDirectoryInput.value);
    store.set('autoScan', autoScanCheckbox.checked);
    
    // Show success message
    alert('Configuration saved successfully!');
});

// Event Listeners
categorySelect.addEventListener('change', () => {
    displayDirectoryContent(categorySelect.value);
});

// Handle configuration save
saveConfigButton.addEventListener('click', async () => {
    const directory = defaultDirectoryInput.value;
    if (!directory) {
        alert('Please select a directory first');
        return;
    }

    // Save settings
    config.defaultDirectory = directory;
    config.autoScan = autoScanCheckbox.checked;
    store.set('defaultDirectory', directory);
    store.set('autoScan', autoScanCheckbox.checked);
    
    // Update categories and switch to movies tab
    await updateCategories(directory);
    document.querySelector('[data-tab="movies"]').click();
    
    alert('Configuration saved successfully!');
});

categorySelect.addEventListener('change', (e) => {
    store.set('lastCategory', e.target.value);
    filterMovies();
});

async function scanDirectory(directory) {
    scanButton.disabled = true;
    scanButton.textContent = 'Scanning...';
    
    try {
        const movies = await ipcRenderer.invoke('scan-directory', directory);
        
        // Get unique category from directory structure
        const category = directory.split('/').slice(-1)[0];
        if (!categorySelect.querySelector(`option[value="${category}"]`)) {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categorySelect.appendChild(option);
        }
        
        // Fetch and display movies
        for (const movie of movies) {
            await displayMovie(movie, category);
        }
    } catch (error) {
        console.error('Error scanning directory:', error);
    } finally {
        scanButton.disabled = false;
        scanButton.textContent = 'Scan Directory';
    }
}

async function displayMovie(movie, category) {
    // Create movie card
    const movieCard = document.createElement('div');
    movieCard.className = 'movie-card';
    movieCard.dataset.category = category;
    
    // Try to get movie info from IMDB
    let movieInfo = movieCache.get(movie.name);
    if (!movieInfo) {
        movieInfo = await ipcRenderer.invoke('fetch-movie-info', movie.name);
        if (movieInfo) {
            movieCache.set(movie.name, movieInfo);
        }
    }
    
    // Create movie card content
    movieCard.innerHTML = `
        <img class="movie-poster" src="${movieInfo?.poster || 'placeholder.png'}" onerror="this.src='placeholder.png'">
        <div class="movie-info">
            <h3 class="movie-title">${movieInfo?.title || movie.name}</h3>
            <div class="movie-details">
                ${movieInfo ? `
                    <p>Year: ${movieInfo.year || 'N/A'}</p>
                    <p>Rating: ${movieInfo.rating || 'N/A'}</p>
                    <p>Genre: ${movieInfo.genres || 'N/A'}</p>
                ` : ''}
            </div>
            <div class="movie-buttons">
                <button onclick="playMovie('${movie.path}')">Play</button>
                <button onclick="openDirectory('${movie.path}')">Show in Finder</button>
            </div>
        </div>
    `;
    
    moviesGrid.appendChild(movieCard);
}

function filterMovies() {
    const selectedCategory = categorySelect.value;
    const movieCards = document.querySelectorAll('.movie-card');
    
    movieCards.forEach(card => {
        if (selectedCategory === 'all' || card.dataset.category === selectedCategory) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
}

// Movie actions
async function playMovie(path) {
    await ipcRenderer.invoke('open-movie', path);
}

async function openDirectory(path) {
    await ipcRenderer.invoke('open-directory', path);
}
