// File Handling
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) loadVideo(file);
}

function handleDrop(e) {
    e.preventDefault();
    elements.uploadArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) loadVideo(file);
}

function loadVideo(file) {
    // Validate type (basic check)
    if (file.type.indexOf('video') === -1) {
        alert('Por favor selecciona un archivo de video válido.');
        return;
    }

    // Show loader
    elements.uploadArea.style.display = 'none';
    if (elements.videoLoader) elements.videoLoader.classList.add('active');

    // Reset App State
    resetAppState();

    // Create URL
    const url = URL.createObjectURL(file);
    video.src = url;
    video.load();

    video.onloadeddata = () => {
        state.videoWidth = video.videoWidth;
        state.videoHeight = video.videoHeight;

        // Setup Canvas
        elements.renderCanvas.width = state.videoWidth;
        elements.renderCanvas.height = state.videoHeight;
        processCanvas.width = state.videoWidth;
        processCanvas.height = state.videoHeight;

        console.log(`Video loaded: ${state.videoWidth}x${state.videoHeight}`);

        // UI Updates
        elements.videoContainer.classList.add('active');
        setTimeout(() => {
            if (elements.videoLoader) elements.videoLoader.classList.remove('active');
        }, 500);

        updateTimeDisplay();
        renderFrame();

        elements.processBtn.disabled = !state.modelReady;
    };

    video.onerror = () => {
        alert('Error al cargar el video.');
        elements.uploadArea.style.display = 'block';
        if (elements.videoLoader) elements.videoLoader.classList.remove('active');
    };
}
