// providers/index.js - Gerenciador de providers e orquestração

import IStreamProvider from './types.js';
import { LegendadoProvider } from './legendado.js';
import { DubladoProvider } from './dublado.js';

/**
 * Gerenciador de providers de streaming
 */
export class StreamProviderManager {
    constructor() {
        this.providers = new Map();
        this.cache = new Map();
        this.healthChecks = new Map();
        this.circuitBreakers = new Map();
        
        // Registrar providers padrão
        this.registerProvider(new LegendadoProvider());
        this.registerProvider(new DubladoProvider());
        
        // Iniciar health checks periódicos
        this.startHealthChecks();
    }

    /**
     * Registra um provider
     * @param {IStreamProvider} provider - Provider a registrar
     */
    registerProvider(provider) {
        this.providers.set(provider.name, provider);
        console.log(`Provider registrado: ${provider.name} (prioridade: ${provider.priority})`);
    }

    /**
     * Remove um provider
     * @param {string} name - Nome do provider
     */
    unregisterProvider(name) {
        if (this.providers.delete(name)) {
            console.log(`Provider removido: ${name}`);
        }
    }

    /**
     * Obtém stream usando providers em ordem de prioridade
     * @param {StreamRequest} request - Requisição de stream
     * @param {StreamOptions} [options] - Opções da requisição
     * @returns {Promise<Stream|null>} Stream encontrado ou null
     */
    async getStream(request, options = {}) {
        const { languagePreference = 'original', timeout = 10000, enableCache = true } = options;
        
        // Cache key
        const cacheKey = this.getCacheKey(request, languagePreference);
        
        // Verificar cache
        if (enableCache && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < 30 * 60 * 1000) { // 30 minutos
                console.log(`Cache hit para ${cacheKey}`);
                return cached.stream;
            } else {
                this.cache.delete(cacheKey);
            }
        }

        // Filtrar providers que suportam a requisição
        const supportedProviders = Array.from(this.providers.values())
            .filter(provider => provider.supports(request))
            .sort((a, b) => a.priority - b.priority);

        console.log(`Providers disponíveis: ${supportedProviders.map(p => p.name).join(', ')}`);

        // Tentar providers em ordem
        for (const provider of supportedProviders) {
            // Verificar circuit breaker
            if (this.isCircuitBreakerOpen(provider.name)) {
                console.log(`Circuit breaker aberto para ${provider.name}, pulando...`);
                continue;
            }

            try {
                console.log(`Tentando provider: ${provider.name}`);
                const stream = await provider.getStream(request, { ...options, timeout });
                
                if (stream) {
                    // Verificar se stream corresponde à preferência de idioma
                    const matchesPreference = this.matchesLanguagePreference(stream, languagePreference);
                    
                    if (matchesPreference) {
                        // Sucesso - registrar no cache e retornar
                        this.cache.set(cacheKey, {
                            stream,
                            timestamp: Date.now()
                        });
                        
                        this.recordSuccess(provider.name);
                        console.log(`Stream encontrado via ${provider.name}`);
                        return stream;
                    } else {
                        console.log(`Stream encontrado mas não corresponde à preferência ${languagePreference}`);
                    }
                }
            } catch (error) {
                console.error(`Provider ${provider.name} falhou:`, error.message);
                this.recordFailure(provider.name);
            }
        }

        console.log('Nenhum provider conseguiu fornecer stream');
        return null;
    }

    /**
     * Verifica se stream corresponde à preferência de idioma
     * @private
     */
    matchesLanguagePreference(stream, preference) {
        if (preference === 'original') {
            return true; // Aceita qualquer
        }

        if (preference === 'pt-BR') {
            return stream.isDubbed === true || 
                   (stream.audioTracks && stream.audioTracks.some(track => 
                       ['pt', 'pt-BR', 'por'].includes(track.lang)
                   ));
        }

        return true; // Para outras preferências, aceita qualquer
    }

    /**
     * Gera chave de cache
     * @private
     */
    getCacheKey(request, languagePreference) {
        const { tmdbId, imdbId, type, season, episode } = request;
        const id = imdbId || tmdbId;
        const key = `${type}:${id}`;
        
        if (type === 'series' && season && episode) {
            return `${key}:${season}:${episode}:${languagePreference}`;
        }
        
        return `${key}:${languagePreference}`;
    }

    /**
     * Registra sucesso do provider
     * @private
     */
    recordSuccess(providerName) {
        const breaker = this.circuitBreakers.get(providerName);
        if (breaker) {
            breaker.failures = 0;
            breaker.state = 'closed';
        }
    }

    /**
     * Registra falha do provider
     * @private
     */
    recordFailure(providerName) {
        if (!this.circuitBreakers.has(providerName)) {
            this.circuitBreakers.set(providerName, {
                failures: 0,
                state: 'closed',
                lastFailure: null
            });
        }

        const breaker = this.circuitBreakers.get(providerName);
        breaker.failures++;
        breaker.lastFailure = Date.now();

        // Abrir circuit breaker após 3 falhas
        if (breaker.failures >= 3) {
            breaker.state = 'open';
            console.log(`Circuit breaker aberto para ${providerName} por 15 minutos`);
        }
    }

    /**
     * Verifica se circuit breaker está aberto
     * @private
     */
    isCircuitBreakerOpen(providerName) {
        const breaker = this.circuitBreakers.get(providerName);
        
        if (!breaker || breaker.state !== 'open') {
            return false;
        }

        // Reabrir após 15 minutos
        if (Date.now() - breaker.lastFailure > 15 * 60 * 1000) {
            breaker.state = 'closed';
            breaker.failures = 0;
            return false;
        }

        return true;
    }

    /**
     * Inicia health checks periódicos
     * @private
     */
    startHealthChecks() {
        // Verificar saúde a cada 5 minutos
        setInterval(async () => {
            for (const provider of this.providers.values()) {
                try {
                    await provider.checkHealth();
                } catch (error) {
                    console.warn(`Health check falhou para ${provider.name}:`, error.message);
                }
            }
        }, 5 * 60 * 1000);
    }

    /**
     * Obtém status de todos os providers
     * @returns {Object} Status dos providers
     */
    getProvidersStatus() {
        const status = {};
        
        for (const [name, provider] of this.providers) {
            status[name] = {
                priority: provider.priority,
                health: provider.health,
                circuitBreaker: this.circuitBreakers.get(name) || { state: 'closed', failures: 0 }
            };
        }
        
        return status;
    }

    /**
     * Limpa cache
     * @param {string} [pattern] - Padrão para limpar (opcional)
     */
    clearCache(pattern) {
        if (pattern) {
            for (const key of this.cache.keys()) {
                if (key.includes(pattern)) {
                    this.cache.delete(key);
                }
            }
        } else {
            this.cache.clear();
        }
        
        console.log('Cache limpo');
    }

    /**
     * Configura provider dublado com endpoints
     * @param {Object} config - Configuração dos endpoints
     */
    configureDubladoProvider(config) {
        const dubladoProvider = this.providers.get('DubladoProvider');
        if (dubladoProvider) {
            dubladoProvider.configure(config);
        } else {
            console.error('DubladoProvider não encontrado');
        }
    }
}

// Instância global do gerenciador
export const streamManager = new StreamProviderManager();

export default streamManager;
