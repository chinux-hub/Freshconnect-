/* --- 1. FIREBASE INITIALIZATION --- */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { 
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, 
    onAuthStateChanged, signOut, sendPasswordResetEmail 
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";
import { 
    getFirestore, doc, setDoc, getDoc, collection, addDoc, deleteDoc,
    getDocs, query, orderBy, serverTimestamp, where, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCDgUtehRa6LfMta2fdgk5c2Hup3jFYLWA",
    authDomain: "freshconnect-23653.firebaseapp.com",
    projectId: "freshconnect-23653",
    storageBucket: "freshconnect-23653.firebasestorage.app",
    messagingSenderId: "1002039870276",
    appId: "1:1002039870276:web:3d95e5c7e8347b526e0d11"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* --- 2. GLOBAL STATE --- */
let currentMode = 'login';
let cachedUserRole = localStorage.getItem('userRole') || null;
let activeChatId = null;
let chatUnsubscribe = null; 
let navHistory = [];
let ecosystemCache = [];

/* --- 3. AUTHENTICATION ENGINE --- */
window.setAuthMode = (mode) => {
    currentMode = mode;
    const roleInfo = document.getElementById('role-info');
    const authBtn = document.getElementById('main-auth-btn');

    document.querySelectorAll('.auth-tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-${mode}`)?.classList.add('active');

    if(roleInfo) roleInfo.style.display = (mode === 'login' || mode === 'cust') ? 'none' : 'block';

    const labels = { 
        'login': 'Enter Ecosystem', 'cust': 'Join as Buyer', 
        'farm': 'Register Farm', 'marketer': 'Join as Marketer', 'trans': 'Join Delivery Fleet' 
    };
    if(authBtn) {
        authBtn.innerText = labels[mode] || "Enter Ecosystem";
        authBtn.onclick = () => window.handleAuth();
    }
};

window.handleAuth = async () => {
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-pass').value;
    const bizName = document.getElementById('biz-name')?.value.trim() || "";
    const bizLoc = document.getElementById('biz-loc')?.value.trim() || "";

    if (!email || !pass) return alert("Please enter credentials.");

    try {
        if (currentMode === 'login') {
            await signInWithEmailAndPassword(auth, email, pass);
            window.revealDashboard(); // Trigger dashboard entry
        } else {
            const userCred = await createUserWithEmailAndPassword(auth, email, pass);
            const userData = { 
                uid: userCred.user.uid,
                email, 
                role: currentMode, 
                businessName: bizName, 
                location: bizLoc, 
                createdAt: serverTimestamp() 
            };
            await setDoc(doc(db, "users", userCred.user.uid), userData);
            localStorage.setItem('userRole', currentMode);
            localStorage.setItem('bizName', bizName);
            cachedUserRole = currentMode;
            window.revealDashboard();
        }
    } catch (e) { alert(e.code === 'auth/email-already-in-use' ? "Email already registered." : e.message); }
};

window.revealDashboard = () => {
    const hero = document.getElementById('hero-section');
    const appContainer = document.getElementById('app-container');
    const dashHeader = document.getElementById('dashboard-header');
    const guestHeader = document.getElementById('guest-header');

    if(hero) hero.style.display = 'none';
    if(guestHeader) guestHeader.style.display = 'none';
    if(appContainer) appContainer.style.display = 'block';
    if(dashHeader) dashHeader.classList.add('reveal');
    document.body.classList.add('header-active');
    window.showPage('home-page');
};

/* --- 4. NAVIGATION SYSTEM --- */
window.showPage = (id) => {
    const role = cachedUserRole || localStorage.getItem('userRole');
    const dashHeader = document.getElementById('dashboard-header');
    const backBtn = document.getElementById('nav-back-btn');
    const appContainer = document.getElementById('app-container');
    let targetId = id;

    // Role-based home redirection
    if (id === 'home-page') {
        if (role === 'farm') targetId = 'farmer-portal';
        else if (role === 'marketer') targetId = 'marketer-portal';
        else if (role === 'trans') targetId = 'logistics-page';

        if(backBtn) backBtn.style.display = 'none';
        navHistory = []; 
    } else {
        if(backBtn) backBtn.style.display = 'block';
        if (navHistory[navHistory.length - 1] !== targetId) navHistory.push(targetId);
    }

    // Clear notifications if entering chat
    if (targetId === 'chat-window') {
        clearMyNotifications();
        const badge = document.getElementById('notif-badge');
        if (badge) { badge.style.display = 'none'; badge.innerText = '0'; }
    }

    // Hide all contents
    document.querySelectorAll('.page-content, #hero-section, #mesh-strip, #slogan-strip').forEach(el => {
        if(el) el.style.display = 'none';
    });

    // Show target
    const targetEl = document.getElementById(targetId);
    if (targetEl) targetEl.style.display = 'block';

    // Header logic
    if (targetId !== 'hero-section') {
        dashHeader?.classList.add('reveal');
        document.body.classList.add('header-active');
    }

    // Close mobile menu
    window.toggleMenu(false);

    // Load dynamic data
    if (targetId === 'home-page' || targetId === 'farmer-portal') window.loadNearbyEcosystem();
    if (targetId === 'marketplace') window.loadMarketplace();
    if (targetId === 'farmer-portal') window.loadFarmerListings();
};

window.goBack = () => {
    if (navHistory.length > 1) {
        navHistory.pop(); 
        window.showPage(navHistory[navHistory.length - 1]);
    } else {
        window.showPage('home-page');
    }
};

/* --- 5. ECOSYSTEM & SEARCH --- */
window.executeSearch = () => {
    const queryStr = document.getElementById('home-search-unified')?.value.toLowerCase();
    console.log("Unified Search triggered for:", queryStr);
    // Future: Add Firebase query filter logic here
    renderEcosystem(queryStr);
};

window.loadNearbyEcosystem = async () => {
    const list = document.getElementById('nearby-prism-list');
    if (!list) return;

    if (ecosystemCache.length === 0) {
        list.innerHTML = `<div class="prism-card"><p>📡 Loading global ecosystem...</p></div>`;
        try {
            const q = query(collection(db, "users"), where("role", "in", ["farm", "marketer", "trans"]));
            const snap = await getDocs(q);
            ecosystemCache = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (err) {
            list.innerHTML = "<p>Error connecting to network.</p>";
            return;
        }
    }
    renderEcosystem();
};

function renderEcosystem(filter = "") {
    const list = document.getElementById('nearby-prism-list');
    if(!list) return;
    list.innerHTML = "";

    const filtered = ecosystemCache.filter(user => {
        if (user.uid === auth.currentUser?.uid) return false;
        const searchPool = `${user.businessName} ${user.location} ${user.role}`.toLowerCase();
        return searchPool.includes(filter.toLowerCase());
    });

    if (filtered.length === 0) {
        list.innerHTML = "<p>No matches found in your area.</p>";
        return;
    }

    filtered.forEach(data => {
        const card = document.createElement('div');
        card.className = "prism-card glass-card";
        const icons = { farm: '🚜 Farmer', marketer: '🏪 Marketer', trans: '🚚 Logistics' };
        card.innerHTML = `
            <span class="prism-tag">${icons[data.role] || 'Partner'}</span>
            <h3>${data.businessName || "Registered Partner"}</h3>
            <p>📍 ${data.location || 'Remote'}</p>
            <div style="display:flex; gap:10px; margin-top:15px;">
                <button class="btn-brand" style="padding:8px 15px; width:auto;" onclick="showPage('marketplace')">Products</button>
                <button class="btn-outline" style="padding:8px 15px; width:auto;" onclick="openFarmChat('${data.uid}', '${data.businessName}')">💬 Chat</button>
            </div>`;
        list.appendChild(card);
    });
}

/* --- 6. MARKETPLACE & FARMER TOOLS --- */
window.openUploadModal = () => document.getElementById('upload-modal').style.display = 'block';
window.closeUploadModal = () => document.getElementById('upload-modal').style.display = 'none';

window.submitHarvest = async () => {
    const name = document.getElementById('p-name').value;
    const price = document.getElementById('p-price').value;
    const unit = document.getElementById('p-unit-modal').value;
    const desc = document.getElementById('p-desc')?.value || "";

    if(!name || !price) return alert("Fill fields.");
    try {
        await addDoc(collection(db, "products"), {
            name, price, unit, desc,
            farmerId: auth.currentUser.uid,
            businessName: localStorage.getItem('bizName') || "Local Farm",
            createdAt: serverTimestamp()
        });
        alert("Published!");
        window.closeUploadModal();
        window.loadFarmerListings();
    } catch (e) { alert("Upload failed"); }
};

window.loadMarketplace = async () => {
    const marketGrid = document.getElementById('product-list');
    if(!marketGrid) return;
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    marketGrid.innerHTML = ''; 
    snap.forEach((docSnap) => {
        const data = docSnap.data();
        const card = document.createElement('div');
        card.className = 'product-card glass-card';
        card.innerHTML = `
            <small class="prism-tag">🚜 ${data.businessName || 'Farmer'}</small>
            <h4>${data.name}</h4>
            <p class="price">₦${data.price} / ${data.unit}</p>
            <div style="display:flex; gap:5px; margin-top:10px;">
                <button class="btn-brand" onclick="alert('Coming Soon')">🛒 Buy</button>
                <button class="btn-outline" onclick="openFarmChat('${data.farmerId}', '${data.businessName}')">💬 Chat</button>
            </div>`;
        marketGrid.appendChild(card);
    });
};

window.loadFarmerListings = async () => {
    const grid = document.getElementById('farmer-listings-grid');
    if(!grid || !auth.currentUser) return;
    const q = query(collection(db, "products"), where("farmerId", "==", auth.currentUser.uid));
    const snap = await getDocs(q);
    grid.innerHTML = snap.empty ? "<p>No active listings.</p>" : "";
    snap.forEach(d => {
        const data = d.data();
        grid.innerHTML += `<div class="product-card glass-card"><h4>${data.name}</h4><p>₦${data.price} / ${data.unit}</p></div>`;
    });
};

/* --- 7. CHAT & MESSAGING --- */
window.openFarmChat = async (recipientId, recipientName) => {
    if (!auth.currentUser) return alert("Please login first.");
    const userId = auth.currentUser.uid;
    activeChatId = userId < recipientId ? `${userId}_${recipientId}` : `${recipientId}_${userId}`;
    document.getElementById('active-chat-name').innerText = `Messaging: ${recipientName}`;
    window.showPage('chat-window');
    loadMessages(activeChatId);
};

window.sendMessage = async () => {
    const input = document.getElementById('chat-input');
    if (!input || !input.value.trim() || !activeChatId) return;
    const ids = activeChatId.split('_');
    const recipientId = ids.find(id => id !== auth.currentUser.uid);

    try {
        const msg = {
            senderId: auth.currentUser.uid,
            senderName: localStorage.getItem('bizName') || auth.currentUser.email.split('@')[0],
            text: input.value,
            timestamp: serverTimestamp()
        };
        await addDoc(collection(db, `chats/${activeChatId}/messages`), msg);
        await setDoc(doc(db, "users", recipientId, "notifications", auth.currentUser.uid), {
            from: msg.senderName,
            status: "unread",
            at: serverTimestamp()
        });
        input.value = "";
    } catch (e) { console.error(e); }
};

function loadMessages(chatId) {
    if (chatUnsubscribe) chatUnsubscribe(); 
    const display = document.getElementById('message-display');
    const q = query(collection(db, `chats/${chatId}/messages`), orderBy("timestamp", "asc"));
    chatUnsubscribe = onSnapshot(q, (snap) => {
        if(!display) return;
        display.innerHTML = "";
        snap.forEach(doc => {
            const d = doc.data();
            const isMe = d.senderId === auth.currentUser.uid;
            display.innerHTML += `<div class="message ${isMe?'sent':'received'}"><p>${d.text}</p></div>`;
        });
        display.scrollTop = display.scrollHeight;
    });
}

async function clearMyNotifications() {
    if (!auth.currentUser) return;
    const notifSnap = await getDocs(collection(db, "users", auth.currentUser.uid, "notifications"));
    notifSnap.forEach(async (d) => {
        await deleteDoc(doc(db, "users", auth.currentUser.uid, "notifications", d.id));
    });
}

/* --- 8. AUTH OBSERVER --- */
onAuthStateChanged(auth, async (user) => {
    const hero = document.getElementById('hero-section');
    const appContainer = document.getElementById('app-container');
    const dashHeader = document.getElementById('dashboard-header');
    const guestHeader = document.getElementById('guest-header');
    const authBtn = document.getElementById('main-auth-btn');

    if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            cachedUserRole = data.role;
            localStorage.setItem('userRole', data.role);
            localStorage.setItem('bizName', data.businessName || "");

            if(guestHeader) guestHeader.style.display = 'none';

            if(authBtn) {
                authBtn.innerText = `Continue as ${data.businessName || user.email.split('@')[0]}`;
                authBtn.onclick = () => window.revealDashboard();
            }

            // Real-time Notifications
            onSnapshot(collection(db, "users", user.uid, "notifications"), (snap) => {
                const badge = document.getElementById('notif-badge');
                const bell = document.getElementById('notif-bell-container');
                if (snap.size > 0) {
                    badge.innerText = snap.size;
                    badge.style.display = 'block';
                    bell.classList.add('bell-ring');
                } else {
                    badge.style.display = 'none';
                    bell.classList.remove('bell-ring');
                }
            });
        }
    } else {
        if(appContainer) appContainer.style.display = 'none';
        if(dashHeader) dashHeader.classList.remove('reveal');
        if(guestHeader) guestHeader.style.display = 'block';
        if(hero) hero.style.display = 'block';
        window.setAuthMode('login'); 
    }
});

/* --- 9. UTILITIES --- */
window.toggleMenu = (force) => {
    const menu = document.getElementById('nav-menu');
    const overlay = document.getElementById('menu-overlay');
    if(!menu) return;
    const active = typeof force === 'boolean' ? force : menu.classList.toggle('active');
    if(active) menu.classList.add('active'); else menu.classList.remove('active');
    if(overlay) overlay.style.display = active ? 'block' : 'none';
};

window.logoutUser = () => { 
    if(chatUnsubscribe) chatUnsubscribe();
    signOut(auth).then(() => { localStorage.clear(); location.reload(); });
};

window.togglePasswordVisibility = () => {
    const passInput = document.getElementById('login-pass');
    const passIcon = document.getElementById('pass-icon');
    if (!passInput || !passIcon) return;

    if (passInput.type === 'password') {
        passInput.type = 'text';
        passIcon.innerText = '🙈';
        passIcon.style.color = 'var(--green)';
    } else {
        passInput.type = 'password';
        passIcon.innerText = '👁️';
        passIcon.style.color = '#666';
    }
};

/* --- 10. INITIALIZATION --- */
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-theme');
    setTimeout(() => { 
        const loader = document.getElementById('boot-loader');
        if(loader) loader.style.display = 'none'; 
    }, 1500);
});