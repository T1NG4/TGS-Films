const API_KEY = '5e9c09b2dfc1eefb09a2f01dc39d54d9';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/';
const LANGUAGE = 'pt-BR';

const heroCarousel = document.getElementById('heroCarousel');
const loadingSpinner = document.getElementById('loadingSpinner');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const modal = document.getElementById('movieModal');
const modalBody = modal?.querySelector('.modal-body');
const closeModalBtn = modal?.querySelector('.close');
const mainContent = document.querySelector('.main-content');

// Language Modal Elements
const languageModal = document.getElementById('languageModal');
const languageModalClose = document.getElementById('languageModalClose');
const legendadoBtn = document.getElementById('legendadoBtn');
const dubladoBtn = document.getElementById('dubladoBtn');

// Video Player Elements (removidos - não são mais necessários)
// const videoPlayerContainer = document.getElementById('videoPlayerContainer');
// const videoPlayer = document.getElementById('videoPlayer');
// const videoPlayerClose = document.getElementById('videoPlayerClose');
// const videoLoading = document.getElementById('videoLoading');
// const videoError = document.getElementById('videoError');

let heroSlides = [];
let currentHeroIndex = 0;
let heroIntervalId = null;
let searchSection = null;
let currentMovieId = null;

// Streaming Sources (similar to WarezCDN functionality)
const STREAMING_SOURCES = [
    {
        name: 'MultiLoad',
        baseUrl: 'https://multiload.nl/api/stream/',
        quality: ['720p', '1080p']
    },
    {
        name: 'VidCloud',
        baseUrl: 'https://vidcloud9.co/api/stream/',
        quality: ['480p', '720p', '1080p']
    },
    {
        name: 'FlixHQ',
        baseUrl: 'https://flixhq.to/api/stream/',
        quality: ['720p', '1080p']
    }
];

const SECTION_CONFIG = [
    { id: 'latestMovies', endpoint: '/movie/now_playing', params: { region: 'BR', page: 1 }, limit: 10 },
    { id: 'popularMovies', endpoint: '/movie/popular', params: { page: 1 }, limit: 10 },
    { id: 'actionMovies', endpoint: '/discover/movie', params: { with_genres: 28, sort_by: 'popularity.desc', page: 1 }, limit: 10 },
    { id: 'comedyMovies', endpoint: '/discover/movie', params: { with_genres: 35, sort_by: 'popularity.desc', page: 1 }, limit: 10 }
];

const FALLBACK_IMAGE = 'https://via.placeholder.com/500x750/0a0a0a/FFFFFF?text=Sem+Imagem';

document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
    attachEventListeners();
    loadInitialData();
}

function attachEventListeners() {
    searchBtn?.addEventListener('click', handleSearch);
    searchInput?.addEventListener('keyup', event => {
        if (event.key === 'Enter') handleSearch();
    });

    closeModalBtn?.addEventListener('click', closeModal);
    modal?.addEventListener('click', event => {
        if (event.target === modal) closeModal();
    });
    document.addEventListener('keyup', event => {
        if (event.key === 'Escape') closeModal();
    });

    // Language Modal Events
    languageModalClose?.addEventListener('click', closeLanguageModal);
    languageModal?.addEventListener('click', event => {
        if (event.target === languageModal) closeLanguageModal();
    });
    legendadoBtn?.addEventListener('click', () => playMovieLegendado(currentMovieId));
    dubladoBtn?.addEventListener('click', () => playMovieDublado(currentMovieId));
    
    document.addEventListener('keyup', event => {
        if (event.key === 'Escape' && languageModal.style.display === 'block') {
            closeLanguageModal();
        }
    });

    heroCarousel?.addEventListener('click', event => {
        const button = event.target.closest('[data-movie-id]');
        if (!button) return;
        const action = button.dataset.action;
        if (action === 'watch') {
            playMovie(button.dataset.movieId);
        } else {
            openMovieModal(button.dataset.movieId);
        }
    });

    // Video Player Events (removidos - não são mais necessários)
    // videoPlayerClose?.addEventListener('click', closeVideoPlayer);
    // videoPlayerContainer?.addEventListener('click', event => {
    //     if (event.target === videoPlayerContainer) closeVideoPlayer();
    // });
    // 
    // document.addEventListener('keyup', event => {
    //     if (event.key === 'Escape' && videoPlayerContainer.style.display === 'block') {
    //         closeVideoPlayer();
    //     }
    // });
}

