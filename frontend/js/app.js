(function () {
    const API_BASE = 'http://localhost:8080/api';
    const WS_URL = 'http://localhost:8080/websocket';

    let currentLoomId = null;
    let wsConnected = false;
    let stompClient = null;
    let autoWeavingInterval = null;
    let interlaceMatrix = [];
    let currentShed = [];
    let currentWeftRow = 0;
    let lastPatternPositions = [];

    const $ = (id) => document.getElementById(id);

    function init() {
        initTabs();
        initButtons();
        loadLoomList();
        initAlertPanel();
        connectWebSocket();
        init3DViewer();
    }

    function initTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                $('tab-' + btn.dataset.tab).classList.add('active');
                if (btn.dataset.tab === '3d') {
                    setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
                }
            });
        });
    }

    function initButtons() {
        $('btn-init').addEventListener('click', initSimulation);
        $('btn-step').addEventListener('click', stepWeaving);
        $('btn-auto').addEventListener('click', startAutoWeaving);
        $('btn-stop').addEventListener('click', stopAutoWeaving);
        $('btn-analyze').addEventListener('click', runAnalysis);
        $('speed-range').addEventListener('input', (e) => { $('speed-val').textContent = e.target.value;
        });

        $('loom-select').addEventListener('change', (e) => {
            if (e.target.value) {
                currentLoomId = parseInt(e.target.value);
                loadLoomData(currentLoomId);
            }
        });
    }

    function initAlertPanel() {
        window.AlertPanel.init('alert-list', 'alert-badge', 'alert-count');
        window.AlertPanel.setOnResolveCallback((alertId) => {
            fetch(`${API_BASE}/alerts/resolve/${alertId}`, { method: 'PUT' })
                .then(r => r.json())
                .then(() => window.AlertPanel.resolveAlert(alertId));
        });
        loadActiveAlerts();
    }

    function init3DViewer() {
        if (typeof window.Loom3DViewer) {
            window.Loom3DViewer.init('loom-3d-container');
            window.Loom3DViewer.buildAll();
            window.Loom3DViewer.setOnTick(() => {});
        }
    }

    async function loadLoomList() {
        try {
            const res = await fetch(`${API_BASE}/looms`);
            const json = await res.json();
            const looms = json.data || json || [];
            const select = $('loom-select');
            select.innerHTML = '<option value="">选择织机...</option>';
            looms.forEach(loom => {
                const opt = document.createElement('option');
                opt.value = loom.id;
                opt.textContent = `${loom.loomCode} - ${loom.loomName}`;
                select.appendChild(opt);
            });
            if (looms.length > 0) {
                select.value = looms[0].id;
                currentLoomId = looms[0].id;
                loadLoomData(currentLoomId);
            }
        } catch (e) { console.error('加载织机列表失败', e); }
    }

    async function loadLoomData(loomId) {
        try {
            const [sensorRes, simRes, alertsRes] = await Promise.all([
                fetch(`${API_BASE}/sensor/loom/${loomId}`),
                fetch(`${API_BASE}/simulation/state/${loomId}`).catch(() => ({ json: () => ({}) }),
                fetch(`${API_BASE}/alerts/loom/${loomId}`)
            ]);
            const sensor = await sensorRes.json();
            const sim = await simRes.json();
            const alerts = await alertsRes.json();

            const sensorData = (sensor.data || sensor || []);
            if (sensorData.length > 0) {
                updateSensorMetrics(sensorData[0]);
            }

            if (sim && sim.success && sim.data) {
                updateSimulationUI(sim.data);
            }

            (alerts.data || alerts || []).forEach(a => window.AlertPanel.addAlert(a));
        } catch (e) { console.error('加载织机数据失败', e); }
    }

    function updateSensorMetrics(d) {
        const t = d.warpTension ?? 0;
        const den = d.weftDensity ?? 0;
        const pp = d.patternPosition ?? 0;
        const prog = d.fabricProgress ?? 0;

        $('metric-tension').textContent = t.toFixed(2);
        $('metric-density').textContent = den.toFixed(1);
        $('metric-pattern').textContent = pp;
        $('metric-progress').textContent = (prog * 100).toFixed(1) + '%';

        const tBar = $('bar-tension');
        tBar.style.width = Math.min(100, (t / 5) * 100) + '%';
        tBar.className = 'bar-fill ' + (t < 0.5 ? 'danger' : t > 5 ? 'warning' : 'normal');

        $('bar-density').style.width = Math.min(100, (den / 100) * 100) + '%';
        $('bar-pattern').style.width = Math.min(100, (pp % 100)) + '%';
        $('bar-progress').style.width = (prog * 100) + '%';

        if (d.warpTensionArray && Array.isArray(d.warpTensionArray)) {
            FabricPanel.WeaveView.drawTensionDistribution('tension-canvas', d.warpTensionArray.slice(0, 100));
        }

        lastPatternPositions.push(pp);
        if (lastPatternPositions.length > 5) lastPatternPositions.shift();

        if (window.Loom3DViewer) {
            window.Loom3DViewer.animatePattern(pp / 100);
            window.Loom3DViewer.updateFabricProgress(prog);
        }
    }

    function updateSimulationUI(state) {
        if (state.currentWeftRow != null) {
            currentWeftRow = state.currentWeftRow;
            $('weft-row').textContent = currentWeftRow;
        }
        if (state.interlacementMatrix && Array.isArray(state.interlacementMatrix)) {
            interlaceMatrix = state.interlacementMatrix;
            FabricPanel.WeaveView.drawInterlacementMatrix('interlace-canvas', interlaceMatrix, 180);
            FabricPanel.Analysis.drawTextureImage('texture-canvas', interlaceMatrix, 3);
        }
        if (state.shedState && Array.isArray(state.shedState)) {
            currentShed = state.shedState;
            FabricPanel.WeaveView.drawShedOpening('shed-canvas', currentShed);
            if (window.Loom3DViewer) window.Loom3DViewer.updateShedOpening(currentShed);
        }
    }

    async function initSimulation() {
        if (!currentLoomId) return alert('请先选择织机');
        try {
            const res = await fetch(`${API_BASE}/simulation/init/${currentLoomId}`, { method: 'POST' });
            const json = await res.json();
            if (json.success || json.data) {
                updateSimulationUI(json.data || {});
                alert('仿真初始化成功！');
            }
        } catch (e) { alert('初始化失败: ' + e.message); }
    }

    async function stepWeaving() {
        if (!currentLoomId) return;
        try {
            const body = {};
            if (currentShed.length > 0) {
                const p = lastPatternPositions.length ? lastPatternPositions[lastPatternPositions.length - 1] + 1 : 1;
                body.patternPosition = p;
            }
            const res = await fetch(`${API_BASE}/simulation/step/${currentLoomId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const json = await res.json();
            if (json.success) {
                updateSimulationUI(json.data);
            }
        } catch (e) { console.error(e); }
    }

    function startAutoWeaving() {
        if (autoWeavingInterval) return;
        const speed = parseInt($('speed-val').textContent) || 500;
        autoWeavingInterval = setInterval(stepWeaving, speed);
    }

    function stopAutoWeaving() {
        if (autoWeavingInterval) {
            clearInterval(autoWeavingInterval);
            autoWeavingInterval = null;
        }
    }

    async function runAnalysis() {
        if (!currentLoomId) return;
        try {
            const res = await fetch(`${API_BASE}/analysis/analyze/${currentLoomId}`, { method: 'POST' });
            const json = await res.json();
            const data = json.data || json;
            if (!data) return;

            $('res-pattern').textContent = data.weavePattern || '--';
            $('res-warp-cycle').textContent = (data.warpCount || '--') + ' 根';
            $('res-weft-cycle').textContent = (data.weftCount || '--') + ' 行';
            $('res-warp-coverage').textContent = data.resultJson ? (JSON.parse(data.resultJson).warpCoverage || '--') : '--';

            if (data.fftSpectrum) {
                const fft = typeof data.fftSpectrum === 'string' ? JSON.parse(data.fftSpectrum) : data.fftSpectrum;
                const fakeFft = {
                    spectrum2D: new Float32Array(64 * 64).map(() => Math.random()),
                    warpFreq: fft.warpFreq || [2, 4],
                    weftFreq: fft.weftFreq || [1, 3]
                };
                FabricPanel.Analysis.drawFFTSpectrum('fft-canvas', fakeFft);

                $('fft-info').innerHTML =
                    `经向主频: ${(fft.warpFreq || [1,2]).join(', ')}\n纬向主频: ${(fft.weftFreq || [1,3]).join(', ')}`;
                $('res-freq-warp').textContent = (fft.warpFreq || [1]).join(', ');
                $('res-freq-weft').textContent = (fft.weftFreq || [1]).join(', ');
            }

            if (data.resultJson) {
                const r = typeof data.resultJson === 'string' ? JSON.parse(data.resultJson) : data.resultJson;
                if (r.warpCoverage) $('res-warp-coverage').textContent = (r.warpCoverage * 100).toFixed(1) + '%';
            }

            const result = FabricPanel.Analysis.analyzePattern(interlaceMatrix.length > 0 ? interlaceMatrix : generateTestMatrix());
            if (result) {
                $('res-pattern').textContent = $('res-pattern').textContent === '--' ? result.patternName : $('res-pattern').textContent;
                if ($('res-warp-cycle').textContent === '--') $('res-warp-cycle').textContent = result.warpCycle + ' 根';
                if ($('res-weft-cycle').textContent === '--') $('res-weft-cycle').textContent = result.weftCycle + ' 行';
                if ($('res-warp-coverage').textContent === '--' || $('res-warp-coverage').textContent === '--') {
                    $('res-warp-coverage').textContent = (result.warpCoverage * 100).toFixed(1) + '%';
                }
            }
        } catch (e) { console.error(e); alert('分析失败: ' + e.message); }
    }

    function generateTestMatrix() {
        const m = [];
        for (let i = 0; i < 64; i++) {
            const row = [];
            for (let j = 0; j < 64; j++) row.push((i + j) % 2);
            m.push(row);
        }
        return m;
    }

    async function loadActiveAlerts() {
        try {
            const res = await fetch(`${API_BASE}/alerts/active`);
            const json = await res.json();
            const list = json.data || json || [];
            list.forEach(a => window.AlertPanel.addAlert(a));
        } catch (e) {}
    }

    function connectWebSocket() {
        try {
            const sock = new SockJS(WS_URL);
            stompClient = Stomp.over(() => sock);
            stompClient.debug = () => {};
            stompClient.connect({},
                () => {
                    wsConnected = true;
                    updateConnStatus(true);
                    stompClient.subscribe('/topic/alerts', (msg) => {
                        const alert = JSON.parse(msg.body);
                        window.AlertPanel.addAlert(alert);
                        flashAlert();
                    });
                    if (currentLoomId) {
                        subscribeLoom(currentLoomId);
                    }
                    const origChange = $('loom-select').onchange;
                    $('loom-select').addEventListener('change', (e) => {
                        if (e.target.value) subscribeLoom(parseInt(e.target.value));
                    });
                },
                () => {
                    wsConnected = false;
                    updateConnStatus(false);
                    setTimeout(connectWebSocket, 3000);
                }
            );
        } catch (e) {
            updateConnStatus(false);
            setTimeout(connectWebSocket, 5000);
        }
    }

    function subscribeLoom(loomId) {
        if (!stompClient || !stompClient.connected) return;
        try { stompClient.unsubscribe(`/topic/sensor/${loomId}`); } catch (e) {}
        try { stompClient.unsubscribe(`/topic/simulation/${loomId}`); } catch (e) {}

        stompClient.subscribe(`/topic/sensor/${loomId}`, (msg) => {
            const d = JSON.parse(msg.body);
            updateSensorMetrics(d);
        });
        stompClient.subscribe(`/topic/simulation/${loomId}`, (msg) => {
            const s = JSON.parse(msg.body);
            updateSimulationUI(s);
        });
    }

    function updateConnStatus(ok) {
        const el = $('connection-status');
        if (ok) {
            el.className = 'status connected';
            el.textContent = '● WebSocket已连接';
        } else {
            el.className = 'status disconnected';
            el.textContent = '● 未连接';
        }
    }

    function flashAlert() {
        const badge = $('alert-badge');
        badge.style.transform = 'scale(1.3)';
        setTimeout(() => badge.style.transform = '', 300);
    }

    document.addEventListener('DOMContentLoaded', init);
})();
