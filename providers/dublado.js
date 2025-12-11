// providers/dublado.js - Provider placeholder para conteúdo dublado PT-BR

import IStreamProvider from './types.js';

/**
 * Provider placeholder para conteúdo dublado PT-BR
 * Será ativado quando você fornecer endpoints legais
 */
export class DubladoProvider extends IStreamProvider {
    constructor() {
        super('DubladoProvider', 10); // Prioridade máxima para dublado
        
        // Configuração de feature flag
        this.isEnabled = false; // Desativado até você fornecer endpoints
        
        // Placeholders para endpoints que você fornecerá
        this.endpoints = {
            // Exemplos de onde você pode configurar:
            // hls: 'https://seu-cdn.com/dublado/{tmdbId}/playlist.m3u8',
            // dash: 'https://seu-cdn.com/dublado/{tmdbId}/manifest.mpd',
            // api: 'https://sua-api.com/dublado/{tmdbId}'
        };
    }

    /**
     * Ativa o provider com seus endpoints
     * @param {Object} config - Configuração dos endpoints
     * @param {string} config.hls - Base URL para HLS
     * @param {string} config.dash - Base URL para DASH
     * @param {string} config.api - URL da API
     */
    configure(config) {
        this.endpoints = { ...this.endpoints, ...config };
        this.isEnabled = true;
        console.log('DubladoProvider ativado com endpoints:', this.endpoints);
    }

    /**
     * Obtém stream dublado
     * @param {StreamRequest} request - Requisição de stream
     * @param {StreamOptions} [options] - Opções da requisição
     * @returns {Promise<Stream|null>} Stream encontrado ou null
     */
    async getStream(request, options = {}) {
        if (!this.isEnabled) {
            console.log('DubladoProvider desativado - configure seus endpoints');
            return null;
        }

        const { tmdbId, imdbId, type, season, episode } = request;
        const id = imdbId || tmdbId;

        if (!id) {
            throw new Error('ID não fornecido');
        }

        // Tentar HLS primeiro
        if (this.endpoints.hls) {
            try {
                const url = this.buildUrl(this.endpoints.hls, { id, type, season, episode });
                const stream = await this.getHlsStream(url, options);
                if (stream) return stream;
            } catch (error) {
                console.warn('HLS dublado falhou:', error.message);
            }
        }

        // Tentar DASH
        if (this.endpoints.dash) {
            try {
                const url = this.buildUrl(this.endpoints.dash, { id, type, season, episode });
                const stream = await this.getDashStream(url, options);
                if (stream) return stream;
            } catch (error) {
                console.warn('DASH dublado falhou:', error.message);
            }
        }

        // Tentar API customizada
        if (this.endpoints.api) {
            try {
                const stream = await this.getApiStream(request, options);
                if (stream) return stream;
            } catch (error) {
                console.warn('API dublado falhou:', error.message);
            }
        }

        return null;
    }

