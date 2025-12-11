// player/audioManager.js - Gerenciador de áudio para seleção de trilhas PT-BR

/**
 * Gerenciador de trilhas de áudio para streams HLS/DASH
 */
export class AudioManager {
    constructor(videoElement, options = {}) {
        this.video = videoElement;
        this.hlsInstance = null;
        this.currentTracks = [];
        this.currentAudioTrack = null;
        this.onTrackChange = options.onTrackChange || (() => {});
        this.onAudioDetected = options.onAudioDetected || (() => {});
        
        // Preferência de áudio salva
        this.preferredLanguage = localStorage.getItem('preferredAudioLang') || 'pt-BR';
        
        this.init();
    }

    /**
     * Inicializa o gerenciador
     */
    init() {
        // Detectar quando o player muda
        this.video.addEventListener('loadedmetadata', () => {
            this.detectAudioTracks();
        });
    }

    /**
     * Carrega stream HLS com suporte a áudio
     * @param {string} url - URL do stream HLS
     * @param {Object} streamInfo - Informações do stream
     */
    async loadHlsStream(url, streamInfo = {}) {
        // Carregar HLS.js se não estiver disponível
        if (!window.Hls) {
            await this.loadHlsJs();
        }

        // Destruir instância anterior
        if (this.hlsInstance) {
            this.hlsInstance.destroy();
        }

        // Criar nova instância
        this.hlsInstance = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90
        });

        // Configurar eventos
        this.hlsInstance.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
            this.onManifestParsed(data, streamInfo);
        });

        this.hlsInstance.on(Hls.Events.AUDIO_TRACKS_UPDATED, (event, data) => {
            this.onAudioTracksUpdated(data);
        });

        this.hlsInstance.on(Hls.Events.AUDIO_TRACK_SWITCHED, (event, data) => {
            this.onAudioTrackSwitched(data);
        });

        // Carregar stream
        this.hlsInstance.loadSource(url);
        this.hlsInstance.attachMedia(this.video);
    }

    /**
     * Carrega stream DASH com suporte a áudio
     * @param {string} url - URL do stream DASH
     * @param {Object} streamInfo - Informações do stream
     */
    async loadDashStream(url, streamInfo = {}) {
        // Carregar dash.js se não estiver disponível
        if (!window.dashjs) {
            await this.loadDashJs();
        }

        // Destruir instância anterior
        if (this.dashInstance) {
            this.dashInstance.destroy();
        }

        // Criar nova instância
        this.dashInstance = dashjs.MediaPlayer().create();
        
        // Configurar eventos
        this.dashInstance.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {
            this.onDashStreamInitialized(streamInfo);
        });

        // Carregar stream
        this.dashInstance.initialize(this.video, url, true);
    }

    /**
     * Carrega embed (iframe)
     * @param {string} url - URL do embed
     * @param {Object} streamInfo - Informações do stream
     */
    loadEmbed(url, streamInfo = {}) {
        // Para embeds, não conseguimos controlar áudio diretamente
        // Apenas mostrar informações disponíveis
        if (streamInfo.isDubbed) {
            this.onAudioDetected({
                hasDubbed: true,
                tracks: [{ lang: 'pt-BR', name: 'Português (Brasil)' }]
            });
        }
    }

    /**
     * Trata manifesto HLS carregado
     * @private
     */
    onManifestParsed(data, streamInfo) {
        const audioTracks = this.hlsInstance.audioTracks;
        this.currentTracks = audioTracks.map(track => ({
            id: track.id,
            lang: track.lang || 'und',
            name: track.name || this.getLanguageName(track.lang),
            isDefault: track.default
        }));

        console.log('Trilhas de áudio detectadas:', this.currentTracks);

        // Notificar detecção
        this.onAudioDetected({
            hasDubbed: streamInfo.isDubbed || this.hasPtBrTrack(),
            tracks: this.currentTracks
        });

        // Auto-selecionar PT-BR se disponível
        this.autoSelectPtBrTrack();
    }

    /**
     * Traga atualização de trilhas HLS
     * @private
     */
    onAudioTracksUpdated(data) {
        console.log('Trilhas de áudio atualizadas:', data.audioTracks);
    }

    /**
     * Traga mudança de trilha HLS
     * @private
     */
    onAudioTrackSwitched(data) {
        const track = this.currentTracks.find(t => t.id === data.id);
        this.currentAudioTrack = track;
        
        // Salvar preferência
        if (track && track.lang) {
            localStorage.setItem('preferredAudioLang', track.lang);
        }

        console.log('Trilha de áudio alterada:', track);
        this.onTrackChange(track);
    }

    /**
     * Traga stream DASH inicializado
     * @private
     */
    onDashStreamInitialized(streamInfo) {
        const audioTracks = this.dashInstance.getAudioTracks();
        this.currentTracks = audioTracks.map(track => ({
            id: track.id,
            lang: track.lang || 'und',
            name: track.name || this.getLanguageName(track.lang),
            isDefault: track.isDefault
        }));

        console.log('Trilhas DASH detectadas:', this.currentTracks);

        // Notificar detecção
        this.onAudioDetected({
            hasDubbed: streamInfo.isDubled || this.hasPtBrTrack(),
            tracks: this.currentTracks
        });

        // Auto-selecionar PT-BR se disponível
        this.autoSelectPtBrTrack();
    }

    /**
     * Detecta trilhas de áudio no elemento de vídeo nativo
     */
    detectAudioTracks() {
        if (this.hlsInstance || this.dashInstance) {
            return; // Já tratado por HLS/DASH
        }

        // Para vídeo nativo, verificar trilhas disponíveis
        const tracks = this.video.audioTracks;
        this.currentTracks = [];

        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            this.currentTracks.push({
                id: i,
                lang: track.language || 'und',
                name: track.label || this.getLanguageName(track.language),
                isDefault: track.enabled
            });
        }

        if (this.currentTracks.length > 0) {
            console.log('Trilhas nativas detectadas:', this.currentTracks);
            this.onAudioDetected({
                hasDubbed: this.hasPtBrTrack(),
                tracks: this.currentTracks
            });
        }
    }

    /**
     * Auto-seleciona trilha PT-BR
     */
    autoSelectPtBrTrack() {
        const ptBrTrack = this.currentTracks.find(track => 
            ['pt', 'pt-BR', 'por'].includes(track.lang)
        );

        if (ptBrTrack) {
            console.log('Auto-selecionando trilha PT-BR:', ptBrTrack);
            this.selectAudioTrack(ptBrTrack.id);
        }
    }

    /**
     * Seleciona trilha de áudio
     * @param {string|number} trackId - ID da trilha
     */
    selectAudioTrack(trackId) {
        if (this.hlsInstance) {
            // HLS
            this.hlsInstance.audioTrack = Number(trackId);
        } else if (this.dashInstance) {
            // DASH
            const track = this.currentTracks.find(t => t.id === trackId);
            if (track) {
                this.dash双人.setCurrentTrack(track);
            }
        } else {
            // Vídeo nativo
            const track = this.currentTracks.find(t => t.id === trackId);
            if (track) {
                this.video.audioTracks[trackId].enabled = true;
                // Desativar outras
                for (let i = 0; i < this.video.audioTracks.length; i++) {
                    if (i !== trackId) {
                        this.video.audioTracks[i].enabled = false;
                    }
                }
            }
        }
    }

    /**
     * Verifica se há trilha PT-BR
     * @returns {boolean} Se há trilha PT-BR
     */
    hasPtBrTrack() {
        return this.currentTracks.some(track => 
            ['pt', 'pt-BR', 'por'].includes(track.lang)
        );
    }

    /**
     * Obtém nome amigável do idioma
     * @param {string} lang - Código do idioma
     * @returns {string} Nome amigável
     */
    getLanguageName(lang) {
        const names = {
            'pt': 'Português',
            'pt-BR': 'Português (Brasil)',
            'por': 'Português',
            'en': 'Inglês',
            'en-US': 'Inglês (EUA)',
            'es': 'Espanhol',
            'fr': 'Francês',
            'de': 'Alemão',
            'it': 'Italiano',
            'ja': 'Japonês',
            'und': 'Indefinido'
        };
        
        return names[lang] || lang || 'Desconhecido';
    }

    /**
     * Carrega HLS.js dinamicamente
     * @private
     */
    async loadHlsJs() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Carrega dash.js dinamicamente
     * @private
     */
    async loadDashJs() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.dashjs.org/latest/dash.all.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Destrói o gerenciador
     */
    destroy() {
        if (this.hlsInstance) {
            this.hlsInstance.destroy();
            this.hlsInstance = null;
        }
        
        if (this.dashInstance) {
            this.dashInstance.destroy();
            this.dashInstance = null;
        }
        
        this.currentTracks = [];
        this.currentAudioTrack = null;
    }

    /**
     * Obtém trilhas disponíveis
     * @returns {Array} Lista de trilhas
     */
    getAvailableTracks() {
        return [...this.currentTracks];
    }

    /**
     * Obtém trilha atual
     * @returns {Object|null} Trilha atual
     */
    getCurrentTrack() {
        return this.currentAudioTrack;
    }
}

export default AudioManager;
