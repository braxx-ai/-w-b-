// ==================== VARIABLES GLOBALES ====================
const audioPlayer = document.getElementById('audioPlayer');
const playBtn = document.getElementById('playBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');
const fileInput = document.getElementById('fileInput');
const progress = document.getElementById('progress');
const progressBar = document.querySelector('.progress-bar');
const playlistContainer = document.getElementById('playlistContainer');
const songTitle = document.getElementById('songTitle');
const songArtist = document.getElementById('songArtist');
const songAlbum = document.getElementById('songAlbum');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const aura = document.querySelector('.aura');
const saturnRing = document.querySelector('.saturn-ring');
const albumArt = document.getElementById('albumArt');
const spectrumCanvas = document.getElementById('spectrumCanvas');
const ctx = spectrumCanvas.getContext('2d');

// Canvas setup
spectrumCanvas.width = spectrumCanvas.offsetWidth;
spectrumCanvas.height = spectrumCanvas.offsetHeight;

// Variables de control
let playlist = [];
let currentTrack = 0;
let isPlaying = false;
let analyser;
let dataArray;
let animationFrameId;
let sessionTime = 0;
let songsPlayedCount = 0;

// Audio Context
let audioContext;

// ==================== INICIALIZACIÓN ====================
window.addEventListener('resize', () => {
    spectrumCanvas.width = spectrumCanvas.offsetWidth;
    spectrumCanvas.height = spectrumCanvas.offsetHeight;
});

// ==================== EXTRACTOR DE METADATOS ID3 ====================
async function extractMetadata(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            const arrayBuffer = e.target.result;
            const view = new Uint8Array(arrayBuffer);
            
            let metadata = {
                name: file.name.replace(/\.[^/.]+$/, ''),
                artist: 'Artista desconocido',
                album: 'Álbum desconocido',
                cover: null
            };
            
            try {
                // Buscar ID3v2
                if (view[0] === 0x49 && view[1] === 0x44 && view[2] === 0x33) { // "ID3"
                    const version = view[3];
                    const headerFlags = view[5];
                    let frameDataOffset = 10;
                    
                    // Parsear ID3v2
                    if (version === 3 || version === 4) {
                        let offset = frameDataOffset;
                        
                        while (offset < Math.min(view.length, 100000)) {
                            // Frame header
                            if (view[offset] === 0) break;
                            
                            const frameId = String.fromCharCode(
                                view[offset],
                                view[offset + 1],
                                view[offset + 2],
                                view[offset + 3]
                            );
                            
                            const frameSize = (view[offset + 4] << 24) | 
                                            (view[offset + 5] << 16) | 
                                            (view[offset + 6] << 8) | 
                                            view[offset + 7];
                            
                            const frameOffset = offset + 10;
                            
                            // Extraer información según el tipo de frame
                            if (frameId === 'TIT2') { // Title
                                metadata.name = readTextFrame(view, frameOffset, frameSize);
                            } else if (frameId === 'TPE1') { // Artist
                                metadata.artist = readTextFrame(view, frameOffset, frameSize);
                            } else if (frameId === 'TALB') { // Album
                                metadata.album = readTextFrame(view, frameOffset, frameSize);
                            } else if (frameId === 'APIC') { // Attached Picture
                                const coverData = readPictureFrame(view, frameOffset, frameSize);
                                if (coverData) {
                                    metadata.cover = coverData;
                                }
                            }
                            
                            offset += 10 + frameSize;
                        }
                    }
                }
            } catch (err) {
                console.log('Error leyendo metadatos:', err);
            }
            
            resolve(metadata);
        };
        
        reader.readAsArrayBuffer(file.slice(0, 200000)); // Leer primeros 200KB
    });
}

// Leer frame de texto
function readTextFrame(view, offset, size) {
    const encoding = view[offset];
    let text = '';
    
    try {
        if (encoding === 0) { // ISO-8859-1
            for (let i = 1; i < size; i++) {
                if (view[offset + i] === 0) break;
                text += String.fromCharCode(view[offset + i]);
            }
        } else if (encoding === 1 || encoding === 2) { // UTF-16
            for (let i = 2; i < size; i += 2) {
                const char = (view[offset + i + 1] << 8) | view[offset + i];
                if (char === 0) break;
                text += String.fromCharCode(char);
            }
        } else if (encoding === 3) { // UTF-8
            const bytes = Array.from(view.slice(offset + 1, offset + size));
            text = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
        }
    } catch (e) {
        console.log('Error decodificando texto');
    }
    
    return text.trim() || 'Desconocido';
}