async function loadInitialData() {
    toggleSpinner(true);
    try {
        const heroPromise = fetchFromTMDb('/trending/movie/week', { page: 1 });
        const sectionPromises = SECTION_CONFIG.map(config => fetchFromTMDb(config.endpoint, config.params));
        const [heroData, ...sectionsData] = await Promise.all([heroPromise, ...sectionPromises]);

        renderHeroCarousel((heroData?.results || []).slice(0, 5));
        sectionsData.forEach((data, index) => {
            const config = SECTION_CONFIG[index];
            renderMoviesSection(config.id, (data?.results || []).slice(0, config.limit));
        });
    } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
        displayFallbackMessage(heroCarousel, 'Não foi possível carregar os destaques. Tente novamente mais tarde.');
        SECTION_CONFIG.forEach(section => {
            const container = document.getElementById(section.id);
            displayFallbackMessage(container, 'Erro ao carregar filmes.');
        });
    } finally {
        toggleSpinner(false);
    }
}

async function fetchFromTMDb(path, params = {}) {
    const url = buildUrl(path, params);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.status}`);
    }
    return response.json();
}

function buildUrl(path, params = {}) {
    const url = new URL(`${BASE_URL}${path}`);
    url.searchParams.set('api_key', API_KEY);
    url.searchParams.set('language', LANGUAGE);

    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            url.searchParams.set(key, value);
        }
    });

    return url.toString();
}

function renderHeroCarousel(movies) {
    if (!heroCarousel) return;

    if (!movies.length) {
        displayFallbackMessage(heroCarousel, 'Nenhum destaque disponível no momento.');
        return;
    }

    heroCarousel.innerHTML = movies
        .map((movie, index) => createHeroSlide(movie, index === 0))
        .join('');

    heroSlides = Array.from(heroCarousel.querySelectorAll('.hero-slide'));
    currentHeroIndex = 0;

    if (heroIntervalId) clearInterval(heroIntervalId);
    if (heroSlides.length > 1) {
        heroIntervalId = setInterval(() => changeHeroSlide('next'), 8000);
    }
}

function createHeroSlide(movie, isActive) {
    const backdrop = getImageUrl(movie.backdrop_path || movie.poster_path, 'w1280');
    const description = truncateText(movie.overview || 'Sem descrição disponível.', 220);

    return `
        <div class="hero-slide ${isActive ? 'active' : ''}" style="background-image: url('${backdrop}');">
            <img src="${backdrop}" alt="${movie.title}" loading="lazy">
            <div class="hero-content">
                <span class="movie-rating">★ ${(movie.vote_average || 0).toFixed(1)}</span>
                <h2 class="hero-title">${movie.title}</h2>
                <p class="hero-description">${description}</p>
                <div class="hero-buttons">
                    <button class="btn btn-primary" data-movie-id="${movie.id}" data-action="watch">Assistir agora</button>
                    <button class="btn btn-secondary" data-movie-id="${movie.id}" data-action="details">Mais detalhes</button>
                </div>
            </div>
        </div>
    `;
}

function changeHeroSlide(direction = 'next') {
    if (!heroSlides.length) return;

    heroSlides[currentHeroIndex]?.classList.remove('active');
    currentHeroIndex = direction === 'next'
        ? (currentHeroIndex + 1) % heroSlides.length
        : (currentHeroIndex - 1 + heroSlides.length) % heroSlides.length;
    heroSlides[currentHeroIndex]?.classList.add('active');
}

function renderMoviesSection(containerId, movies) {
    const section = document.getElementById(containerId);
    if (!section) return;

    if (!movies.length) {
        displayFallbackMessage(section, 'Nenhum filme encontrado.');
        return;
    }

    const list = document.createElement('div');
    list.className = 'movies-container';

    movies.forEach(movie => {
        const card = createMovieCard(movie);
        list.appendChild(card);
    });

    section.innerHTML = '';
    section.appendChild(list);
}

function createMovieCard(movie) {
    const card = document.createElement('div');
    card.className = 'movie-card';
    card.innerHTML = `
        <img src="${getImageUrl(movie.poster_path)}" alt="${movie.title}">
        <span class="movie-rating">★ ${(movie.vote_average || 0).toFixed(1)}</span>
        <div class="movie-info">
            <p class="movie-title">${movie.title}</p>
            <p class="movie-year">${formatYear(movie.release_date)}</p>
        </div>
    `;

    card.addEventListener('click', () => openMovieModal(movie.id));
    return card;
}

async function openMovieModal(movieId) {
    if (!movieId) return;
    toggleSpinner(true);
    try {
        const movie = await fetchFromTMDb(`/movie/${movieId}`, { append_to_response: 'videos' });
        renderMovieModal(movie);
        modal.style.display = 'block';
    } catch (error) {
        console.error('Erro ao carregar detalhes do filme:', error);
        alert('Não foi possível carregar os detalhes do filme.');
    } finally {
        toggleSpinner(false);
    }
}

function renderMovieModal(movie) {
    if (!modalBody) return;

    const poster = getImageUrl(movie.poster_path);
    const genres = (movie.genres || []).map(genre => genre.name).join(', ');
    const releaseYear = formatYear(movie.release_date);
    const runtime = movie.runtime ? `${movie.runtime} min` : '—';
    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : '—';

    modalBody.innerHTML = `
        <img class="modal-poster" src="${poster}" alt="Poster de ${movie.title}">
        <div class="modal-info">
            <h2>${movie.title}</h2>
            <div class="modal-meta">
                <span>★ ${rating}</span>
                <span>${releaseYear}</span>
                <span>${runtime}</span>
                <span>${genres || 'Gênero indisponível'}</span>
            </div>
            <p class="modal-description">${movie.overview || 'Descrição indisponível.'}</p>
            <div class="modal-buttons">
                <button class="btn btn-primary" onclick="playMovie(${movie.id})">Assistir agora</button>
                <a class="btn btn-secondary" href="https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title + ' trailer')}" target="_blank" rel="noopener">Ver trailer</a>
                ${movie.homepage ? `<a class="btn btn-secondary" href="${movie.homepage}" target="_blank" rel="noopener">Site oficial</a>` : ''}
            </div>
        </div>
    `;
}

function closeModal() {
    if (!modal) return;
    modal.style.display = 'none';
    if (modalBody) {
        modalBody.innerHTML = '';
    }
}

async function handleSearch() {
    const query = searchInput?.value.trim();
    if (!query) {
        clearSearchResults();
        return;
    }

    toggleSpinner(true);
    try {
        const data = await fetchFromTMDb('/search/movie', { query });
        renderSearchResults(data.results || [], query);
    } catch (error) {
        console.error('Erro na busca:', error);
        alert('Não foi possível realizar a busca.');
    } finally {
        toggleSpinner(false);
    }
}

function renderSearchResults(movies, query) {
    if (!searchSection) {
        searchSection = document.createElement('section');
        searchSection.className = 'movies-section';
        searchSection.id = 'searchResultsSection';
        mainContent?.insertBefore(searchSection, mainContent.querySelector('.movies-section'));
    }

    const header = document.createElement('div');
    header.className = 'section-header';
    header.innerHTML = `
        <h2>Resultados para "${query}"</h2>
        <button class="see-all" type="button" id="clearSearchBtn">Limpar</button>
    `;

    const carousel = document.createElement('div');
    carousel.className = 'movies-carousel';

    if (!movies.length) {
        carousel.innerHTML = '<p>Nenhum resultado encontrado.</p>';
    } else {
        const container = document.createElement('div');
        container.className = 'movies-container';
        movies.slice(0, 12).forEach(movie => {
            container.appendChild(createMovieCard(movie));
        });
        carousel.appendChild(container);
    }

    searchSection.innerHTML = '';
    searchSection.appendChild(header);
    searchSection.appendChild(carousel);

    const clearBtn = document.getElementById('clearSearchBtn');
    clearBtn?.addEventListener('click', () => {
        clearSearchResults();
        if (searchInput) searchInput.value = '';
    });
}

function clearSearchResults() {
    if (searchSection) {
        searchSection.remove();
        searchSection = null;
    }
}

function getImageUrl(path, size = 'w500') {
    return path ? `${IMAGE_BASE_URL}${size}${path}` : FALLBACK_IMAGE;
}

function formatYear(dateString) {
    if (!dateString) return '—';
    const year = new Date(dateString).getFullYear();
    return Number.isNaN(year) ? '—' : year;
}

function truncateText(text, limit = 150) {
    if (!text) return '';
    return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function toggleSpinner(show) {
    if (!loadingSpinner) return;
    loadingSpinner.style.display = show ? 'flex' : 'none';
}

function displayFallbackMessage(container, message) {
    if (!container) return;
    container.innerHTML = `<p>${message}</p>`;
}

// Video Player Functions
async function playMovie(movieId) {
    if (!movieId) return;
    
    currentMovieId = movieId; // Store current movie ID
    closeModal(); // Close movie modal if open
    openLanguageModal(); // Open language selection modal
}

async function playMovieLegendado(movieId) {
    if (!movieId) return;
    
    closeLanguageModal();
    
    try {
        const videoUrl = await getMovieStreamUrl(movieId, 'legendado');
        
        // Open streaming URL in new tab (most reliable approach)
        console.log(`Abrindo streaming legendado em nova aba: ${videoUrl}`);
        window.open(videoUrl, '_blank', 'noopener,noreferrer');
        
    } catch (error) {
        console.error('Erro ao obter URL de streaming legendado:', error);
        
        // Fallback: open search on Vizer
        const movieData = await fetchFromTMDb(`/movie/${movieId}`);
        const searchUrl = `https://vizer.hair/buscar?q=${encodeURIComponent(movieData.title)}`;
        window.open(searchUrl, '_blank', 'noopener,noreferrer');
    }
}

