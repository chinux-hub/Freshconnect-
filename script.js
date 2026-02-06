import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";

// 1. FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyCDgUtehRa6LfMta2fdgk5c2Hup3jFYLWA",
  authDomain: "freshconnect-23653.firebaseapp.com",
  projectId: "freshconnect-23653",
  storageBucket: "freshconnect-23653.firebasestorage.app",
  messagingSenderId: "1002039870276",
  appId: "1:1002039870276:web:3d95e5c7e8347b526e0d11"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Global Flags
let isLoggingInManually = false;

// 2. THE GATEKEEPER
onAuthStateChanged(auth, (user) => {
    const mainNav = document.getElementById('main-nav');
    const navbar = document.getElementById('nav-header');
    const heroSection = document.getElementById('hero-section');
    
    if (user) {
        // Apply Dashboard Visuals (Purple-Green)
        if(mainNav) mainNav.style.display = "flex";
        if(navbar) navbar.classList.add('dashboard-active'); 
        
        // ONLY redirect if the user clicked a login button explicitly
        if(isLoggingInManually) {
            window.showPage('marketplace');
            isLoggingInManually = false;
        }
    } else {
        // Revert to Standard Theme
        if(mainNav) mainNav.style.display = "none";
        if(navbar) navbar.classList.remove('dashboard-active');
        
        document.querySelectorAll('section').forEach(sec => sec.style.display = 'none');
        if(heroSection) heroSection.style.display = 'block';
    }
});

// 3. AUTHENTICATION ACTIONS
const loginForm = document.getElementById('main-login-form');
if(loginForm) {
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        isLoggingInManually = true; 
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-pass').value;
        try {
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (error) {
            isLoggingInManually = false;
            alert("Login Failed: Check your credentials.");
        }
    };
}

const googleBtn = document.getElementById('google-signin');
if(googleBtn) {
    googleBtn.onclick = async () => {
        isLoggingInManually = true; 
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            isLoggingInManually = false;
            alert("Google Sign-in Failed");
        }
    };
}

window.logoutUser = async function() {
    try {
        await signOut(auth);
        isLoggingInManually = false; 
    } catch (error) {
        console.error("Logout Error", error);
    }
};

// 4. NAVIGATION & UI LOGIC
window.showPage = function(pageId) {
    const user = auth.currentUser;
    const privatePages = ['marketplace', 'chat-window', 'settings-page', 'farm-reg-section'];
    
    if (privatePages.includes(pageId) && !user) {
        alert("Please login first!");
        return; 
    }

    document.querySelectorAll('section, main.hero').forEach(sec => sec.style.display = 'none');
    const target = document.getElementById(pageId);
    if (target) {
        target.style.display = 'block';
        if(pageId === 'marketplace') loadFarms();
        window.scrollTo(0,0);
    }
};

window.toggleAuth = function() {
    const login = document.getElementById('login-form');
    const signup = document.getElementById('signup-form');
    login.style.display = login.style.display === "none" ? "block" : "none";
    signup.style.display = signup.style.display === "none" ? "block" : "none";
};

window.togglePasswordVisibility = function(inputId) {
    const passwordInput = document.getElementById(inputId);
    const toggleIcon = passwordInput.nextElementSibling;
    if (passwordInput.type === "password") {
        passwordInput.type = "text";
        toggleIcon.innerText = "🔒"; 
    } else {
        passwordInput.type = "password";
        toggleIcon.innerText = "👁️"; 
    }
};

// 5. FARMER & SETTINGS LOGIC (RESTORED)
window.switchToFarmerLogin = function() {
    const title = document.getElementById('login-title');
    if(title) title.innerText = "Farmer Login";
    document.getElementById('farmer-prompt').style.opacity = "0.7";
};

window.switchUserRole = function() {
    const roleBtn = document.getElementById('current-role');
    if(!roleBtn) return;
    const isCustomer = roleBtn.innerText === "Customer";
    roleBtn.innerText = isCustomer ? "Farmer" : "Customer";
    alert(`Switched to ${roleBtn.innerText} mode!`);
};

// Farm Registration Form Handler
const farmForm = document.getElementById('farmForm');
if(farmForm) {
    farmForm.onsubmit = async (e) => {
        e.preventDefault();
        const farmName = farmForm.querySelector('input[placeholder="Farm Name"]').value;
        const location = farmForm.querySelector('input[placeholder="Location"]').value;
        
        try {
            await addDoc(collection(db, "farms"), {
                name: farmName,
                location: location,
                timestamp: serverTimestamp()
            });
            alert("Farm Registered Successfully!");
            window.showPage('marketplace');
        } catch (err) {
            alert("Error: " + err.message);
        }
    };
}

// 6. DATA & CHAT
async function loadFarms() {
    const productList = document.getElementById('product-list');
    if(!productList) return;
    try {
        const q = query(collection(db, "farms"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        productList.innerHTML = "";
        querySnapshot.forEach((doc) => {
            const farm = doc.data();
            productList.innerHTML += `
                <div class="product-card premium-card">
                    <div class="badge">🚜 Verified</div>
                    <img src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=300" alt="Farm">
                    <div class="product-info">
                        <h4>${farm.name}</h4>
                        <p>📍 ${farm.location}</p>
                        <div class="price-row">
                            <span class="price-tag purple-green-text">Active</span>
                            <button class="btn-msg" onclick="showPage('chat-window')">💬 Message</button>
                        </div>
                    </div>
                </div>`;
        });
    } catch (e) { console.error(e); }
}

const sendBtn = document.getElementById('send-trigger');
if(sendBtn) {
    sendBtn.onclick = () => {
        const chatInput = document.getElementById('user-msg');
        const msgDisplay = document.getElementById('msg-display');
        if(chatInput.value.trim() === "") return;
        const msg = document.createElement('div');
        msg.className = 'message sent purple-bubble'; 
        msg.innerHTML = `<span>${chatInput.value}</span>`;
        msgDisplay.appendChild(msg);
        chatInput.value = "";
        msgDisplay.scrollTop = msgDisplay.scrollHeight;
    };
}
