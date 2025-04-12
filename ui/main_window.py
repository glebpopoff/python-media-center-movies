from PyQt6.QtWidgets import (QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
                             QPushButton, QLineEdit, QComboBox, QLabel,
                             QScrollArea, QFileDialog, QMessageBox, QTabWidget,
                             QApplication, QGridLayout)
from PyQt6.QtCore import Qt, QThread, pyqtSignal
from PyQt6.QtGui import QPixmap, QIcon
import os
from pathlib import Path
from typing import Dict, List
import json
import subprocess
from sys import platform

from core.scanner import MovieScanner
from core.imdb import IMDBFetcher

class ScanWorker(QThread):
    progress = pyqtSignal(dict)
    finished = pyqtSignal()

    def __init__(self, scanner: MovieScanner, imdb: IMDBFetcher, 
                 category_dir: str, force_update: bool):
        super().__init__()
        self.scanner = scanner
        self.imdb = imdb
        self.category_dir = category_dir
        self.force_update = force_update
        self.is_running = True

    def quit(self):
        self.is_running = False
        super().quit()

    def run(self):
        try:
            movies = self.scanner.scan_directory(self.category_dir)
            for movie in movies:
                if not self.is_running:
                    break
                # Try to get cached info first
                cached_info = self.imdb.get_cached_info(movie['name'])
                if cached_info:
                    movie.update(cached_info)
                elif self.force_update:
                    # Only fetch from IMDB if force_update is True
                    info = self.imdb.get_movie_info(movie['name'], True)
                    if info:
                        movie.update(info)
                # Emit progress regardless of whether we have IMDB info
                self.progress.emit(movie)
            if self.is_running:
                self.finished.emit()
        except Exception as e:
            print(f"Error in ScanWorker: {str(e)}")
            self.finished.emit()