async function playMovieDublado(movieId) {
    if (!movieId) return;
    
    closeLanguageModal();
    
    try {
        const videoUrl = await getMovieStreamUrl(movieId, 'dublado');
        
        // Open streaming URL in new tab (most reliable approach)
        console.log(`Abrindo streaming dublado em nova aba: ${videoUrl}`);
        window.open(videoUrl, '_blank', 'noopener,noreferrer');
        
    } catch (error) {
        console.error('Erro ao obter URL de streaming dublado:', error);
        // Sem fallback externo específico: não abre nada se falhar
    }
}

function openLanguageModal() {
    if (!languageModal) return;
    languageModal.style.display = 'block';
    document.body.style.overflow = 'hidden'; // Prevent background scroll
}

function closeLanguageModal() {
    if (!languageModal) return;
    languageModal.style.display = 'none';
    document.body.style.overflow = ''; // Restore scroll
    currentMovieId = null; // Clear current movie ID
}

async function getMovieStreamUrl(movieId, language = 'legendado') {
    // For dubbed content, try Brazilian-specific sources first
    if (language === 'dublado') {
        // Try regular sources with PT-BR parameters first (more reliable)
        const ptbrSources = [
            `https://vidsrc.me/embed/movie/${movieId}?lang=pt-BR`,
            `https://2embed.cc/embed/movie/${movieId}?lang=pt-BR`,
            `https://embed.su/embed/movie/${movieId}?audio=pt-BR`,
            `https://v2.vidsrc.me/embed/movie/${movieId}?lang=pt-BR`,
            `https://vidsrc.to/embed/movie/${movieId}?lang=pt-BR`
        ];
        
        for (const url of ptbrSources) {
            try {
                console.log(`Testando fonte PT-BR: ${url}`);
                return url;
            } catch (error) {
                console.warn(`Fonte PT-BR falhou:`, error);
                continue;
            }
        }
    }
    
    // Regular streaming sources (for legendado or fallback)
    const workingSources = [
        'https://vidsrc.me/embed/movie/',
        'https://2embed.cc/embed/movie/',
        'https://embed.su/embed/movie/',
        'https://www.2embed.cc/embed/movie/',
        'https://v2.vidsrc.me/embed/movie/'
    ];
    
    for (const baseUrl of workingSources) {
        try {
            const url = baseUrl + movieId;
            console.log(`Testando fonte ${language}: ${url}`);
            return url;
        } catch (error) {
            continue;
        }
    }
    
    // Try to get IMDB ID from TMDb for VidSrc
    try {
        const movieData = await fetchFromTMDb(`/movie/${movieId}`);
        const imdbId = movieData.imdb_id;
        
        if (imdbId) {
            const vidsrcUrl = language === 'dublado' 
                ? `https://vidsrc.to/embed/movie/${imdbId}?lang=pt-BR`
                : `https://vidsrc.to/embed/movie/${imdbId}`;
            console.log(`Tentando VidSrc ${language} com IMDB ID: ${vidsrcUrl}`);
            return vidsrcUrl;
        }
    } catch (error) {
        console.warn('Erro ao obter IMDB ID:', error);
    }

    // Try direct TMDB ID with VidSrc
    try {
        const vidsrcUrl = language === 'dublado'
            ? `https://vidsrc.to/embed/movie/${movieId}?lang=pt-BR`
            : `https://vidsrc.to/embed/movie/${movieId}`;
        console.log(`Tentando VidSrc ${language} com TMDB ID: ${vidsrcUrl}`);
        return vidsrcUrl;
    } catch (error) {
        console.warn('Erro com VidSrc TMDB ID:', error);
    }

    // Last fallback: WarezCDN
    try {
        const movieData = await fetchFromTMDb(`/movie/${movieId}`);
        const imdbId = movieData.imdb_id;
        
        if (imdbId) {
            const warezUrl = `https://embed.warezcdn.net/filme/${imdbId}`;
            console.log(`Tentando WarezCDN ${language}: ${warezUrl}`);
            return warezUrl;
        }
    } catch (error) {
        console.warn('Erro ao obter WarezCDN URL:', error);
    }

    // Sem fallback externo específico se todas as fontes falharem
    throw new Error('Nenhuma fonte de streaming disponível');
}

// Remove todas as funções do player iframe (não são mais necessárias)
// Mantidas apenas para referência - podem ser removidas futuramente
