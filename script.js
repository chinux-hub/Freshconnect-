// 1. FIREBASE IMPORTS
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { 
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, 
    onAuthStateChanged, signOut, sendPasswordResetEmail, deleteUser 
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";
import { 
    getFirestore, doc, setDoc, getDoc, collection, addDoc, 
    getDocs, query, orderBy, serverTimestamp, where, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

// 2. CONFIGURATION
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

let currentMode = 'login';
let cachedUserRole = localStorage.getItem('userRole') || null;
let activeChatId = null;

/* --- 3. AUTHENTICATION --- */
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
    if(authBtn) authBtn.innerText = labels[mode] || "Enter Ecosystem";
};

window.handleAuth = async () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    const bizName = document.getElementById('biz-name')?.value || "";
    const bizLoc = document.getElementById('biz-loc')?.value || "";
    if (!email || !pass) return alert("Please enter credentials.");

    try {
        if (currentMode === 'login') {
            await signInWithEmailAndPassword(auth, email, pass);
        } else {
            const userCred = await createUserWithEmailAndPassword(auth, email, pass);
            await setDoc(doc(db, "users", userCred.user.uid), { 
                email, role: currentMode, businessName: bizName, 
                location: bizLoc, createdAt: serverTimestamp() 
            });
            cachedUserRole = currentMode;
            localStorage.setItem('userRole', currentMode);
        }
    } catch (e) { alert(e.message); }
};

/* --- 4. NAVIGATION ENGINE --- */
window.showPage = (id) => {
    const role = cachedUserRole || localStorage.getItem('userRole');
    let targetId = id;

    if (id === 'home-page') {
        if (role === 'farm') targetId = 'farmer-portal';
        else if (role === 'marketer') targetId = 'marketer-portal';
    }

    document.querySelectorAll('.page-content, #hero-section, #mesh-strip, #slogan-strip').forEach(el => {
        if(el) el.style.display = 'none';
    });

    const targetEl = document.getElementById(targetId);
    if (targetEl) targetEl.style.display = 'block';

    if(targetId === 'marketplace') window.loadMarketplace();
    if(targetId === 'farmer-portal') window.loadFarmerListings();
    if(targetId === 'marketer-portal') window.loadMarketerInventory();
    
    document.getElementById('nav-menu')?.classList.remove('active');
};

/* --- 5. FARMER PORTAL & UPLOAD --- */
window.openUploadModal = () => document.getElementById('upload-modal').style.display = 'block';
window.closeUploadModal = () => document.getElementById('upload-modal').style.display = 'none';

window.submitHarvest = async () => {
    const name = document.getElementById('p-name').value;
    const price = document.getElementById('p-price').value;
    const unit = document.getElementById('p-unit-modal').value;
    const desc = document.getElementById('p-desc').value;

    if(!name || !price) return alert("Please fill basic info.");

    try {
        await addDoc(collection(db, "products"), {
            name, price, unit, desc,
            farmerId: auth.currentUser.uid,
            businessName: localStorage.getItem('bizName') || "Local Farmer",
            createdAt: serverTimestamp()
        });
        alert("Harvest Published!");
        window.closeUploadModal();
        window.loadFarmerListings();
    } catch (e) { alert(e.message); }
};

window.loadFarmerListings = async () => {
    const grid = document.getElementById('farmer-listings-grid');
    if(!grid || !auth.currentUser) return;
    const q = query(collection(db, "products"), where("farmerId", "==", auth.currentUser.uid));
    const snap = await getDocs(q);
    grid.innerHTML = snap.empty ? '<p>No listings yet.</p>' : '';
    snap.forEach(d => {
        const data = d.data();
        grid.innerHTML += `<div class="product-card glass-card"><h4>${data.name}</h4><p>₦${data.price} / ${data.unit}</p></div>`;
    });
};

/* --- 6. MARKETPLACE --- */
window.loadMarketplace = async () => {
    const marketGrid = document.getElementById('product-list');
    if(!marketGrid) return;
    marketGrid.innerHTML = `<p>Loading harvest...</p>`;
    try {
        const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        marketGrid.innerHTML = ''; 
        snap.forEach((docSnap) => {
            const data = docSnap.data();
            const isMyProduct = data.farmerId === auth.currentUser?.uid;
            const card = document.createElement('div');
            card.className = 'product-card glass-card';
            
            let actionBtn = isMyProduct ? `<button class="btn-secondary" disabled>Your Listing</button>` :
                           (cachedUserRole === 'marketer' ? `<button class="btn-brand" style="background:#2ecc71" onclick="openResaleModal('${docSnap.id}')">Add to Shop</button>` :
                           `<button class="btn-brand" onclick="placeOrder('${docSnap.id}')">🛒 Buy Now</button>`);

            card.innerHTML = `
                <h4>${data.name}</h4>
                <p class="price">₦${data.price} / ${data.unit}</p>
                <div style="display:flex; gap:5px; flex-wrap: wrap;">
                    ${actionBtn}
                    <button class="btn-outline" onclick="openFarmChat('${data.farmerId}', '${data.businessName || 'Farmer'}')">💬 Chat</button>
                </div>`;
            marketGrid.appendChild(card);
        });
    } catch (e) { marketGrid.innerHTML = `<p>Error loading items.</p>`; }
};

