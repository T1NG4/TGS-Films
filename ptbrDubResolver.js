// ptbrDubResolver.js - Módulo para resolver streams dublados PT-BR via Stremio add-ons

const STREMIO_BR_ADDON = 'https://27a5b2bfe3c0-stremio-brazilian-addon.baby-beamup.club';
const TORRENTIO_BASE = 'https://torrentio.strem.fun';

// Chaves de idioma para identificar streams dublados
const LANG_KEYS = ['PT-BR', 'Dublado', 'Português', 'Latino'];

/**
 * Resolve stream dublado PT-BR usando Stremio add-ons
 * @param {Object} args - Argumentos de busca
 * @param {string} args.tmdbId - ID do TMDB
 * @param {string} args.imdbId - ID do IMDb
 * @param {string} args.type - 'movie' ou 'series'
 * @param {number} args.season - Número da temporada (séries)
 * @param {number} args.episode - Número do episódio (séries)
 * @returns {Promise<Object|null>} Stream encontrado ou null
 */
async function resolveDubbedStream({ tmdbId, imdbId, type = 'movie', season, episode }) {
    const id = imdbId || tmdbId;
    if (!id) return null;

    console.log(`Buscando stream dublado para ${type} ID: ${id}`);

    // 1) Tentar add-on brasileiro (rota /stream/{type}/{id}.json)
    try {
        const url = `${STREMIO_BR_ADDON}/stream/${type}/${id}.json`;
        console.log(`Tentando add-on BR: ${url}`);
        
        const response = await fetch(url, { timeout: 10000 });
        const data = await response.json();
        
        const streams = data?.streams || [];
        const dubbed = streams.find(stream => 
            LANG_KEYS.some(key => {
                const title = (stream.title || '').toLowerCase();
                const name = (stream.name || '').toLowerCase();
                return title.includes(key.toLowerCase()) || name.includes(key.toLowerCase());
            })
        );

        if (dubbed && dubbed.url) {
            console.log(`Stream dublado encontrado via add-on BR: ${dubbed.url}`);
            return {
                url: dubbed.url,
                type: dubbed.url.endsWith('.m3u8') ? 'hls' : 'mp4',
                sourceTag: 'Stremio-BR'
            };
        }
    } catch (error) {
        console.warn('Erro ao buscar add-on BR:', error);
    }

    // 2) Fallback via Torrentio (priorizar provedores BR)
    try {
        const url = `${TORRENTIO_BASE}/stream/${type}/${id}.json`;
        console.log(`Tentando Torrentio: ${url}`);
        
        const response = await fetch(url, { timeout: 10000 });
        const data = await response.json();
        
        const streams = data?.streams || [];
        
        // Filtrar streams com idioma PT-BR e ordenar por qualidade
        const dubbedStreams = streams
            .filter(stream => 
                LANG_KEYS.some(key => {
                    const title = (stream.title || '').toLowerCase();
                    const name = (stream.name || '').toLowerCase();
                    const description = (stream.description || '').toLowerCase();
                    return title.includes(key.toLowerCase()) || 
                           name.includes(key.toLowerCase()) || 
                           description.includes(key.toLowerCase());
                })
            )
            .sort((a, b) => {
                // Priorizar qualidade: 1080p > 720p > 480p
                const qualityA = extractQuality(a.description || '');
                const qualityB = extractQuality(b.description || '');
                return qualityB - qualityA;
            });

        if (dubbedStreams.length > 0 && dubbedStreams[0].url) {
            console.log(`Stream dublado encontrado via Torrentio: ${dubbedStreams[0].url}`);
            return {
                url: dubbedStreams[0].url,
                type: dubbedStreams[0].url.endsWith('.m3u8') ? 'hls' : 'mp4',
                sourceTag: 'Torrentio'
            };
        }
    } catch (error) {
        console.warn('Erro ao buscar Torrentio:', error);
    }

    console.log('Nenhum stream dublado encontrado');
    return null;
}

/**
 * Extrai qualidade numérica da descrição (1080p, 720p, etc.)
 * @param {string} description - Descrição do stream
 * @returns {number} Valor numérico da qualidade
 */
function extractQuality(description) {
    const match = description.match(/(\d+)p/);
    return match ? parseInt(match[1]) : 0;
}

/**
 * Verifica se há stream dublado disponível
 * @param {Object} args - Mesmos argumentos de resolveDubbedStream
 * @returns {Promise<boolean>} True se houver dublado disponível
 */
async function hasDubbedStream(args) {
    const stream = await resolveDubbedStream(args);
    return stream !== null;
}

// Exportar funções para uso no script principal
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        resolveDubbedStream,
        hasDubbedStream
    };
} else {
    // Para uso direto no navegador
    window.ptbrDubResolver = {
        resolveDubbedStream,
        hasDubbedStream
    };
}
