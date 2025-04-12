document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('place-search');
    const searchButton = document.getElementById('search-button');
    const loadingIndicator = document.getElementById('loading-indicator');
    const errorMessage = document.getElementById('error-message');
    const resultsContainer = document.getElementById('results-container');
    const originalPlaceContainer = document.getElementById('original-place');
    const similarPlacesGrid = document.getElementById('similar-places-grid');
    
    // Add modal elements to the DOM
    const modalContainer = document.createElement('div');
    modalContainer.className = 'image-modal-container';
    modalContainer.innerHTML = `
        <div class="image-modal">
            <span class="close-modal">&times;</span>
            <img class="modal-image" src="" alt="Place Image">
            <div class="modal-caption"></div>
        </div>
    `;
    document.body.appendChild(modalContainer);
    
    // Modal elements
    const imageModal = document.querySelector('.image-modal-container');
    const modalImage = document.querySelector('.modal-image');
    const modalCaption = document.querySelector('.modal-caption');
    const closeModal = document.querySelector('.close-modal');
    
    // Close modal when clicking the X
    closeModal.addEventListener('click', () => {
        imageModal.style.display = 'none';
    });
    
    // Close modal when clicking outside the image
    imageModal.addEventListener('click', (e) => {
        if (e.target === imageModal) {
            imageModal.style.display = 'none';
        }
    });
    
    // Function to open modal with image
    function openImageModal(imgSrc, caption) {
        modalImage.src = imgSrc;
        modalCaption.textContent = caption;
        imageModal.style.display = 'flex';
    }
    
    // Add event delegation for image clicks
    document.addEventListener('click', (e) => {
        if (e.target.tagName === 'IMG' && 
            (e.target.closest('.original-place-image') || 
             e.target.closest('.place-image'))) {
            openImageModal(e.target.src, e.target.alt);
        }
    });

    // Add event listener for search button
    searchButton.addEventListener('click', searchSimilarPlaces);
    
    // Add event listener for Enter key in search input
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchSimilarPlaces();
        }
    });

    // Function to search for similar places
    async function searchSimilarPlaces() {
        const place = searchInput.value.trim();
        console.log(place);
        
        if (!place) {
            showError('Please enter a place name');
            return;
        }
        
        // Show loading indicator
        loadingIndicator.style.display = 'block';
        errorMessage.style.display = 'none';
        resultsContainer.style.display = 'none';
        
        try {
            // Make API request to get similar places
            const response = await fetch(`/api/get_similar_places/${encodeURIComponent(place)}`, {
                method: 'POST'
            });
            if (!response.ok) {
                throw new Error(`Error: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(data);
            // Hide loading indicator
            loadingIndicator.style.display = 'none';
            
            // Display results
            displayResults(data);
            
        } catch (error) {
            console.error('Error fetching similar places:', error);
            loadingIndicator.style.display = 'none';
            showError('Failed to find similar places. Please try again.');
        }
    }

    // Function to display error message
    function showError(message) {
        errorMessage.querySelector('p').textContent = message;
        errorMessage.style.display = 'block';
        loadingIndicator.style.display = 'none';
        resultsContainer.style.display = 'none';
    }

    // Function to display results
    function displayResults(data) {
        // Clear previous results
        originalPlaceContainer.innerHTML = '';
        similarPlacesGrid.innerHTML = '';
        
        // Display original place (first item in the array)
        const originalPlace = data.place_description;
        if (!originalPlace) {
            showError('No similar places found');
            return; 
        }
        
        // Create HTML for original place with improved styling to match place-card-content
        originalPlaceContainer.innerHTML = `
            <div class="original-place-content">
                <h2>${searchInput.value}</h2>
                <p class="place-description">${data.place_description}</p>
                <div class="place-tags">
                    <span class="user-type-tag"><i class="fas fa-map-marker-alt"></i> ${data.user_type || 'Destination'}</span>
                </div>
            </div>
        `;
        
        // Display similar places
        const similarPlaces = data.similar_places;
        
        if (similarPlaces.length === 0) {
            similarPlacesGrid.innerHTML = '<p class="no-results">No similar places found</p>';
        } else {
            // Create HTML for each similar place
            similarPlaces.forEach(place => {
                const placeCard = document.createElement('div');
                placeCard.className = 'place-card';
                
                // Create things to do list if it's an array
                let thingsToDoHTML = '';
                if (Array.isArray(place.things_to_do)) {
                    thingsToDoHTML = `
                        <ul class="things-list">
                            ${place.things_to_do.map(thing => `<li>${thing}</li>`).join('')}
                        </ul>
                    `;
                } else {
                    thingsToDoHTML = `<p>${place.things_to_do || 'Information not available'}</p>`;
                }
                
                placeCard.innerHTML = `
                    <div class="place-card-content">
                        <h3>${place.name}</h3>
                        <p>${place.description}</p>
                        <div class="things-to-do">
                            <h4>Things to Do:</h4>
                            ${thingsToDoHTML}
                        </div>
                    </div>
                `;
                
                similarPlacesGrid.appendChild(placeCard);
            });
        }
        
        // Show results container
        resultsContainer.style.display = 'block';
        
        // Scroll to results
        resultsContainer.scrollIntoView({ behavior: 'smooth' });
    }

    // Check if URL has a search parameter
    const urlParams = new URLSearchParams(window.location.search);
    const placeParam = urlParams.get('place');
    
    if (placeParam) {
        searchInput.value = placeParam;
        searchSimilarPlaces();
    }
});