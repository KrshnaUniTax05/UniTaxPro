/**
 * UniTax Pro — Secure Session Store
 *
 * Keeps "Keep me signed in" working without a server, while making the cached
 * session UNEDITABLE in localStorage — any tampering fails cryptographic verification.
 *
 * Design:
 *  - An ECDSA P-256 key pair is generated once per browser profile and stored in IndexedDB
 *    with `extractable: false`. The private key can never be read out of the browser.
 *  - The session payload is signed with the private key. On every boot the app verifies
 *    the signature before trusting the cache. Editing localStorage by hand breaks verification.
 *  - Session expires after 7 days. Failed verification wipes the cache and forces re-login.
 *
 * Honest limits: this protects against casual manual editing of storage.
 * It cannot stop a determined attacker who can call browser APIs from DevTools —
 * that requires a server-issued, server-verifiable token (see SECURITY-FIREBASE.md).
 */
(function () {
    'use strict';

    const DB_NAME = 'unitax_secure_session_v1';
    const STORE = 'keys';
    const PRIVATE_KEY_ID = 'signing_key';
    const PUBLIC_KEY_ID = 'verify_key';
    const STORAGE_KEY = 'unitax.session.v1';
    const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

    /* ---------- IndexedDB helpers ---------- */
    function openDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
            };
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = () => reject(req.error);
        });
    }

    function idbGet(db, key) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readonly');
            const req = tx.objectStore(STORE).get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
            tx.oncomplete = () => resolve(undefined); // fallback
        });
    }

    function idbSet(db, key, value) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put(value, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async function getOrCreateKeys() {
        const db = await openDB();
        let priv = await idbGet(db, PRIVATE_KEY_ID);
        let pub = await idbGet(db, PUBLIC_KEY_ID);
        if (priv && pub) {
            return { db, priv, pub };
        }
        const pair = await crypto.subtle.generateKey(
            { name: 'ECDSA', namedCurve: 'P-256' },
            false, // non-extractable
            ['sign', 'verify']
        );
        await idbSet(db, PRIVATE_KEY_ID, pair.privateKey);
        await idbSet(db, PUBLIC_KEY_ID, pair.publicKey);
        return { db, priv: pair.privateKey, pub: pair.publicKey };
    }

    function txDone(db) {
        try { db.close(); } catch (e) {}
    }

    /* ---------- Crypto helpers ---------- */
    const encoder = new TextEncoder();

    async function sign(bodyString) {
        const { db, priv } = await getOrCreateKeys();
        const sigBuf = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, priv, encoder.encode(bodyString));
        txDone(db);
        return btoa(String.fromCharCode.apply(null, new Uint8Array(sigBuf)));
    }

    async function verify(bodyString, sigB64) {
        try {
            const { db, pub } = await getOrCreateKeys();
            const bin = atob(sigB64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, bytes, encoder.encode(bodyString));
            txDone(db);
            return ok;
        } catch (e) {
            console.warn('SecureSession verify failed:', e);
            return false;
        }
    }

    /* ---------- Public API ---------- */
    async function save(payload, remember) {
        const body = Object.assign({}, payload, {
            issuedAt: Date.now(),
            expiresAt: Date.now() + TTL_MS,
            v: 1
        });
        const bodyString = JSON.stringify(body);
        const sig = await sign(bodyString);
        const packed = JSON.stringify({ body, sig });

        try {
            localStorage.setItem(STORAGE_KEY, packed);
            sessionStorage.setItem(STORAGE_KEY, packed);
            localStorage.setItem('keepSignedIn', remember ? 'true' : 'false');
            return true;
        } catch (e) {
            console.error('SecureSession.save failed:', e);
            return false;
        }
    }

    async function load() {
        const raw = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        let packed;
        try { packed = JSON.parse(raw); } catch (e) { clear(); return null; }
        if (!packed || !packed.body || !packed.sig) { clear(); return null; }

        // Expiry check first (fast path)
        if (Date.now() > Number(packed.body.expiresAt || 0)) { clear(); return null; }

        const ok = await verify(JSON.stringify(packed.body), packed.sig);
        if (!ok) { clear(); return null; }
        return packed.body;
    }

    function clear() {
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
        try { sessionStorage.removeItem(STORAGE_KEY); } catch (e) {}
    }

    window.SecureSession = { save, load, clear };
})();
