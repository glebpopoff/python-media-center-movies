from imdb import IMDb
import requests
from pathlib import Path
import logging
from datetime import datetime
from typing import Dict, Optional
import os

class IMDBFetcher:
    def __init__(self, cache_dir: str, tmp_dir: str):
        self.ia = IMDb()
        self.cache_dir = Path(cache_dir)
        self.tmp_dir = Path(tmp_dir)
        self._setup_logging()
        
        # Create cache directories if they don't exist
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        (self.cache_dir / 'thumbnails').mkdir(exist_ok=True)
        (self.cache_dir / 'metadata').mkdir(exist_ok=True)

    def _setup_logging(self):
        log_file = self.tmp_dir / f"imdb_{datetime.now().strftime('%Y%m%d')}.log"
        logging.basicConfig(
            filename=str(log_file),
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger('IMDBFetcher')

    def is_cached(self, movie_name: str) -> bool:
        """Check if movie information and thumbnail are cached."""
        metadata_file = self.cache_dir / 'metadata' / f"{movie_name}.json"
        thumbnail_file = self.cache_dir / 'thumbnails' / f"{movie_name}.jpg"
        return metadata_file.exists() and thumbnail_file.exists()

    def get_cached_info(self, movie_name: str) -> Optional[Dict]:
        """Get movie information from cache if available."""
        cache_file = self.cache_dir / 'metadata' / f"{movie_name}.json"
        if cache_file.exists():
            try:
                with open(cache_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                self.logger.error(f"Error reading cache for {movie_name}: {str(e)}")
        return None

    def clean_movie_name(self, name: str) -> str:
        """Clean movie name for better IMDB search results."""
        # Remove common file extensions
        name = name.replace('.mp4', '').replace('.mkv', '').replace('.avi', '')
        # Replace dots and underscores with spaces
        name = name.replace('.', ' ').replace('_', ' ')
        # Remove year if present in parentheses
        import re
        name = re.sub(r'\([0-9]{4}\)', '', name)
        return name.strip()

    def get_movie_info(self, movie_name: str, force_update: bool = False) -> Optional[Dict]:
        """
        Get movie information from cache or IMDB.
        If force_update is True, ignore cache and fetch fresh data.
        """
        print(f"Fetching info for movie: {movie_name}")
        
        # Check cache first unless force_update is True
        if not force_update:
            cached_info = self.get_cached_info(movie_name)
            if cached_info:
                print(f"Using cached data for: {movie_name}")
                self.logger.info(f"Using cached data for: {movie_name}")
                return cached_info

        try:
            # Clean up the movie name for better search results
            search_name = self.clean_movie_name(movie_name)
            print(f"Searching IMDB for: {search_name}")
            
            movies = self.ia.search_movie(search_name)
            if not movies:
                print(f"No movies found for: {search_name}")
                self.logger.warning(f"No movies found for: {search_name}")
                return None

            movie = movies[0]
            print(f"Found movie: {movie.get('title')} ({movie.get('year')})")
            
            # Get full movie details
            self.ia.update(movie)

            movie_info = {
                'title': movie.get('title'),
                'year': movie.get('year'),
                'cover_url': movie.get('cover url', ''),
                'plot': movie.get('plot', [''])[0] if movie.get('plot') else '',
                'rating': movie.get('rating', 0.0),
                'cached_at': datetime.now().isoformat(),
            }

            print(f"Got movie info: {movie_info}")

            # Cache the metadata
            cache_file = self.cache_dir / 'metadata' / f"{movie_name}.json"
            with open(cache_file, 'w') as f:
                json.dump(movie_info, f)

            # Download and cache thumbnail
            if movie_info['cover_url']:
                print(f"Downloading thumbnail from: {movie_info['cover_url']}")
                self._download_thumbnail(movie_info['cover_url'], movie_name)

            self.logger.info(f"Cached new data for: {movie_name}")
            return movie_info

        except Exception as e:
            error_msg = f"Error fetching movie info for {movie_name}: {str(e)}"
            print(error_msg)
            self.logger.error(error_msg)
            return None

    def _download_thumbnail(self, url: str, movie_name: str):
        """Download and cache movie thumbnail."""
        thumbnail_path = self.cache_dir / 'thumbnails' / f"{movie_name}.jpg"
        
        try:
            response = requests.get(url)
            response.raise_for_status()
            
            with open(thumbnail_path, 'wb') as f:
                f.write(response.content)
                
            self.logger.info(f"Downloaded thumbnail for: {movie_name}")
            
        except Exception as e:
            self.logger.error(f"Error downloading thumbnail for {movie_name}: {str(e)}")

    def get_cached_thumbnail_path(self, movie_name: str) -> Optional[str]:
        """Get path to cached thumbnail if it exists."""
        thumbnail_path = self.cache_dir / 'thumbnails' / f"{movie_name}.jpg"
        return str(thumbnail_path) if thumbnail_path.exists() else None
