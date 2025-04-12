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

// Check for default directory and load categories
if (!config.defaultDirectory) {
    const selectButton = document.createElement('button');
    selectButton.className = 'action-button';
    selectButton.innerHTML = 'Select Movies Directory';
    selectButton.onclick = async () => {
        const directory = await ipcRenderer.invoke('select-directory');
        if (directory) {
            config.defaultDirectory = directory;
            store.set('defaultDirectory', directory);
            updateCategories(directory);
        }
    };
    moviesGrid.innerHTML = '';
    moviesGrid.appendChild(selectButton);
} else {
    console.log('Loading categories from:', config.defaultDirectory);
    updateCategories(config.defaultDirectory);
}

// Function to update categories dropdown
async function updateCategories(directory) {
    try {
        if (!directory) {
            console.warn('No directory provided to updateCategories');
            moviesGrid.innerHTML = '<div class="error">Please select a movies directory</div>';
            return;
        }

        console.log('Updating categories for directory:', directory);
        
        // Clear existing options first
        categorySelect.innerHTML = '';
        
        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select a category';
        categorySelect.appendChild(defaultOption);

        // Get categories
        let categories = [];
        try {
            categories = await ipcRenderer.invoke('get-categories', directory);
            console.log('Received categories:', categories);
            
            // Ensure categories is an array
            if (!Array.isArray(categories)) {
                console.warn('Categories is not an array:', categories);
                categories = [];
            }
        } catch (err) {
            console.error('Error getting categories:', err);
            moviesGrid.innerHTML = '<div class="error">Error loading categories: ' + err.message + '</div>';
            return;
        }

        // Update cache
        categoriesCache = categories;

        // Handle no categories
        if (categories.length === 0) {
            moviesGrid.innerHTML = '<div class="no-movies">No categories found. Add some movie directories to your configured folder.</div>';
            return;
        }

        // Add categories to dropdown
        categories.forEach(category => {
            if (typeof category === 'string') {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                categorySelect.appendChild(option);
            }
        });

        // Try to select a category
        const lastCategory = store.get('lastCategory');
        if (lastCategory && categories.includes(lastCategory)) {
            categorySelect.value = lastCategory;
            await displayDirectoryContent(lastCategory);
        } else if (categories.length > 0) {
            categorySelect.value = categories[0];
            await displayDirectoryContent(categories[0]);
        }
    } catch (error) {
        console.error('Error updating categories:', error);
        moviesGrid.innerHTML = '<div class="error">Error loading categories: ' + error.message + '</div>';
    }
}

// Function to filter movies by name
function filterMovies(movies, filterText = '') {
    console.log('Filtering movies with text:', filterText);
    
    // Ensure movies is an array
    if (!Array.isArray(movies)) {
        console.warn('Movies is not an array:', movies);
        return [];
    }

    // If no filter text, return all movies
    if (!filterText) {
        return movies;
    }

    // Filter movies by name
    const searchText = filterText.toLowerCase().trim();
    const filtered = movies.filter(movie => {
        if (!movie || typeof movie.name !== 'string') {
            console.warn('Invalid movie object:', movie);
            return false;
        }
        return movie.name.toLowerCase().includes(searchText);
    });

    console.log(`Found ${filtered.length} movies matching "${searchText}"`);
    return filtered;
}