// Leer frame de imagen
function readPictureFrame(view, offset, size) {
    try {
        const encoding = view[offset];
        let mimeEnd = offset + 1;
        
        // Buscar fin del MIME type
        while (mimeEnd < offset + size && view[mimeEnd] !== 0) {
            mimeEnd++;
        }
        
        const mimeType = String.fromCharCode(...Array.from(view.slice(offset + 1, mimeEnd)));
        const pictureType = view[mimeEnd + 1];
        
        // Descripción (saltarla)
        let descEnd = mimeEnd + 2;
        while (descEnd < offset + size && view[descEnd] !== 0) {
            descEnd++;
        }
        
        const pictureDataStart = descEnd + 1;
        const pictureData = view.slice(pictureDataStart, offset + size);
        
        // Crear blob
        const blob = new Blob([pictureData], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        return url;
    } catch (e) {
        console.log('Error extrayendo imagen');
        return null;
    }
}

// ==================== AUDIO CONTEXT ====================
function initAudioContext() {
    if (!audioPlayer.src) return;
    
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    
    try {
        const source = audioContext.createMediaElementAudioSource(audioPlayer);
        source.connect(analyser);
        analyser.connect(audioContext.destination);
    } catch (e) {
        console.log('Audio context ya inicializado');
    }
    
    dataArray = new Uint8Array(analyser.frequencyBinCount);
}

// ==================== ANIMACIONES ====================

// Animar Aura y Espectro
function animateVisualization() {
    if (!analyser) return;
    
    analyser.getByteFrequencyData(dataArray);
    
    // Calcular promedio de frecuencias
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const normalizedAverage = (average / 255) * 100;
    
    // Actualizar Aura
    aura.style.strokeWidth = 2 + (normalizedAverage / 100) * 4;
    aura.style.opacity = 0.3 + (normalizedAverage / 100) * 0.7;
    
    // Actualizar velocidad del anillo
    const rotationSpeed = (normalizedAverage / 100) * 5;
    saturnRing.style.animationDuration = (3 - rotationSpeed) + 's';
    
    // Actualizar ecualizador
    updateEqualizer();
    
    // Dibujar espectro
    drawSpectrum();
    
    if (isPlaying) {
        animationFrameId = requestAnimationFrame(animateVisualization);
    }
}

// Actualizar barras del ecualizador
function updateEqualizer() {
    const bars = document.querySelectorAll('.eq-bar');
    const barCount = bars.length;
    const samplesPerBar = Math.floor(dataArray.length / barCount);
    
    bars.forEach((bar, index) => {
        let sum = 0;
        for (let i = 0; i < samplesPerBar; i++) {
            sum += dataArray[index * samplesPerBar + i];
        }
        const average = sum / samplesPerBar;
        const height = (average / 255) * 100;
        bar.style.height = Math.max(5, height) + '%';
    });
}

// Dibujar espectro en canvas
function drawSpectrum() {
    const width = spectrumCanvas.width;
    const height = spectrumCanvas.height;
    
    // Limpiar canvas
    ctx.fillStyle = 'rgba(10, 10, 10, 0.1)';
    ctx.fillRect(0, 0, width, height);
    
    // Dibujar líneas de espectro
    const barWidth = (width / dataArray.length) * 2.5;
    let x = 0;
    
    for (let i = 0; i < dataArray.length; i++) {
        const barHeight = (dataArray[i] / 255) * height;
        
        // Gradiente
        const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
        gradient.addColorStop(0, '#ff006e');
        gradient.addColorStop(0.5, '#00d4ff');
        gradient.addColorStop(1, '#ff006e');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, height - barHeight, barWidth - 2, barHeight);
        
        x += barWidth;
    }
}

// ==================== CARGA DE ARCHIVOS ====================
fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    
    for (const file of files) {
        const url = URL.createObjectURL(file);
        const metadata = await extractMetadata(file);
        
        const trackData = {
            name: metadata.name,
            url: url,
            artist: metadata.artist,
            album: metadata.album,
            cover: metadata.cover,
            duration: 0
        };
        
        playlist.push(trackData);
    }
    
    renderPlaylist();
    updateStats();
    
    if (playlist.length > 0 && !audioPlayer.src) {
        loadTrack(0);
    }
});

// ==================== PLAYLIST ====================
function renderPlaylist() {
    playlistContainer.innerHTML = '';
    playlist.forEach((track, index) => {
        const item = document.createElement('div');
        item.className = 'playlist-item';
        if (index === currentTrack) item.classList.add('active');
        item.innerHTML = `
            <div style="font-weight: 600;">${track.name}</div>
            <div style="font-size: 0.8em; opacity: 0.7;">${track.artist}</div>
        `;
        item.addEventListener('click', () => {
            currentTrack = index;
            loadTrack(index);
            playTrack();
            updatePlaylist();
        });
        playlistContainer.appendChild(item);
    });
}

