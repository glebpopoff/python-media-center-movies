import os
from pathlib import Path
from typing import List, Dict
from datetime import datetime
import logging

class MovieScanner:
    def __init__(self, tmp_dir: str):
        self.tmp_dir = Path(tmp_dir)
        self._setup_logging()
    
    def _setup_logging(self):
        log_file = self.tmp_dir / f"scanner_{datetime.now().strftime('%Y%m%d')}.log"
        logging.basicConfig(
            filename=str(log_file),
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger('MovieScanner')

    def scan_directory(self, category_dir: str) -> List[Dict[str, str]]:
        """
        Scan a category directory for movies.
        Returns a list of dictionaries containing movie information.
        """
        movies = []
        try:
            category_path = Path(category_dir)
            self.logger.info(f"Scanning directory: {category_dir}")
            print(f"Scanning directory: {category_dir}")
            
            if not category_path.exists():
                self.logger.error(f"Directory does not exist: {category_dir}")
                print(f"Directory does not exist: {category_dir}")
                return movies

            for item in category_path.iterdir():
                if item.is_dir():
                    movie_info = {
                        'name': item.name,
                        'path': str(item),
                        'category': category_path.name
                    }
                    movies.append(movie_info)
                    self.logger.info(f"Found movie directory: {item.name}")
                    print(f"Found movie directory: {item.name}")

            self.logger.info(f"Found {len(movies)} movies in {category_dir}")
            print(f"Found {len(movies)} movies in {category_dir}")
            
        except Exception as e:
            self.logger.error(f"Error scanning directory {category_dir}: {str(e)}")
            print(f"Error scanning directory {category_dir}: {str(e)}")
        
        return movies