// Function to display movie folders
async function displayDirectoryContent(category, filterText = '') {
    console.log('Displaying content for:', { category, filterText });
    moviesGrid.innerHTML = '<div class="loading">Loading...</div>';

    try {
        if (!category) {
            moviesGrid.innerHTML = '<div class="no-movies">Please select a category</div>';
            return;
        }

        if (!config.defaultDirectory) {
            moviesGrid.innerHTML = '<div class="error">No root directory configured</div>';
            return;
        }

        store.set('lastCategory', category);
        const categoryPath = path.join(config.defaultDirectory, category);
        console.log('Fetching movies from:', categoryPath);

        let movieFolders = [];
        try {
            movieFolders = await ipcRenderer.invoke('get-movie-folders', categoryPath);
            console.log('Received movie folders:', movieFolders);
        } catch (err) {
            console.error('Error getting movie folders:', err);
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error';
            errorDiv.textContent = 'Error loading movies: ' + err.message;
            moviesGrid.appendChild(errorDiv);
            return;
        }

        // Ensure movieFolders is an array
        if (!Array.isArray(movieFolders)) {
            console.warn('Movie folders is not an array:', movieFolders);
            movieFolders = [];
        }

        // Clear the grid and initialize controls
        moviesGrid.innerHTML = '';
        
        // Create controls first
        const controls = document.createElement('div');
        controls.className = 'movie-controls';
        
        // Always add filter box
        const filterBox = document.createElement('input');
        filterBox.type = 'text';
        filterBox.placeholder = 'Filter movies...';
        filterBox.value = filterText || '';
        filterBox.className = 'movie-filter';
        filterBox.oninput = (e) => displayDirectoryContent(category, e.target.value);
        controls.appendChild(filterBox);
        
        // Add controls to grid
        moviesGrid.appendChild(controls);

        // Add download button if we have movies
        if (movieFolders.length > 0) {
            const downloadButton = document.createElement('button');
            downloadButton.className = 'action-button';
            downloadButton.innerHTML = '<i class="fas fa-download"></i> Download All Posters';
            controls.appendChild(downloadButton);

            const progress = document.createElement('progress');
            progress.style.display = 'none';
            progress.max = 100;
            progress.value = 0;
            controls.appendChild(progress);

            downloadButton.onclick = async () => {
                try {
                    downloadButton.disabled = true;
                    progress.style.display = 'block';
                    progress.value = 0;
                    
                    const moviesToProcess = filterMovies(movieFolders, filterText);
                    const total = moviesToProcess.length;
                    let completed = 0;
                    
                    for (const movie of moviesToProcess) {
                        try {
                            await ipcRenderer.invoke('fetch-poster', {
                                folderName: movie.name,
                                folderPath: movie.path,
                                forceRefetch: true
                            });
                        } catch (err) {
                            console.error(`Error fetching poster for ${movie.name}:`, err);
                        }
                        
                        completed++;
                        progress.value = (completed / total) * 100;
                    }
                    
                    // Refresh the display
                    await displayDirectoryContent(category, filterText);
                } catch (error) {
                    console.error('Error in batch download:', error);
                    alert('Error downloading posters: ' + error.message);
                } finally {
                    downloadButton.disabled = false;
                    progress.style.display = 'none';
                }
            };
        }

        // Filter and create grid container
        const gridContainer = document.createElement('div');
        gridContainer.className = 'movies-container';
        moviesGrid.appendChild(gridContainer);

        // Filter movies
        const filteredMovies = filterMovies(movieFolders, filterText);
        
        // Show appropriate message if no movies
        if (filteredMovies.length === 0) {
            const noMovies = document.createElement('div');
            noMovies.className = 'no-movies';
            noMovies.textContent = movieFolders.length === 0 ? 
                'No movies found in this category' : 
                'No matching movies found';
            gridContainer.appendChild(noMovies);
            return;
        }

        // Display movies
        filteredMovies.forEach(movie => {
            const movieCard = document.createElement('div');
            movieCard.className = 'movie-card';
            
            // Create thumbnail container
            const thumbnailContainer = document.createElement('div');
            thumbnailContainer.className = 'thumbnail-container';
            
            // Create thumbnail
            const thumbnail = document.createElement('img');
            thumbnail.className = 'movie-thumbnail';
            if (movie.posterPath) {
                thumbnail.src = `file://${movie.posterPath}`;
            } else {
                thumbnail.src = '../assets/placeholder.png';
            }
            thumbnailContainer.appendChild(thumbnail);
            
            // Create movie info
            const movieInfo = document.createElement('div');
            movieInfo.className = 'movie-info';
            movieInfo.innerHTML = `<div class="movie-title">${movie.name}</div>`;
            
            // Create actions container
            const actions = document.createElement('div');
            actions.className = 'movie-actions';
            
            // Create poster button
            const posterButton = document.createElement('button');
            posterButton.className = movie.posterPath ? 'action-button poster fetched' : 'action-button poster';
            posterButton.innerHTML = '<i class="fas fa-image"></i>';
            posterButton.onclick = async () => {
                try {
                    posterButton.className = 'action-button poster loading';
                    posterButton.disabled = true;

                    const result = await ipcRenderer.invoke('fetch-poster', {
                        folderName: movie.name,
                        folderPath: movie.path,
                        forceRefetch: true
                    });

                    if (result && result.posterPath) {
                        thumbnail.src = `file://${result.posterPath}?t=${Date.now()}`;
                        posterButton.className = 'action-button poster fetched';
                    }
                } catch (error) {
                    console.error('Error fetching poster:', error);
                    posterButton.className = 'action-button poster error';
                    alert('Error fetching poster: ' + error.message);
                } finally {
                    posterButton.disabled = false;
                }
            };
            actions.appendChild(posterButton);
            
            // Create finder button
            const finderButton = document.createElement('button');
            finderButton.className = 'action-button finder';
            finderButton.innerHTML = '<i class="fas fa-folder-open"></i>';
            finderButton.onclick = () => ipcRenderer.invoke('open-in-finder', movie.path);
            actions.appendChild(finderButton);
            
            // Create play button
            const playButton = document.createElement('button');
            playButton.className = 'action-button play';
            playButton.innerHTML = '<i class="fas fa-play"></i>';
            playButton.onclick = () => ipcRenderer.invoke('play-in-vlc', movie.path);
            actions.appendChild(playButton);
            
            // Assemble movie card
            movieCard.appendChild(thumbnailContainer);
            movieCard.appendChild(movieInfo);
            movieCard.appendChild(actions);
            
            gridContainer.appendChild(movieCard);
        });

    } catch (error) {
        console.error('Error displaying directory content:', error);
        moviesGrid.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    }
}