function updatePlaylist() {
    document.querySelectorAll('.playlist-item').forEach((item, index) => {
        if (index === currentTrack) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// ==================== CARGAR CANCIÓN ====================
function loadTrack(index) {
    if (playlist.length === 0) return;
    
    currentTrack = index;
    const track = playlist[index];
    audioPlayer.src = track.url;
    songTitle.textContent = track.name;
    songArtist.textContent = track.artist;
    songAlbum.textContent = track.album;
    updatePlaylist();
    initAudioContext();
    
    // Actualizar portada
    updateAlbumArt(index);
}

function updateAlbumArt(index) {
    const track = playlist[index];
    
    if (track.cover) {
        // Usar portada extraída del MP3
        albumArt.innerHTML = `<img src="${track.cover}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 10px;">`;
    } else {
        // Usar portada por defecto con colores
        const colors = ['#ff006e', '#00d4ff', '#ffb300', '#00ff88', '#a04a9d'];
        const color = colors[index % colors.length];
        
        albumArt.innerHTML = `
            <svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
                <rect width="300" height="300" fill="#1a1a1a"/>
                <circle cx="150" cy="150" r="140" fill="#2a2a2a"/>
                <circle cx="150" cy="150" r="100" fill="#1a1a1a" stroke="#3a3a3a" stroke-width="2"/>
                <circle cx="150" cy="150" r="30" fill="${color}" opacity="0.6"/>
                <text x="150" y="165" font-size="24" fill="${color}" text-anchor="middle" font-family="Arial" opacity="0.8" font-weight="bold">
                    ${track.artist.substring(0, 3).toUpperCase()}
                </text>
            </svg>
        `;
    }
}

// ==================== REPRODUCCIÓN ====================
function playTrack() {
    if (!audioPlayer.src) return;
    
    audioPlayer.play();
    isPlaying = true;
    playBtn.classList.add('playing');
    albumArt.classList.add('playing');
    songsPlayedCount++;
    updateStats();
    animateVisualization();
}

function pauseTrack() {
    audioPlayer.pause();
    isPlaying = false;
    playBtn.classList.remove('playing');
    albumArt.classList.remove('playing');
    cancelAnimationFrame(animationFrameId);
}

// ==================== CONTROLES ====================
playBtn.addEventListener('click', () => {
    if (isPlaying) {
        pauseTrack();
    } else {
        playTrack();
    }
});

nextBtn.addEventListener('click', () => {
    if (playlist.length === 0) return;
    currentTrack = (currentTrack + 1) % playlist.length;
    loadTrack(currentTrack);
    if (isPlaying) playTrack();
});

prevBtn.addEventListener('click', () => {
    if (playlist.length === 0) return;
    currentTrack = (currentTrack - 1 + playlist.length) % playlist.length;
    loadTrack(currentTrack);
    if (isPlaying) playTrack();
});

// ==================== VOLUMEN ====================
volumeSlider.addEventListener('input', (e) => {
    const value = e.target.value;
    audioPlayer.volume = value / 100;
    volumeValue.textContent = value + '%';
});

// ==================== PROGRESO ====================
audioPlayer.addEventListener('timeupdate', () => {
    const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    progress.style.width = percent + '%';
    currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
    
    // Actualizar tiempo de sesión
    sessionTime = Math.floor(audioPlayer.currentTime);
    updateStats();
});

audioPlayer.addEventListener('loadedmetadata', () => {
    durationEl.textContent = formatTime(audioPlayer.duration);
    playlist[currentTrack].duration = audioPlayer.duration;
    updateStats();
});

audioPlayer.addEventListener('ended', () => {
    nextBtn.click();
});

progressBar.addEventListener('click', (e) => {
    const clickX = e.offsetX;
    const width = progressBar.offsetWidth;
    const duration = audioPlayer.duration;
    audioPlayer.currentTime = (clickX / width) * duration;
});

// ==================== ESTADÍSTICAS ====================
function updateStats() {
    const totalSongs = playlist.length;
    const totalDuration = playlist.reduce((sum, track) => sum + (track.duration || 0), 0);
    
    document.getElementById('totalSongs').textContent = totalSongs;
    document.getElementById('songsPlayed').textContent = songsPlayedCount;
    document.getElementById('totalTime').textContent = formatTime(totalDuration);
    document.getElementById('sessionTime').textContent = formatTime(sessionTime);
}

// ==================== UTILIDADES ====================
function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Inicializar
audioPlayer.volume = 0.7;
updateStats();

// Permitir reproducción al hacer clic
document.addEventListener('click', () => {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
});