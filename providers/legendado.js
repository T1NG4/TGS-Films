// providers/legendado.js - Provider para conteúdo legendado (embeds atuais)

import IStreamProvider from './types.js';

/**
 * Provider para conteúdo legendado usando embeds existentes
 */
export class LegendadoProvider extends IStreamProvider {
    constructor() {
        super('LegendadoEmbed', 100); // Prioridade alta (fallback)
        
        // Fontes de embed existentes
        this.sources = [
            'https://vidsrc.me/embed/movie/',
            'https://2embed.cc/embed/movie/',
            'https://embed.su/embed/movie/',
            'https://www.2embed.cc/embed/movie/',
            'https://v2.vidsrc.me/embed/movie/'
        ];
    }

    /**
     * Obtém stream legendado
     * @param {StreamRequest} request - Requisição de stream
     * @param {StreamOptions} [options] - Opções da requisição
     * @returns {Promise<Stream|null>} Stream encontrado ou null
     */
    async getStream(request, options = {}) {
        const { timeout = 10000 } = options;
        const { tmdbId, imdbId, type } = request;

        // Para séries, precisamos de tratamento diferente
        if (type === 'series') {
            return this.getSeriesStream(request, options);
        }

        const id = imdbId || tmdbId;
        if (!id) {
            throw new Error('ID do filme não fornecido');
        }

        // Tentar cada fonte em ordem
        for (const baseUrl of this.sources) {
            try {
                const url = `${baseUrl}${id}`;
                console.log(`Legendado: testando ${url}`);
                
                // Verificar se URL está acessível
                const isAccessible = await this.checkUrlAccessible(url, timeout);
                if (isAccessible) {
                    return {
                        url,
                        format: 'embed',
                        sourceName: this.name,
                        isDubbed: false // Legendado por padrão
                    };
                }
            } catch (error) {
                console.warn(`Fonte ${baseUrl} falhou:`, error.message);
                continue;
            }
        }

        // Tentar VidSrc com IMDb ID como fallback
        if (imdbId) {
            try {
                const url = `https://vidsrc.to/embed/movie/${imdbId}`;
                const isAccessible = await this.checkUrlAccessible(url, timeout);
                if (isAccessible) {
                    return {
                        url,
                        format: 'embed',
                        sourceName: this.name,
                        isDubbed: false
                    };
                }
            } catch (error) {
                console.warn('Fallback VidSrc falhou:', error.message);
            }
        }

        return null;
    }

    /**
     * Obtém stream para séries
     * @private
     */
    async getSeriesStream(request, options = {}) {
        const { tmdbId, imdbId, season, episode } = request;
        
        if (!season || !episode) {
            throw new Error('Temporada e episódio são obrigatórios para séries');
        }

        const id = imdbId || tmdbId;
        if (!id) {
            throw new Error('ID da série não fornecido');
        }

        // Fontes para séries
        const seriesSources = [
            `https://vidsrc.me/embed/tv/${id}/${season}/${episode}`,
            `https://2embed.cc/embed/tv/${id}/${season}/${episode}`,
            `https://embed.su/embed/tv/${id}/${season}/${episode}`,
            `https://vidsrc.to/embed/tv/${id}/${season}/${episode}`
        ];

        for (const url of seriesSources) {
            try {
                const isAccessible = await this.checkUrlAccessible(url, options.timeout);
                if (isAccessible) {
                    return {
                        url,
                        format: 'embed',
                        sourceName: this.name,
                        isDubbed: false
                    };
                }
            } catch (error) {
                console.warn(`Fonte série ${url} falhou:`, error.message);
                continue;
            }
        }

        return null;
    }

    /**
     * Verifica se URL está acessível
     * @private
     */
    async checkUrlAccessible(url, timeout = 10000) {
        try {
            const response = await fetch(url, {
                method: 'HEAD',
                mode: 'no-cors',
                signal: AbortSignal.timeout(timeout)
            });
            return true;
        } catch (error) {
            // Em modo no-cors, erros são esperados
            // Consideramos acessível se não for erro de rede
            return !error.name.includes('AbortError') && !error.name.includes('NetworkError');
        }
    }

    /**
     * Teste de conexão
     * @protected
     */
    async testConnection() {
        const testUrl = `${this.sources[0]}tt1234567`; // ID de teste
        await this.checkUrlAccessible(testUrl, 5000);
    }

    /**
     * Verifica se suporta a requisição
     * @param {StreamRequest} request - Requisição de stream
     * @returns {boolean} Se suporta
     */
    supports(request) {
        // Suporta filmes e séries
        return ['movie', 'series'].includes(request.type);
    }
}

export default LegendadoProvider;
