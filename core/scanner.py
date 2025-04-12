import os
from pathlib import Path
import logging
from typing import Dict, List, Optional
from datetime import datetime

class MovieScanner:
    def __init__(self):
        self.logger = logging.getLogger('MovieScanner')

    def _setup_logging(self):
        log_file = Path(f"scanner_{datetime.now().strftime('%Y%m%d')}.log")
        logging.basicConfig(
            filename=str(log_file),
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )

    def find_movie_file(self, directory: Path) -> Optional[str]:
        """Find the first movie file in the directory."""
        movie_extensions = ('.avi', '.mkv', '.mp4', '.mpeg4', '.mpg4')
        try:
            for file in directory.iterdir():
                if file.is_file() and file.suffix.lower() in movie_extensions:
                    return str(file)
        except Exception as e:
            self.logger.error(f"Error finding movie file in {directory}: {str(e)}")
        return None

    def scan_directory(self, category_dir: str) -> List[Dict[str, str]]:
        """Scan a directory for movie folders."""
        movies = []
        category_path = Path(category_dir)
        
        if not category_path.exists():
            self.logger.error(f"Directory does not exist: {category_dir}")
            print(f"Directory does not exist: {category_dir}")
            return movies

        try:
            self.logger.info(f"Scanning directory: {category_dir}")
            print(f"Scanning directory: {category_dir}")
            
            # List all subdirectories in the category directory
            for movie_dir in category_path.iterdir():
                if movie_dir.is_dir():
                    movie_file = self.find_movie_file(movie_dir)
                    movie_info = {
                        'name': movie_dir.name,
                        'path': str(movie_dir),
                        'movie_file': movie_file,
                        'category': category_path.name
                    }
                    movies.append(movie_info)
                    self.logger.info(f"Found movie directory: {movie_dir.name}")
                    print(f"Found movie directory: {movie_dir.name}")
                    if movie_file:
                        self.logger.info(f"Found movie file: {movie_file}")
                        print(f"Found movie file: {movie_file}")

            self.logger.info(f"Found {len(movies)} movies in {category_dir}")
            print(f"Found {len(movies)} movies in {category_dir}")
            
        except Exception as e:
            self.logger.error(f"Error scanning directory {category_dir}: {str(e)}")
            print(f"Error scanning directory {category_dir}: {str(e)}")
        
        return movies
