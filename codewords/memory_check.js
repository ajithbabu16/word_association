/**
 * Android Genie Profiler - Client Engine v3.0
 * Handles multi-tab monitoring, CPU/Memory charts, and thread analysis
 */

class GenieProfiler {
    constructor() {
        this.selectedDevice = null;
        this.selectedPackage = null;
        this.isTracking = false;
        this.interval = null;
        this.charts = {};
        this.dataHistory = { cpu: [], mem: [], time: [] };
        this.serviceUrl = window.location.origin;

        this.init();
    }

    init() {
        this.initCharts();
        this.bindEvents();
        this.initTabs();
    }

    initCharts() {
        // Main Overview Chart
        const mainCtx = document.getElementById('mainChart').getContext('2d');
        this.charts.main = new Chart(mainCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    { label: 'CPU %', borderColor: '#58a6ff', data: [], tension: 0.3, pointRadius: 0, yAxisID: 'y' },
                    { label: 'Memory (MB)', borderColor: '#bc8cff', data: [], tension: 0.3, pointRadius: 0, yAxisID: 'y1' }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { type: 'linear', position: 'left', grid: { color: 'rgba(255,255,255,0.05)' } },
                    y1: { type: 'linear', position: 'right', grid: { display: false } }
                },
                plugins: { legend: { display: false } }
            }
        });

        // CPU Timeline Chart
        const cpuCtx = document.getElementById('cpuTimelineChart').getContext('2d');
        this.charts.cpu = new Chart(cpuCtx, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Process CPU', borderColor: '#58a6ff', data: [], tension: 0.4, fill: true, backgroundColor: 'rgba(88, 166, 255, 0.1)' }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });

        // Memory Composition Chart
        const memCtx = document.getElementById('memCompChart').getContext('2d');
        this.charts.mem = new Chart(memCtx, {
            type: 'bar',
            data: {
                labels: ['Memory Breakdown (MB)'],
                datasets: [
                    { label: 'Java', data: [0], backgroundColor: '#3fb950' },
                    { label: 'Native', data: [0], backgroundColor: '#d29922' },
                    { label: 'Code', data: [0], backgroundColor: '#f85149' },
                    { label: 'Stack', data: [0], backgroundColor: '#bc8cff' },
                    { label: 'Other', data: [0], backgroundColor: '#30363d' }
                ]
            },
            options: {
                indexAxis: 'y',
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                    y: { stacked: true, grid: { display: false } }
                }
            }
        });
    }

    async triggerGC() {
        if (!this.selectedPackage) return;
        this.log("Forcing Garbage Collection...");
        try {
            await fetch(`${this.serviceUrl}/adb-gc?device_id=${this.selectedDevice}&package=${this.selectedPackage}`);
            this.log("GC signal sent successfully.");
        } catch (e) {
            this.log("Failed to trigger GC: " + e.message);
        }
    }


    async captureTrace() {
        if (!this.selectedDevice) return;
        this.log("Initializing System Trace (5s). Please wait...");
        try {
            const res = await fetch(`${this.serviceUrl}/adb-trace?device_id=${this.selectedDevice}`);
            const data = await res.json();
            if (data.status === "success") {
                this.log("Trace captured. Preview stored in logs.");
                console.log("Trace Data Sample:", data.preview);
            }
        } catch (e) {
            this.log("Trace failed: " + e.message);
        }
    }

    bindEvents() {
        document.getElementById('connect-btn').onclick = () => this.detectDevices();
        document.getElementById('package-search').oninput = (e) => this.filterPackages(e.target.value);
        document.getElementById('start-tracking-btn').onclick = () => this.startProfiling();
        document.getElementById('stop-tracking-btn').onclick = () => this.stopProfiling();
    }

    initTabs() {
        const tabs = document.querySelectorAll('.tab-item');
        tabs.forEach(tab => {
            tab.onclick = () => {
                tabs.forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

                tab.classList.add('active');
                document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
            };
        });
    }

    async detectDevices() {
        const btn = document.getElementById('connect-btn');
        btn.innerText = "Searching...";
        try {
            const res = await fetch(`${this.serviceUrl}/adb-devices`);
            const data = await res.json();
            if (data.status === "success" && data.devices.length > 0) {
                this.selectedDevice = data.devices[0].id;
                document.getElementById('connection-status').innerText = `Connected: ${data.devices[0].model}`;
                document.getElementById('active-device-name').innerText = data.devices[0].model;
                document.getElementById('device-pill').style.display = 'flex';
                btn.innerText = "✓ Connected";
                btn.classList.add('active');
                this.fetchPackages();
            }
        } catch (e) { btn.innerText = "Retry Detection"; }
    }

    async fetchPackages() {
        const list = document.getElementById('package-list');
        list.innerHTML = '<div style="text-align:center; padding: 20px;">Loading apps...</div>';
        try {
            const res = await fetch(`${this.serviceUrl}/adb-packages?device_id=${this.selectedDevice}`);
            const data = await res.json();
            this.allPackages = data.packages;
            this.renderPackages(this.allPackages);
        } catch (e) { list.innerHTML = 'Error loading apps.'; }
    }

    renderPackages(pkgs) {
        const list = document.getElementById('package-list');
        list.innerHTML = '';
        pkgs.forEach(p => {
            const div = document.createElement('div');
            div.className = 'package-item';
            div.innerText = p;
            div.onclick = () => {
                document.querySelectorAll('.package-item').forEach(i => i.classList.remove('selected'));
                div.classList.add('selected');
                this.selectedPackage = p;
                document.getElementById('start-tracking-btn').disabled = false;
            };
            list.appendChild(div);
        });
    }

    filterPackages(query) {
        if (!this.allPackages) return;
        const filtered = this.allPackages.filter(p => p.toLowerCase().includes(query.toLowerCase()));
        this.renderPackages(filtered);
    }

    startProfiling() {
        this.isTracking = true;
        document.getElementById('start-tracking-btn').disabled = true;
        document.getElementById('stop-tracking-btn').disabled = false;
        this.log("Session started for " + this.selectedPackage);
        this.interval = setInterval(() => this.poll(), 2000);
    }

    stopProfiling() {
        this.isTracking = false;
        clearInterval(this.interval);
        document.getElementById('start-tracking-btn').disabled = false;
        document.getElementById('stop-tracking-btn').disabled = true;
        this.log("Session terminated.");
    }

    async poll() {
        try {
            const res = await fetch(`${this.serviceUrl}/adb-profiler-all?device_id=${this.selectedDevice}&package=${this.selectedPackage}`);
            const data = await res.json();

            if (data.status === "success") {
                this.updateUI(data);
            }
        } catch (e) {
            console.error("Poll Error", e);
        }
    }

    updateUI(data) {
        const pssMB = (data.memory.pss / 1024).toFixed(1);
        const rssMB = (data.memory.rss / 1024).toFixed(1);

        // Update Stats Bar
        document.getElementById('stat-cpu').innerText = `${data.cpu.total}%`;
        document.getElementById('stat-mem').innerText = `${pssMB} MB`;
        document.getElementById('stat-threads').innerText = data.cpu.threads.length;
        document.getElementById('thread-count-large').innerText = data.cpu.threads.length;
        document.getElementById('stat-pid').innerText = data.pid;

        // Battery & System Health
        if (data.battery) {
            this.log(`Battery: ${data.battery.level}% (${data.battery.status})`);
        }
        if (data.system_health) {
            const thermalEl = document.getElementById('health-thermal');
            thermalEl.innerText = data.system_health.thermal.toUpperCase();
            thermalEl.style.color = data.system_health.thermal.toLowerCase().includes('nominal') ? 'var(--success)' : 'var(--danger)';

            if (data.system_health.event) {
                document.getElementById('health-event').innerText = data.system_health.event;
            }
        }

        // Overview & CPU Charts (App vs System context as per "Live Telemetry" docs)
        this.updateChart(this.charts.main, data.timestamp, [data.cpu.total, pssMB]);

        // Enhance CPU Chart with System Load Comparison
        if (this.charts.cpu.data.datasets.length < 2) {
            this.charts.cpu.data.datasets.push({
                label: 'System Load',
                borderColor: '#8b949e',
                data: [],
                borderDash: [5, 5],
                fill: false
            });
        }
        this.updateChart(this.charts.cpu, data.timestamp, [data.cpu.total, data.cpu.system]);

        // Memory Composition Breakdown
        this.charts.mem.data.datasets[0].data = [(data.memory.java / 1024).toFixed(1)];
        this.charts.mem.data.datasets[1].data = [(data.memory.native / 1024).toFixed(1)];
        this.charts.mem.data.datasets[2].data = [(data.memory.code / 1024).toFixed(1)];
        this.charts.mem.data.datasets[3].data = [(data.memory.stack / 1024).toFixed(1)];
        this.charts.mem.data.datasets[4].data = [(data.memory.private_other / 1024).toFixed(1)];
        this.charts.mem.update();

        document.getElementById('mem-java').innerText = (data.memory.java / 1024).toFixed(1) + " MB";
        document.getElementById('mem-native').innerText = (data.memory.native / 1024).toFixed(1) + " MB";

        const codeStack = ((data.memory.code + data.memory.stack) / 1024).toFixed(1);
        if (document.getElementById('mem-code-stack')) {
            document.getElementById('mem-code-stack').innerText = codeStack + " MB";
        }

        if (document.getElementById('mem-rss')) {
            document.getElementById('mem-rss').innerText = rssMB + " MB";
        }

        // Thread Table
        this.updateThreadTable(data.cpu.threads);

        // Leak & Graphics Analysis
        if (data.leak_stats) {
            document.getElementById('leak-fd').innerText = data.leak_stats.fd_count;
            document.getElementById('leak-activities').innerText = data.leak_stats.activities;
            document.getElementById('leak-views').innerText = data.leak_stats.views;

            // Jank Latencies
            if (data.gfx_perf) {
                document.getElementById('gfx-p90').innerText = data.gfx_perf.p90 + "ms";
                document.getElementById('gfx-p99').innerText = data.gfx_perf.p99 + "ms";
            }

            let leakMsg = "";
            const jankyPct = data.gfx_perf ? ((data.gfx_perf.janky / data.gfx_perf.total) * 100).toFixed(1) : 0;

            if (data.leak_stats.activities > 1) {
                leakMsg += `<div style="color:var(--danger)">✘ Activity Leak: ${data.leak_stats.activities} instances.</div>`;
            }
            if (data.gfx_perf && data.gfx_perf.janky > 0) {
                leakMsg += `<div style="color:var(--warning)">⚠ Jank: ${data.gfx_perf.janky} frames (${jankyPct}%).</div>`;
                if (data.gfx_perf.p99 > 32) leakMsg += `<div style="color:var(--accent)">⚡ High P99: ${data.gfx_perf.p99}ms. Frames skipped.</div>`;
            }

            document.getElementById('leak-analysis-view').innerHTML = leakMsg || '<div style="color:var(--success)">✓ UI Pipeline Healthy</div>';
        }

        // Power Rails Visualization
        if (data.power_rails) {
            const container = document.getElementById('power-rails-container');
            const entries = Object.entries(data.power_rails);
            if (entries.length > 0) {
                container.innerHTML = entries.map(([name, val]) => `
                    <div style="display: flex; justify-content: space-between; padding-bottom: 4px; border-bottom: 1px solid var(--border);">
                        <span>${name}</span>
                        <span style="color:var(--primary); font-family:var(--font-mono)">${val} uW</span>
                    </div>
                `).join('');
            }
        }
    }



    updateChart(chart, label, values) {
        chart.data.labels.push(label);
        values.forEach((v, i) => chart.data.datasets[i].data.push(v));
        if (chart.data.labels.length > 20) {
            chart.data.labels.shift();
            chart.data.datasets.forEach(d => d.data.shift());
        }
        chart.update('none');
    }

    updateThreadTable(threads) {
        const tbody = document.querySelector('#cpu-thread-table tbody');
        const allTbody = document.querySelector('#all-threads-table tbody');

        const getDotClass = (s) => {
            if (s === 'R') return 'dot-running';
            if (s === 'D') return 'dot-waiting';
            return 'dot-sleeping';
        };

        const generateRows = (data) => {
            return data.map(t => `
                <tr>
                    <td>${t.tid}</td>
                    <td><span class="dot ${getDotClass(t.state)}"></span> ${t.name}</td>
                    <td>${t.cpu}%</td>
                    <td style="color: var(--text-dim)">${t.state_label || t.state}</td>
                </tr>
            `).join('');
        };

        tbody.innerHTML = generateRows(threads.slice(0, 10));
        allTbody.innerHTML = threads.map(t => `
             <tr>
                <td>${t.tid}</td>
                <td>${t.name}</td>
                <td>${t.cpu}%</td>
                <td><span class="dot ${getDotClass(t.state)}"></span> ${t.state_label || t.state}</td>
                <td>5</td>
            </tr>
        `).join('') || '<tr><td colspan="5" style="text-align:center">No threads found</td></tr>';
    }

    getStateName(s) {
        const states = { 'R': 'Running', 'S': 'Sleeping', 'D': 'Waiting', 'Z': 'Zombie', 'T': 'Stopped' };
        return states[s] || s;
    }

    log(msg) {
        const console = document.getElementById('log-console');
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = `<span class="log-time">[${new Date().toLocaleTimeString()}]</span> ${msg}`;
        console.appendChild(entry);
        console.scrollTop = console.scrollHeight;
    }
}

window.onload = () => { window.profiler = new GenieProfiler(); };