    /**
     * Obtém stream HLS
     * @private
     */
    async getHlsStream(url, options = {}) {
        const { timeout = 10000 } = options;
        
        try {
            // Verificar se playlist está acessível
            const response = await fetch(url, { 
                signal: AbortSignal.timeout(timeout) 
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            // Analisar manifest para detectar trilhas PT-BR
            const manifest = await response.text();
            const audioTracks = this.parseHlsAudioTracks(manifest);
            
            return {
                url,
                format: 'hls',
                audioTracks,
                isDubbed: audioTracks.some(track => 
                    ['pt', 'pt-BR', 'por'].includes(track.lang)
                ),
                sourceName: this.name
            };
        } catch (error) {
            throw new Error(`HLS access failed: ${error.message}`);
        }
    }

    /**
     * Obtém stream DASH
     * @private
     */
    async getDashStream(url, options = {}) {
        const { timeout = 10000 } = options;
        
        try {
            const response = await fetch(url, { 
                signal: AbortSignal.timeout(timeout) 
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const manifest = await response.text();
            const audioTracks = this.parseDashAudioTracks(manifest);
            
            return {
                url,
                format: 'dash',
                audioTracks,
                isDubbed: audioTracks.some(track => 
                    ['pt', 'pt-BR', 'por'].includes(track.lang)
                ),
                sourceName: this.name
            };
        } catch (error) {
            throw new Error(`DASH access failed: ${error.message}`);
        }
    }

    /**
     * Obtém stream via API customizada
     * @private
     */
    async getApiStream(request, options = {}) {
        const { timeout = 10000 } = options;
        const { tmdbId, imdbId, type, season, episode } = request;
        
        const apiUrl = this.buildUrl(this.endpoints.api, { 
            id: imdbId || tmdbId, 
            type, 
            season, 
            episode 
        });
        
        const response = await fetch(apiUrl, { 
            signal: AbortSignal.timeout(timeout) 
        });
        
        if (!response.ok) {
            throw new Error(`API HTTP ${response.status}`);
        }

        const data = await response.json();
        
        // Validar resposta da API
        if (!data.url) {
            throw new Error('API não retornou URL');
        }

        return {
            url: data.url,
            format: data.format || 'hls',
            audioTracks: data.audioTracks || [],
            subtitles: data.subtitles || [],
            isDubbed: data.isDubbed !== false, // Assume true se não especificado
            sourceName: this.name
        };
    }

    /**
     * Constrói URL com placeholders
     * @private
     */
    buildUrl(baseUrl, { id, type, season, episode }) {
        return baseUrl
            .replace('{tmdbId}', id)
            .replace('{imdbId}', id)
            .replace('{season}', season || '')
            .replace('{episode}', episode || '')
            .replace('{type}', type);
    }

    /**
     * Parse de trilhas de áudio HLS
     * @private
     */
    parseHlsAudioTracks(manifest) {
        const tracks = [];
        const regex = /#EXT-X-MEDIA:TYPE=AUDIO,URI="([^"]+)",GROUP-ID="([^"]+)",LANGUAGE="([^"]+)".*NAME="([^"]*)"/g;
        
        let match;
        while ((match = regex.exec(manifest)) !== null) {
            tracks.push({
                id: match[2],
                lang: match[3],
                name: match[4] || match[3],
                isDefault: match[0].includes('DEFAULT=YES')
            });
        }
        
        return tracks;
    }

    /**
     * Parse de trilhas de áudio DASH
     * @private
     */
    parseDashAudioTracks(manifest) {
        const tracks = [];
        const parser = new DOMParser();
        const xml = parser.parseFromString(manifest, 'application/xml');
        
        const adaptationSets = xml.querySelectorAll('AdaptationSet[mimeType="audio"]');
        
        adaptationSets.forEach(set => {
            const lang = set.getAttribute('lang') || 'und';
            const id = set.getAttribute('id') || lang;
            const name = set.querySelector('Label')?.textContent || lang;
            
            tracks.push({
                id,
                lang,
                name,
                isDefault: set.getAttribute('role') === 'main'
            });
        });
        
        return tracks;
    }

    /**
     * Verifica se suporta a requisição
     * @param {StreamRequest} request - Requisição de stream
     * @returns {boolean} Se suporta
     */
    supports(request) {
        return this.isEnabled && ['movie', 'series'].includes(request.type);
    }

    /**
     * Teste de conexão
     * @protected
     */
    async testConnection() {
        if (!this.isEnabled) {
            throw new Error('Provider desativado');
        }
        
        // Testa o primeiro endpoint disponível
        if (this.endpoints.hls) {
            const testUrl = this.buildUrl(this.endpoints.hls, { id: 'tt1234567' });
            const response = await fetch(testUrl, { method: 'HEAD' });
            if (!response.ok) throw new Error('HLS endpoint inacessível');
        }
    }
}

export default DubladoProvider;
