document.addEventListener('DOMContentLoaded', () => {
    const newsContainer = document.getElementById('news-container');
    const errorMessageDiv = document.getElementById('error-message');

    // Replace with your actual NewsAPI.org API key
    const API_KEY = '5b9dc55198084f319b1bb3d2e8ffb8dc';
    const BASE_URL = 'https://newsapi.org/v2';

    // Function to fetch news
    function fetchStockNews(query = 'stock market', pageSize = '10') {
        const apiKeyParam = `apiKey=${API_KEY}`;
          let apiUrl = `${BASE_URL}/everything?q=${encodeURIComponent(query)}&pageSize=${pageSize}&${apiKeyParam}`;
        newsContainer.innerHTML = '';
        errorMessageDiv.classList.add('hidden');

        fetch(apiUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data && data.articles && data.articles.length > 0) {
                    data.articles.forEach(article => {
                        const articleDiv = document.createElement('div');
                        articleDiv.classList.add('article');
                        articleDiv.innerHTML = `
                            <h3><a href="${article.url}" target="_blank">${article.title}</a></h3>
                            <p>${article.description || article.content || 'No description available.'}</p>
                            <small>Published: ${new Date(article.publishedAt).toLocaleString()} Source: ${article.source.name || 'Unknown'}</small>
                        `;
                        newsContainer.appendChild(articleDiv);
                    });
                } else {
                    newsContainer.textContent = 'No news found.';
                }
            })
            .catch(error => {
                console.error('Error fetching news:', error);
                errorMessageDiv.textContent = `Failed to load news: ${error.message}`;
                errorMessageDiv.classList.remove('hidden');
            });
    }

    // Automatically fetch news when the page loads
    fetchStockNews(); // Call the function with default parameters
});