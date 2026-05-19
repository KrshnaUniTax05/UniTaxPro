/**
 * UNITAX PRO - Core Application Brain (Final Stable)
 */
const App = {
    State: {
        userId: localStorage.getItem('userloginid'),
        userName: localStorage.getItem('userName'),
        activeModule: null
    },

    async Init() {
        if (!this.State.userId) { window.location.href = 'login.html'; return; }
        
        API.Init();
        this.UI.StartClock();
        this.BindGlobalEvents();
        
        document.getElementById('usernameDisplay').innerText = this.State.userName;
        document.getElementById('main_userid_show').innerText = `ID: ${this.State.userId}`;

        // Load entry module
        await this.Router('dashboard');
        document.getElementById('app-loader').style.display = 'none';
    },

    /**
     * MODULE ROUTER
     * AJAX loads HTML and immediately triggers the ERP Controller
     */
    async Router(path) {
        const viewport = document.getElementById('main-content');
        const loader = document.getElementById('section-loader');
        
        loader.style.display = 'block';
        try {
            const res = await fetch(`modules/${path}.html`);
            viewport.innerHTML = await res.text();
            this.State.activeModule = path;
            
            // 🔥 INITIALIZE ERP LOGIC FOR NEW MODULE
            this.InitERPModule(path);
            
        } catch (e) {
            viewport.innerHTML = `<div class="alert alert-danger">Failed to load module [${path}]</div>`;
        } finally {
            loader.style.display = 'none';
        }
    },

    /**
     * ERP MODULE INITIALIZER
     * Runs every time a new module is loaded
     */
    async InitERPModule(path) {
        const form = document.querySelector('form');
        if (!form) return;

        // 1. Populate Datalists immediately from Server
        await API.PopulateAllDatalists(form);

        // 2. Bind Auto-Lookup Engine
        form.addEventListener('change', (e) => {
            if (e.target.hasAttribute('data-fetch_column')) {
                API.HandleLookup(e.target);
            }
        });

        // 3. Bind Calculator/Math logic for vouchers
        if (path.includes('transactions/')) {
            form.addEventListener('input', () => {
                if (window.recalculateVoucher) recalculateVoucher();
            });
        }

        // 4. Handle Submission
        form.onsubmit = async (e) => {
            e.preventDefault();
            const isMaster = form.dataset.category === 'Masters';
            if (isMaster) {
                const data = Object.fromEntries(new FormData(form).entries());
                await API.SaveMaster(form.id, data);
                form.reset();
            } else {
                await API.PostVoucher(form);
            }
        };

        this.Log(`Module Ready: ${path}`);
    },

    BindGlobalEvents() {
        // Navigation
        document.addEventListener('click', (e) => {
            const link = e.target.closest('[data-module]');
            if (link) { e.preventDefault(); this.Router(link.dataset.module); }
        });

        // Global Shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === '/') {
                if (document.activeElement.tagName !== 'INPUT') {
                    e.preventDefault();
                    document.getElementById('globalSearch')?.focus();
                }
            }
        });

        // Logout
        document.getElementById('logoutButton').onclick = () => {
            localStorage.clear(); window.location.href = 'login.html';
        };
    },

    UI: {
        Notify(title, message, type = 'primary') {
            const toastEl = document.getElementById('appToast');
            const toast = new bootstrap.Toast(toastEl);
            document.getElementById('toastTitle').innerText = title;
            document.getElementById('toastBody').innerText = message;
            toastEl.className = `toast show bg-${type} text-white`;
            toast.show();
        },
        StartClock() {
            const elTime = document.getElementById('liveTime');
            const elDate = document.getElementById('liveDate');
            setInterval(() => {
                const n = new Date();
                if(elTime) elTime.innerText = n.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                if(elDate) elDate.innerText = n.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
            }, 1000);
        }
    },

    Log(msg) {
        const logger = document.getElementById('systemLogging');
        if (logger) {
            logger.innerHTML += `<div><span class="opacity-50">${new Date().toLocaleTimeString()}</span> > ${msg}</div>`;
            logger.scrollTop = logger.scrollHeight;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => App.Init());