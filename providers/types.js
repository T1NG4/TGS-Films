// providers/types.js - Tipos e interfaces para Provider API

/**
 * @typedef {Object} Stream
 * @property {string} url - URL do stream
 * @property {'hls'|'dash'|'embed'} format - Formato do stream
 * @property {AudioTrack[]} [audioTracks] - Trilhas de áudio disponíveis
 * @property {Subtitle[]} [subtitles] - Legendas disponíveis
 * @property {boolean} [isDubbed] - Se o stream tem dublagem PT-BR
 * @property {string} sourceName - Nome do provedor
 */

/**
 * @typedef {Object} AudioTrack
 * @property {string} id - ID da trilha
 * @property {string} lang - Código do idioma (ex: 'pt-BR', 'en-US')
 * @property {string} [name] - Nome da trilha
 * @property {boolean} [isDefault] - Se é trilha padrão
 */

/**
 * @typedef {Object} Subtitle
 * @property {string} lang - Código do idioma
 * @property {string} url - URL da legenda
 * @property {string} [name] - Nome da legenda
 */

/**
 * @typedef {Object} StreamRequest
 * @property {string} [tmdbId] - ID do TMDB
 * @property {string} [imdbId] - ID do IMDb
 * @property {string} [title] - Título do filme
 * @property {number} [year] - Ano de lançamento
 * @property {'movie'|'series'} type - Tipo de conteúdo
 * @property {number} [season] - Temporada (séries)
 * @property {number} [episode] - Episódio (séries)
 */

/**
 * @typedef {Object} StreamOptions
 * @property {'pt-BR'|'en'|'original'} [languagePreference] - Preferência de idioma
 * @property {number} [timeout=10000] - Timeout em ms
 * @property {boolean} [enableCache=true] - Se deve usar cache
 */

/**
 * @typedef {Object} ProviderHealth
 * @property {string} name - Nome do provedor
 * @property {boolean} isOnline - Se está online
 * @property {number} latency - Latência em ms
 * @property {number} successRate - Taxa de sucesso (0-1)
 * @property {Date} lastCheck - Última verificação
 * @property {number} priority - Prioridade (menor = maior prioridade)
 */

/**
 * Interface base para provedores de streaming
 */
export class IStreamProvider {
    /**
     * @param {string} name - Nome do provedor
     * @param {number} priority - Prioridade (menos = mais prioritário)
     */
    constructor(name, priority = 999) {
        this.name = name;
        this.priority = priority;
        this.health = {
            name,
            isOnline: true,
            latency: 0,
            successRate: 1.0,
            lastCheck: new Date(),
            priority
        };
    }

    /**
     * Obtém stream do provedor
     * @param {StreamRequest} request - Requisição de stream
     * @param {StreamOptions} [options] - Opções da requisição
     * @returns {Promise<Stream|null>} Stream encontrado ou null
     */
    async getStream(request, options = {}) {
        throw new Error('getStream deve ser implementado pelo provider');
    }

    /**
     * Verifica se provedor suporta o tipo de conteúdo
     * @param {StreamRequest} request - Requisição de stream
     * @returns {boolean} Se suporta
     */
    supports(request) {
        return true;
    }

    /**
     * Verifica saúde do provedor
     * @returns {Promise<ProviderHealth>} Status atualizado
     */
    async checkHealth() {
        const start = Date.now();
        try {
            // Implementação padrão - providers podem sobrescrever
            await this.testConnection();
            this.health.isOnline = true;
            this.health.latency = Date.now() - start;
        } catch (error) {
            this.health.isOnline = false;
            this.health.latency = Date.now() - start;
        }
        this.health.lastCheck = new Date();
        return { ...this.health };
    }

    /**
     * Teste de conexão básico
     * @protected
     */
    async testConnection() {
        // Implementação padrão - providers devem sobrescrever
        throw new Error('testConnection deve ser implementado pelo provider');
    }
}

export default IStreamProvider;