/* --- 7. CHAT SYSTEM --- */
window.openFarmChat = async (farmerId, farmName) => {
    const userId = auth.currentUser.uid;
    activeChatId = userId < farmerId ? `${userId}_${farmerId}` : `${farmerId}_${userId}`;
    const header = document.getElementById('active-chat-name');
    if(header) header.innerText = `Chatting regarding ${farmName}`;
    window.showPage('chat-window');
    loadMessages(activeChatId);
};

window.sendMessage = async () => {
    const input = document.getElementById('chat-input');
    if (!input.value || !activeChatId) return;
    await addDoc(collection(db, `chats/${activeChatId}/messages`), {
        senderId: auth.currentUser.uid,
        senderName: auth.currentUser.email.split('@')[0],
        text: input.value,
        timestamp: serverTimestamp()
    });
    input.value = "";
};

function loadMessages(chatId) {
    const display = document.getElementById('message-display');
    const q = query(collection(db, `chats/${chatId}/messages`), orderBy("timestamp", "asc"));
    onSnapshot(q, (snap) => {
        if(!display) return;
        display.innerHTML = "";
        snap.forEach(doc => {
            const d = doc.data();
            const isMe = d.senderId === auth.currentUser.uid;
            display.innerHTML += `<div class="message ${isMe?'sent':'received'}"><small>${d.senderName}</small><p>${d.text}</p></div>`;
        });
        display.scrollTop = display.scrollHeight;
    });
}

/* --- 8. CORE OBSERVER --- */
onAuthStateChanged(auth, async (user) => {
    const appContainer = document.getElementById('app-container');
    const hero = document.getElementById('hero-section');
    const guestHeader = document.getElementById('guest-header');
    const dashHeader = document.getElementById('dashboard-header');

    if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            cachedUserRole = data.role;
            localStorage.setItem('userRole', cachedUserRole);
            localStorage.setItem('bizName', data.businessName || "");
        }
        if(guestHeader) guestHeader.style.display = 'none';
        if(dashHeader) dashHeader.style.display = 'block';
        if(appContainer) appContainer.style.display = 'block';
        if(hero) hero.style.display = 'none';
        window.showPage('home-page');
    } else {
        if(guestHeader) guestHeader.style.display = 'block';
        if(dashHeader) dashHeader.style.display = 'none';
        if(appContainer) appContainer.style.display = 'none';
        if(hero) hero.style.display = 'block';
        window.showPage('hero-section');
    }
});

// Settings & Utilities
window.toggleTheme = () => {
    const isDark = document.body.classList.toggle('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
};
window.logoutUser = () => { signOut(auth); localStorage.clear(); };

window.addEventListener('load', () => {
    if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-theme');
    setTimeout(() => { document.getElementById('boot-loader').style.display = 'none'; }, 1800);
});
window.toggleMenu = () => {
    const menu = document.getElementById('nav-menu');
    menu.classList.toggle('active');
};
window.showPage = (id) => {
    const role = cachedUserRole || localStorage.getItem('userRole');
    let targetId = id;

    // Automatic redirection for the "Home" button based on role
    if (id === 'home-page') {
        if (role === 'farm') targetId = 'farmer-portal';
        else if (role === 'marketer') targetId = 'marketer-portal';
        else if (role === 'trans') targetId = 'logistics-page';
        else targetId = 'home-page'; // Default for Customer
    }

    // Hide all views
    document.querySelectorAll('.page-content, #hero-section, #mesh-strip, #slogan-strip').forEach(el => {
        if(el) el.style.display = 'none';
    });

    // Show selected view
    const targetEl = document.getElementById(targetId);
    if (targetEl) targetEl.style.display = 'block';

    // Trigger specific data loads
    if(targetId === 'marketplace') window.loadMarketplace();
    if(targetId === 'farmer-portal') window.loadFarmerListings();
    if(targetId === 'logistics-page') console.log("Logistics Jobs Loaded");
};
