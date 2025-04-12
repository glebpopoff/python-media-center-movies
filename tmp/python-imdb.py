try:
                self.log_debug(f"Processing movie: {movie_name}")
                # Search IMDB
                search_url = f"https://www.imdb.com/find?q={quote_plus(movie_name)}&s=tt&ttype=ft"
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Connection': 'keep-alive',
                }
                self.log_debug(f"Searching IMDB: {search_url}")
                response = requests.get(search_url, headers=headers)
                self.log_debug(f"IMDB response status: {response.status_code}")
                
                # Save response for debugging
                debug_file = f"imdb_search_{movie_name}.html"
                with open(debug_file, 'w', encoding='utf-8') as f:
                    f.write(response.text)
                self.log_debug(f"Saved IMDB response to {debug_file}")
                
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Debug HTML structure
                self.log_debug("Looking for movie results...")
                all_results = soup.select('.ipc-metadata-list-summary-item')
                self.log_debug(f"Found {len(all_results)} potential results")
                
                # Find first movie result
                movie_item = soup.select_one('.ipc-metadata-list-summary-item')
                if movie_item:
                    self.log_debug("Found movie on IMDB")
                    self.log_debug(f"Movie item HTML: {movie_item.prettify()}")
                    # Get movie details
                    title_elem = movie_item.select_one('.ipc-metadata-list-summary-item__t')
                    if title_elem:
                        title = title_elem.text.strip()
                        self.log_debug(f"Found title: {title}")
                        
                        # Get movie page URL
                        link = title_elem.get('href')
                        if link:
                            self.log_debug(f"Found movie link: {link}")
                            movie_url = f"https://www.imdb.com{link}"
                            self.log_debug(f"Fetching movie page: {movie_url}")
                            response = requests.get(movie_url, headers=headers)
                            self.log_debug(f"Movie page response status: {response.status_code}")
                            
                            # Save movie page for debugging
                            debug_file = os.path.join('tmp', f"imdb_movie_{movie_name}.html")
                            with open(debug_file, 'w', encoding='utf-8') as f:
                                f.write(response.text)
                            self.log_debug(f"Saved movie page to {debug_file}")
                            
                            movie_soup = BeautifulSoup(response.text, 'html.parser')
                            
                            # Get thumbnail
                            self.log_debug("Looking for poster image...")
                            img_elem = movie_soup.select_one('img.ipc-image')
                            if not img_elem:
                                img_elem = movie_soup.select_one('img[class*="poster"]')
                            
                            if img_elem:
                                self.log_debug(f"Found image element: {img_elem}")
                            
                            if img_elem and 'src' in img_elem.attrs:
                                img_url = img_elem['src']
                                self.log_debug(f"Found thumbnail URL: {img_url}")
                                img_response = requests.get(img_url, headers=headers)
                                img_data = Image.open(io.BytesIO(img_response.content))
                                img_data.thumbnail((200, 300))
                                self.log_debug("Successfully downloaded and processed thumbnail")
                                
                                # Get rating
                                rating_elem = movie_soup.select_one('span[data-testid="aggregate-rating__score"]')
                                rating = '0.0'
                                if rating_elem:
                                    rating = rating_elem.text.strip()
                                    # Convert to single decimal format if needed
                                    try:
                                        rating = f"{float(rating):.1f}"
                                    except ValueError:
                                        pass
                                    self.log_debug(f"Found rating: {rating}")
                                
                                # Get year
                                year_elem = movie_soup.select_one('a[href*="releaseinfo"]')
                                year = 'N/A'
                                if year_elem:
                                    year = year_elem.text.strip()
                                    self.log_debug(f"Found year: {year}")
                                
                                # Store movie data
                                movie_info = {
                                    'title': title,
                                    'thumbnail': ImageTk.PhotoImage(img_data),
                                    'thumbnail_url': img_url,  # Store URL for caching
                                    'path': movie_path,
                                    'rating': rating,
                                    'year': year
                                }
                                self.movies[movie_path] = movie_info
                                
                                # Cache the movie information
                                self.save_movie_info(movie_path, movie_info)
                                
                                # Add thumbnail to UI in main thread
                                self.after(0, self.add_thumbnail, movie_path)
                
            except Exception as e:
                error_msg = f"Error processing {movie_name}: {str(e)}"
                self.log_debug(f"ERROR: {error_msg}")
                print(error_msg)