// Helper functions for actions
async function fetchPoster(movieName, moviePath) {
    try {
        return await ipcRenderer.invoke('fetch-poster', {
            folderName: movieName,
            folderPath: moviePath
        });
    } catch (error) {
        console.error('Error fetching poster:', error);
        throw error;
    }
}

async function playInVLC(moviePath) {
    if (!moviePath) {
        alert('No movie file found in this directory');
        return;
    }

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
        if (!directory) {
            console.warn('No directory provided to scanDirectory');
            return;
        }

        moviesGrid.innerHTML = '<div class="loading">Scanning directory and fetching movie information...</div>';

        // Update categories first
        await updateCategories(directory);

        // Then scan for movies
        const movies = await ipcRenderer.invoke('scan-directory', directory);
        console.log('Scanned movies:', movies);
        
        // Update the default directory in configuration if this was triggered by scan button
        if (!config.defaultDirectory) {
            defaultDirectoryInput.value = directory;
            store.set('defaultDirectory', directory);
        }

        // Display current category
        const currentCategory = categorySelect.value;
        if (currentCategory) {
            await displayDirectoryContent(currentCategory);
        }
    } catch (error) {
        console.error('Error scanning directory:', error);
        moviesGrid.innerHTML = '<div class="error">Error scanning directory: ' + error.message + '</div>';
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
    const category = e.target.value;
    store.set('lastCategory', category);
    displayDirectoryContent(category);
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



// Movie actions
async function playMovie(path) {
    await ipcRenderer.invoke('open-movie', path);
}

async function openDirectory(path) {
    await ipcRenderer.invoke('open-directory', path);
}