class MainWindow(QMainWindow):
    def __init__(self):
        self.scan_worker = None
        super().__init__()
        
        # Set window title and icon
        self.setWindowTitle("Movie Directory")
        self.setMinimumSize(800, 600)
        
        icon_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'assets', 'icon.svg')
        if os.path.exists(icon_path):
            icon = QIcon(icon_path)
            self.setWindowIcon(icon)
            # Set the app icon for the dock (macOS)
            if hasattr(Qt.ApplicationAttribute, 'AA_UseHighDpiPixmaps'):
                QApplication.setAttribute(Qt.ApplicationAttribute.AA_UseHighDpiPixmaps)

        # Initialize core components
        self.tmp_dir = Path("/tmp/movie_directory")
        self.tmp_dir.mkdir(parents=True, exist_ok=True)
        
        self.cache_dir = Path.home() / ".cache" / "movie_directory"
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        self.scanner = MovieScanner()
        self.imdb = IMDBFetcher(self.cache_dir, self.tmp_dir)
        
        self.config_file = Path.home() / ".config" / "movie_directory" / "config.json"
        self.config_file.parent.mkdir(parents=True, exist_ok=True)
        
        self.load_config()
        self.setup_ui()
        
        # Load categories if base directory is set
        if self.base_directory:
            self.load_categories()

    def load_config(self):
        self.config = {
            'base_directory': '',
            'categories': {}
        }
        if self.config_file.exists():
            try:
                with open(self.config_file, 'r') as f:
                    self.config = json.load(f)
            except:
                pass
        self.base_directory = self.config.get('base_directory', '')
        self.categories = self.config.get('categories', {})

    def save_config(self):
        self.config['base_directory'] = self.base_directory
        self.config['categories'] = self.categories
        with open(self.config_file, 'w') as f:
            json.dump(self.config, f)

    def setup_ui(self):
        # Main widget and layout
        main_widget = QWidget()
        self.setCentralWidget(main_widget)
        layout = QVBoxLayout(main_widget)

        # Create tab widget
        self.tab_widget = QTabWidget()
        layout.addWidget(self.tab_widget)

        # Movies tab
        movies_tab = QWidget()
        movies_layout = QVBoxLayout(movies_tab)

        # Top controls
        top_controls = QHBoxLayout()
        
        # Category selection
        self.category_combo = QComboBox()
        self.category_combo.setMinimumWidth(200)
        self.update_category_combo()
        top_controls.addWidget(QLabel("Category:"))
        top_controls.addWidget(self.category_combo)

        # Search box
        self.search_box = QLineEdit()
        self.search_box.setPlaceholderText("Search movies...")
        self.search_box.textChanged.connect(self.filter_movies)
        top_controls.addWidget(self.search_box)

        # Scan button
        self.scan_btn = QPushButton("Scan")
        self.scan_btn.clicked.connect(lambda: self.scan_directory(force_update=True))
        top_controls.addWidget(self.scan_btn)

        movies_layout.addLayout(top_controls)

        # Movies area
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setMinimumHeight(400)
        
        movies_container = QWidget()
        movies_container.setStyleSheet("QWidget { background-color: #f5f5f5; }")
        
        self.movies_widget = QWidget()
        self.movies_widget.setStyleSheet("QWidget { background-color: #f5f5f5; }")
        
        # Use QGridLayout instead of QVBoxLayout
        self.movies_layout = QGridLayout(self.movies_widget)
        self.movies_layout.setSpacing(10)
        self.movies_layout.setContentsMargins(10, 10, 10, 10)
        self.current_row = 0
        self.current_col = 0
        
        container_layout = QVBoxLayout(movies_container)
        container_layout.addWidget(self.movies_widget)
        container_layout.addStretch()
        
        scroll.setWidget(movies_container)
        movies_layout.addWidget(scroll)

        self.tab_widget.addTab(movies_tab, "Movies")

        # Settings tab
        settings_tab = QWidget()
        settings_layout = QVBoxLayout(settings_tab)

        # Base directory selection
        base_dir_layout = QHBoxLayout()
        self.base_dir_input = QLineEdit(self.base_directory)
        self.base_dir_input.setReadOnly(True)
        base_dir_layout.addWidget(QLabel("Base Directory:"))
        base_dir_layout.addWidget(self.base_dir_input)

        select_dir_btn = QPushButton("Select Directory")
        select_dir_btn.clicked.connect(self.select_base_directory)
        base_dir_layout.addWidget(select_dir_btn)

        settings_layout.addLayout(base_dir_layout)
        settings_layout.addStretch()

        self.tab_widget.addTab(settings_tab, "Settings")

    def update_category_combo(self):
        self.category_combo.clear()
        self.category_combo.addItems(self.categories.keys())
        self.category_combo.currentTextChanged.connect(self.category_changed)

    def select_base_directory(self):
        dir_path = QFileDialog.getExistingDirectory(self, "Select Base Directory")
        if dir_path:
            self.base_directory = dir_path
            self.base_dir_input.setText(dir_path)
            self.save_config()
            self.load_categories()

    def load_categories(self):
        self.categories = {}
        try:
            base_path = Path(self.base_directory)
            for item in base_path.iterdir():
                if item.is_dir():
                    self.categories[item.name] = str(item)
            self.update_category_combo()
        except Exception as e:
            QMessageBox.warning(self, "Error", f"Error loading categories: {str(e)}")

    def category_changed(self, category):
        if not category:
            return
        print(f"Category changed to: {category}")
        self.clear_movies()
        if category in self.categories:
            print(f"Scanning directory: {self.categories[category]}")
            self.scan_directory()

    def scan_directory(self, force_update=False):
        category = self.category_combo.currentText()
        if not category or category not in self.categories:
            return

        self.scan_btn.setEnabled(False)
        self.clear_movies()

        # Clean up previous worker if it exists
        if self.scan_worker is not None:
            self.scan_worker.quit()
            self.scan_worker.wait()

        try:
            self.scan_worker = ScanWorker(
                self.scanner, 
                self.imdb, 
                self.categories[category],
                force_update
            )
            self.scan_worker.progress.connect(self.add_movie)
            self.scan_worker.finished.connect(self.on_scan_finished)
            self.scan_worker.start()
        except Exception as e:
            print(f"Error starting scan: {str(e)}")
            self.scan_btn.setEnabled(True)

    def on_scan_finished(self):
        self.scan_btn.setEnabled(True)
        # Clean up the worker
        if self.scan_worker is not None:
            self.scan_worker.quit()
            self.scan_worker.wait()
            self.scan_worker = None

    def add_movie(self, movie_info: Dict):
        print(f"Adding movie to UI: {movie_info['name']}")
        try:
            movie_widget = QWidget()
            movie_layout = QHBoxLayout(movie_widget)

            # Set a fixed height for the movie widget
            movie_widget.setMinimumHeight(160)
            movie_widget.setMaximumHeight(160)

            # Add a border and background
            movie_widget.setStyleSheet(
                "QWidget { background-color: white; border: 1px solid #ddd; border-radius: 5px; margin: 2px; }"
            )

            # Thumbnail
            thumbnail_label = QLabel()
            thumbnail_label.setFixedSize(100, 150)
            thumbnail_path = self.imdb.get_cached_thumbnail_path(movie_info['name'])
            if thumbnail_path:
                pixmap = QPixmap(thumbnail_path)
                thumbnail_label.setPixmap(pixmap.scaled(100, 150, Qt.AspectRatioMode.KeepAspectRatio))
            else:
                # Set a placeholder with movie name
                thumbnail_label.setStyleSheet(
                    "QLabel { background-color: #eee; border: 1px solid #ddd; }"
                )
                placeholder_label = QLabel(movie_info['name'])
                placeholder_label.setWordWrap(True)
                placeholder_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
                placeholder_layout = QVBoxLayout(thumbnail_label)
                placeholder_layout.addWidget(placeholder_label)
            movie_layout.addWidget(thumbnail_label)

            # Movie info
            info_layout = QVBoxLayout()
            info_layout.setSpacing(2)
            info_layout.setContentsMargins(10, 5, 10, 5)

            # Always show the directory name
            dir_label = QLabel(f"Directory: {movie_info['name']}")
            dir_label.setStyleSheet("color: gray; font-size: 12px;")
            info_layout.addWidget(dir_label)

            # Show IMDB info if available
            if 'title' in movie_info:
                title_label = QLabel(f"Title: {movie_info['title']}")
                title_label.setStyleSheet("font-weight: bold; font-size: 14px;")
                info_layout.addWidget(title_label)

                if 'year' in movie_info:
                    year_label = QLabel(f"Year: {movie_info['year']}")
                    info_layout.addWidget(year_label)

                if 'rating' in movie_info:
                    rating_label = QLabel(f"Rating: {movie_info['rating']}")
                    info_layout.addWidget(rating_label)
                    
                if 'cached_at' in movie_info:
                    cached_label = QLabel(f"IMDB info cached: {movie_info['cached_at'].split('T')[0]}")
                    cached_label.setStyleSheet("color: gray; font-size: 10px;")
                    info_layout.addWidget(cached_label)
            else:
                status_label = QLabel("IMDB info not cached")
                status_label.setStyleSheet("color: gray; font-style: italic; font-size: 12px;")
                info_layout.addWidget(status_label)

            # Add a Fetch IMDB button if no cached data
            if 'title' not in movie_info:
                fetch_btn = QPushButton("Fetch from IMDB")
                fetch_btn.setMaximumWidth(150)
                # Use lambda to pass both movie name and button instance
                fetch_btn.clicked.connect(
                    lambda checked, btn=fetch_btn: self.fetch_movie_info(movie_info['name'], btn)
                )
                info_layout.addWidget(fetch_btn)

            # Add Play button if movie file exists
            if movie_info.get('movie_file'):
                play_btn = QPushButton("Play")
                play_btn.setMaximumWidth(100)
                play_btn.setStyleSheet(
                    "QPushButton { background-color: #2ecc71; color: white; padding: 5px; border-radius: 3px; }"
                    "QPushButton:hover { background-color: #27ae60; }"
                )
                play_btn.clicked.connect(lambda: self.play_movie(movie_info['movie_file']))
                info_layout.addWidget(play_btn)

            movie_layout.addLayout(info_layout)
            movie_layout.addStretch()

            # Add to grid layout
            self.movies_layout.addWidget(movie_widget, self.current_row, self.current_col)
            movie_widget.setProperty('movie_name', movie_info['name'].lower())
            
            # Update grid position
            self.current_col = (self.current_col + 1) % 2
            if self.current_col == 0:
                self.current_row += 1
            
            # Force the layout to update
            self.movies_layout.update()
            self.movies_widget.update()
            
            print(f"Successfully added movie widget for: {movie_info['name']}")
            
        except Exception as e:
            print(f"Error adding movie to UI: {str(e)}")

    def clear_movies(self):
        # Clear grid layout
        for i in reversed(range(self.movies_layout.count())):
            child = self.movies_layout.itemAt(i)
            if child.widget():
                child.widget().deleteLater()
        # Reset grid position
        self.current_row = 0
        self.current_col = 0

    def fetch_movie_info(self, movie_name: str, fetch_button: QPushButton = None):
        """Fetch IMDB info for a single movie."""
        if fetch_button:
            fetch_button.setEnabled(False)
            fetch_button.setText("Fetching...")

        try:
            info = self.imdb.get_movie_info(movie_name, force_update=True)
            if info:
                # Find and update the existing movie widget
                for i in range(self.movies_layout.count()):
                    widget = self.movies_layout.itemAt(i).widget()
                    if widget and widget.property('movie_name') == movie_name.lower():
                        # Remove the old widget
                        widget.deleteLater()
                        self.movies_layout.removeWidget(widget)
                        # Add updated movie widget
                        movie_info = {'name': movie_name}
                        movie_info.update(info)
                        self.add_movie(movie_info)
                        break
            else:
                if fetch_button:
                    fetch_button.setText("Retry Fetch")
                    fetch_button.setEnabled(True)

        except Exception as e:
            print(f"Error fetching movie info: {str(e)}")
            if fetch_button:
                fetch_button.setText("Retry Fetch")
                fetch_button.setEnabled(True)

    def play_movie(self, movie_file: str):
        """Launch VLC to play the movie file."""
        try:
            # Determine VLC path based on platform
            if platform == "darwin":  # macOS
                vlc_path = "/Applications/VLC.app/Contents/MacOS/VLC"
            elif platform == "win32":  # Windows
                vlc_path = r"C:\Program Files\VideoLAN\VLC\vlc.exe"
            else:  # Linux and others
                vlc_path = "vlc"

            if platform == "darwin" and not os.path.exists(vlc_path):
                QMessageBox.warning(self, "VLC Not Found", 
                    "Please install VLC from https://www.videolan.org/vlc/")
                return

            print(f"Playing movie: {movie_file}")
            subprocess.Popen([vlc_path, movie_file])

        except Exception as e:
            print(f"Error playing movie: {str(e)}")
            QMessageBox.warning(self, "Error", f"Error playing movie: {str(e)}")

    def filter_movies(self, text):
        text = text.lower()
        for i in range(self.movies_layout.count()):
            item = self.movies_layout.itemAt(i)
            if item and item.widget():
                widget = item.widget()
                movie_name = widget.property('movie_name')
                if movie_name:  # Check if property exists
                    widget.setVisible(text in movie_name)
