// player/audioSelector.js - Componente UI para seleção de áudio

/**
 * Componente de seleção de áudio com badge DUBLADO
 */
export class AudioSelector {
    constructor(container, options = {}) {
        this.container = container;
        this.audioManager = options.audioManager;
        this.onTrackSelected = options.onTrackSelected || (() => {});
        this.currentStream = null;
        
        this.init();
    }

    /**
     * Inicializa o componente
     */
    init() {
        this.createUI();
        this.bindEvents();
    }

    /**
     * Cria a interface
     */
    createUI() {
        this.container.innerHTML = `
            <div class="audio-selector">
                <div class="audio-badge" id="audioBadge" style="display: none;">
                    <span class="badge-dubbed">DUBLADO</span>
                </div>
                <div class="audio-controls" id="audioControls" style="display: none;">
                    <label for="audioTrackSelect">Idioma do áudio:</label>
                    <select id="audioTrackSelect" class="audio-select">
                        <option value="">Carregando...</option>
                    </select>
                </div>
            </div>
        `;

        this.elements = {
            badge: document.getElementById('audioBadge'),
            controls: document.getElementById('audioControls'),
            select: document.getElementById('audioTrackSelect')
        };
    }

    /**
     * Vincula eventos
     */
    bindEvents() {
        if (this.elements.select) {
            this.elements.select.addEventListener('change', (e) => {
                this.handleTrackSelection(e.target.value);
            });
        }
    }

    /**
     * Atualiza com informações do stream
     * @param {Object} stream - Stream atual
     */
    updateStream(stream) {
        this.currentStream = stream;
        
        // Mostrar badge se tiver dublado
        if (stream.isDubbed) {
            this.elements.badge.style.display = 'block';
        } else {
            this.elements.badge.style.display = 'none';
        }

        // Configurar callback do audioManager
        if (this.audioManager) {
            this.audioManager.onAudioDetected = (audioInfo) => {
                this.onAudioDetected(audioInfo);
            };
            
            this.audioManager.onTrackChange = (track) => {
                this.onTrackChanged(track);
            };
        }
    }

    /**
     * Traga detecção de áudio
     * @param {Object} audioInfo - Informações de áudio
     */
    onAudioDetected(audioInfo) {
        const { hasDubbed, tracks } = audioInfo;
        
        // Atualizar badge
        if (hasDubbed) {
            this.elements.badge.style.display = 'block';
            this.elements.badge.innerHTML = '<span class="badge-dubbed">DUBLADO</span>';
        } else {
            this.elements.badge.style.display = 'none';
        }

// Atualizar seleção de trilhas
        if (tracks && tracks.length > 1) {
            this.populateTrackSelect(tracks);
            this.elements.controls.style.display = 'block';
        } else {
            this.elements.controls.style.display = 'none';
        }
    }

/**
 * Preenche select de trilhas
 * @param {Array} tracks - Trilhas disponíveis
 */
populateTrackSelect(tracks) {
this.
elements.
select.
innerHTML = '';

tracks.
forEach(track => {
const option = document.
createElement('option');
option.
value = track.
id;
option.
textContent = track.
name;
option.
selected = track.
isDefault || false;
this.
elements.
select.
appendChild(option);
});
}

/**
 * Traga mudança de trilha
 * @param {Object} track - Trilha atual
 */
onTrackChanged(track) {
if (track) {
// Atualizar select
for (const option of this.
elements.
select.
options) {
option.
selected = option.
value == track.
id;
}

// Notificar
this.
onTrackSelected(track);
}
}

/**
 * Traga seleção de trilha
 * @param {string} trackId - ID da trilha
 */
handleTrackSelection(trackId) {
if (!trackId || !this.
audioManager) return;

this.
audioManager.
selectAudioTrack(trackId);
}

/**
 * Mostra mensagem de indisponibilidade
 * @param {string} message - Mensagem
 */
showUnavailable(message = 'Versão dublada indisponível — exibindo legendado') {
this.
elements.
badge.
innerHTML = `<span class="badge-unavailable">${message}</span>`;
this.
elements.
badge.
style.
display = 'block';
}

/**
 * Destrói o componente
 */
destroy() {
if (this.
elements.
select) {
this.
elements.
select.
removeEventListener('change', this.
handleTrackSelection);
}

this.
container.
innerHTML = '';
}
}

export default AudioSelector;
