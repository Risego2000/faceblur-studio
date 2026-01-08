// SINGLE-PASS VIDEO PROCESSING
// Combines analysis and rendering in one frame-by-frame loop for mobile stability

async function analyzeAndRenderVideoPass(startTime, endTime) {
    return new Promise(async (resolve, reject) => {
        // Setup canvas and recorder
        processingChunks = [];
        const canvas = document.createElement('canvas');
        canvas.width = state.videoWidth;
        canvas.height = state.videoHeight;
        const ctx = canvas.getContext('2d');

        // Audio Setup
        let stream = canvas.captureStream(30);
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                if (!window.audioCtxGlobal) window.audioCtxGlobal = new AudioContext();
                const audioCtx = window.audioCtxGlobal;
                if (audioCtx.state === 'suspended') await audioCtx.resume();

                if (!video._audioSourceNode) {
                    try { video._audioSourceNode = audioCtx.createMediaElementSource(video); } catch (e) { }
                }
                if (video._audioSourceNode) {
                    const dest = audioCtx.createMediaStreamDestination();
                    video._audioSourceNode.connect(dest);
                    if (dest.stream.getAudioTracks().length > 0) stream.addTrack(dest.stream.getAudioTracks()[0]);
                }
            }
        } catch (e) { console.warn('Audio setup warning:', e); }

        // Setup MediaRecorder
        let mimeType = 'video/webm;codecs=vp9,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/mp4';

        const recorder = new MediaRecorder(stream, { mimeType: mimeType, videoBitsPerSecond: 8000000 });
        recorder.ondataavailable = e => { if (e.data.size > 0) processingChunks.push(e.data); };

        const finalizeExport = () => {
            if (state.processedBlob) { resolve(); return; }
            try {
                const blob = new Blob(processingChunks, { type: recorder.mimeType });
                state.processedBlob = blob;
                if (stream) stream.getTracks().forEach(t => t.stop());
                resolve();
            } catch (e) { reject(e); }
        };

        recorder.onstop = () => {
            console.log('Recording stopped');
            finalizeExport();
        };

        recorder.start(100);

        // Processing variables
        const duration = endTime - startTime;
        const fps = isMobile ? 15 : 20; // Adaptive  FPS
        const frameTime = 1 / fps;
        let currentTime = startTime;
        const startRealTime = performance.now();

        // Tracking state
        let activeTracks = [];
        let nextTrackId = 1;
        const MAX_PERSISTENCE = 60;

        // Seek helper
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

        // Main processing loop
        try {
            while (currentTime < endTime && !state.processingCanceled) {
                await seekTo(currentTime);

                // 1. DETECT FACES
                let detections = [];
                try {
                    if (state.detectorType === 'mobile' && window.blazeDetector) {
                        const predictions = await window.blazeDetector.estimateFaces(video, false, false, false);
                        detections = predictions.map(pred => ({
                            detection: {
                                box: {
                                    x: pred.topLeft[0],
                                    y: pred.topLeft[1],
                                    width: pred.bottomRight[0] - pred.topLeft[0],
                                    height: pred.bottomRight[1] - pred.topLeft[1]
                                },
                                score: pred.probability ? pred.probability[0] : 0.9
                            },
                            identity: null
                        }));
                    } else {
                        detections = await faceapi.detectAllFaces(video, window.faceDetector);
                        detections = detections.map(d => ({ detection: d, identity: null }));
                    }
                } catch (e) {
                    console.warn('Detection error:', e);
                }

                let faces = filterFaces(detections);

                // 2. TRACK FACES
                const usedDetections = new Set();
                activeTracks.forEach(track => {
                    let bestMatch = null;
                    let maxIoU = 0.3;
                    faces.forEach((face, idx) => {
                        if (usedDetections.has(idx)) return;
                        const dBox = face.detection.box;
                        const xA = Math.max(track.box.x, dBox.x);
                        const yA = Math.max(track.box.y, dBox.y);
                        const xB = Math.min(track.box.x + track.box.width, dBox.x + dBox.width);
                        const yB = Math.min(track.box.y + track.box.height, dBox.y + dBox.height);
                        const interW = Math.max(0, xB - xA);
                        const interH = Math.max(0, yB - yA);
                        const interArea = interW * interH;
                        const unionArea = (track.box.width * track.box.height) + (dBox.width * dBox.height) - interArea;
                        const iou = interArea / unionArea;
                        if (iou > maxIoU) {
                            maxIoU = iou;
                            bestMatch = { face, idx };
                        }
                    });
                    if (bestMatch) {
                        track.box = bestMatch.face.detection.box;
                        track.lastSeen = 0;
                        usedDetections.add(bestMatch.idx);
                    } else {
                        track.lastSeen++;
                    }
                });

                faces.forEach((face, idx) => {
                    if (!usedDetections.has(idx)) {
                        activeTracks.push({
                            id: nextTrackId++,
                            box: face.detection.box,
                            lastSeen: 0,
                            excluded: false
                        });
                    }
                });

                activeTracks = activeTracks.filter(t => t.lastSeen < MAX_PERSISTENCE);

                // 3. RENDER WITH EFFECTS
                const padding = state.padding;
                ctx.drawImage(video, 0, 0, state.videoWidth, state.videoHeight);

                activeTracks.forEach(track => {
                    const box = track.box;
                    const smoothed = smoothBoundingBox({ detection: { box } });
                    const x = Math.max(0, smoothed.x - (smoothed.width * padding));
                    const y = Math.max(0, smoothed.y - (smoothed.height * padding));
                    const w = Math.min(state.videoWidth - x, smoothed.width * (1 + padding * 2));
                    const h = Math.min(state.videoHeight - y, smoothed.height * (1 + padding * 2));

                    if (state.effect === 'pixelate') pixelateArea(ctx, x, y, w, h);
                    else if (state.effect === 'blur') blurArea(ctx, x, y, w, h);
                    else solidArea(ctx, x, y, w, h);
                });

                // 4. UPDATE UI
                const elapsedVideo = currentTime - startTime;
                const progress = Math.round((elapsedVideo / duration) * 100);

                let etaText = '';
                if (elapsedVideo > 1) {
                    const elapsedReal = performance.now() - startRealTime;
                    const remaining = duration - elapsedVideo;
                    const eta = (remaining / elapsedVideo) * elapsedReal;
                    if (eta < 60000) {
                        etaText = ` (~${Math.ceil(eta / 1000)}s)`;
                    } else {
                        etaText = ` (~${Math.floor(eta / 60000)}m ${Math.ceil((eta % 60000) / 1000)}s)`;
                    }
                }

                const effectName = state.effect === 'pixelate' ? 'Pixelando' : (state.effect === 'blur' ? 'Difuminando' : 'Ocultando');
                const statusText = activeTracks.length > 0
                    ? `${effectName} ${activeTracks.length} rostro${activeTracks.length > 1 ? 's' : ''}`
                    : 'Codificando';

                elements.modalFill.style.width = progress + '%';
                elements.modalPercent.textContent = progress + '%';
                elements.modalSubtitle.textContent = `${statusText} (${formatTime(currentTime)} / ${formatTime(endTime)})${etaText}`;

                currentTime += frameTime;
            }

            // Finalize
            if (!state.processingCanceled) {
                elements.modalSubtitle.textContent = 'Finalizando archivo...';
                if (recorder.state === 'recording') recorder.stop();
                setTimeout(finalizeExport, 1000);
            } else {
                if (recorder.state === 'recording') recorder.stop();
                reject(new Error('Cancelado por usuario'));
            }
        } catch (e) {
            console.error('Processing error:', e);
            if (recorder.state === 'recording') recorder.stop();
            reject(e);
        }
    });
}
