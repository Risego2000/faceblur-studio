// SIMPLIFIED RENDER APPROACH FOR MOBILE - Frame by Frame
// Replace the video.play() based loop with seekTo based loop

const renderLoop = async () => {
    const renderFps = 30;
    const frameTime = 1 / renderFps;
    let currentTime = startTime;
    let analysisIndex = 0;
    let lastFaceCount = 0;
    const renderStartRealTime = performance.now();
    
    const seekTo = (t) => new Promise(resolve => {
        if (Math.abs(video.currentTime - t) < 0.01) {
            resolve();
            return;
        }
        let resolved = false;
        const finish = () => {
            if (resolved) return;
            resolved = true;
            video.removeEventListener('seeked', finish);
            resolve();
        };
        setTimeout(finish, 100);
        video.addEventListener('seeked', finish, { once: true });
        video.currentTime = t;
    });

    try {
        while (currentTime < endTime && !state.processingCanceled) {
            await seekTo(currentTime);

            // Draw
            ctx.drawImage(video, 0, 0, state.videoWidth, state.videoHeight);

            // Find frame data
            while (analysisIndex < analysisData.length - 1 && analysisData[analysisIndex + 1].time <= currentTime) {
                analysisIndex++;
            }

            let frameData = null;
            if (analysisData[analysisIndex] && Math.abs(analysisData[analysisIndex].time - currentTime) < 1.0) {
                frameData = analysisData[analysisIndex];
            }

            // Apply effects
            if (frameData && frameData.faces) {
                lastFaceCount = frameData.faces.length;
                frameData.faces.forEach(face => {
                    if (!face || face.excluded || !face.box) return;
                    const box = face.box;
                    const padding = state.padding;
                    const x = Math.max(0, box.x - (box.width * padding));
                    const y = Math.max(0, box.y - (box.height * padding));
                    const w = Math.min(state.videoWidth - x, box.width * (1 + padding * 2));
                    const h = Math.min(state.videoHeight - y, box.height * (1 + padding * 2));

                    if (state.effect === 'pixelate') pixelateArea(ctx, x, y, w, h);
                    else if (state.effect === 'blur') blurArea(ctx, x, y, w, h);
                    else solidArea(ctx, x, y, w, h);
                });
            } else {
                lastFaceCount = 0;
            }

            // Update UI
            const elapsedVideo = currentTime - startTime;
            const renderPct = (elapsedVideo / duration) * 50;
            const totalPct = Math.min(100, 50 + Math.round(renderPct));

            let etaText = '';
            if (elapsedVideo > 0.5) {
                const elapsedRealMs = performance.now() - renderStartRealTime;
                const remainingVideo = duration - elapsedVideo;
                const msPerSec = elapsedRealMs / elapsedVideo;
                const etaMs = remainingVideo * msPerSec;
                
                if (etaMs < 60000) {
                    etaText = ` (~${Math.ceil(etaMs / 1000)}s restantes)`;
                } else {
                    const mins = Math.floor(etaMs / 60000);
                    const secs = Math.ceil((etaMs % 60000) / 1000);
                    etaText = ` (~${mins}m ${secs}s restantes)`;
                }
            }
            
            const effectName = state.effect === 'pixelate' ? 'Pixelando' : (state.effect === 'blur' ? 'Difuminando' : 'Ocultando');
            const faceInfo = lastFaceCount > 0 ? `${effectName} ${lastFaceCount} rostro${lastFaceCount > 1 ? 's' : ''}` : 'Codificando';

            elements.modalFill.style.width = totalPct + '%';
            elements.modalPercent.textContent = totalPct + '%';
            elements.modalSubtitle.textContent = `Fase 2/2: ${faceInfo} (${formatTime(currentTime)} / ${formatTime(endTime)})${etaText}`;

            currentTime += frameTime;
        }

        // Finish
        if (!state.processingCanceled) {
            elements.modalSubtitle.textContent = 'Finalizando y guardando archivo...';
            if (processingRecorder.state === 'recording') processingRecorder.stop();
            setTimeout(finalizeExport, 1000);
        } else {
            if (processingRecorder.state === 'recording') processingRecorder.stop();
            reject(new Error('Cancelado por usuario'));
        }
    } catch (e) {
        console.error('Render error:', e);
        reject(e);
    }
};

renderLoop();
