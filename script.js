import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, getDoc, doc,
  query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";
import {
  getAuth, signInWithPopup, GoogleAuthProvider,
  signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";

/* =====================================================
   1. FIREBASE INITIALIZATION
===================================================== */
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

let isLoggingInManually = false;
let currentUserRole = "customer";

/* =====================================================
   2. AUTH STATE + ROLE GATEKEEPER
===================================================== */
onAuthStateChanged(auth, async (user) => {
  const mainNav = document.getElementById("main-nav");
  const navbar = document.getElementById("nav-header");
  const hero = document.getElementById("hero-section");

  if (user) {
    mainNav.style.display = "flex";
    navbar.classList.add("dashboard-active");

    // 🔐 Load user role
    const roleSnap = await getDoc(doc(db, "users", user.uid));
    if (roleSnap.exists()) {
      currentUserRole = roleSnap.data().role;
      document.getElementById("current-role") &&
        (document.getElementById("current-role").innerText = currentUserRole);
    }

    if (isLoggingInManually) {
      showPage("marketplace");
      isLoggingInManually = false;
    }
  } else {
    mainNav.style.display = "none";
    navbar.classList.remove("dashboard-active");
    document.querySelectorAll("section").forEach(s => s.style.display = "none");
    hero.style.display = "block";
  }
});

/* =====================================================
   3. AUTH ACTIONS
===================================================== */
document.getElementById("main-login-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  isLoggingInManually = true;

  try {
    await signInWithEmailAndPassword(
      auth,
      login-email.value.trim(),
      login-pass.value
    );
  } catch {
    isLoggingInManually = false;
    alert("Invalid login details");
  }
});

document.getElementById("google-signin")?.addEventListener("click", async () => {
  isLoggingInManually = true;
  try {
    await signInWithPopup(auth, provider);
  } catch {
    isLoggingInManually = false;
    alert("Google sign-in failed");
  }
});

window.logoutUser = async () => {
  await signOut(auth);
};

/* =====================================================
   4. NAVIGATION
===================================================== */
window.showPage = function (pageId) {
  const user = auth.currentUser;
  const protectedPages = [
    "marketplace", "chat-window",
    "settings-page", "farmer-dashboard"
  ];

  if (protectedPages.includes(pageId) && !user) {
    alert("Please login first");
    return;
  }

  document.querySelectorAll("section, main.hero")
    .forEach(el => el.style.display = "none");

  document.getElementById(pageId).style.display = "block";

  if (pageId === "marketplace") loadMarketplace();
};

/* =====================================================
   5. ROLE SWITCHING (Customer ↔ Farmer ↔ Middleman)
===================================================== */
window.switchUserRole = async () => {
  const roles = ["customer", "farmer", "middleman"];
  const nextRole = roles[(roles.indexOf(currentUserRole) + 1) % roles.length];
  currentUserRole = nextRole;

  await addDoc(collection(db, "users"), {
    uid: auth.currentUser.uid,
    role: nextRole
  });

  document.getElementById("current-role").innerText = nextRole;
  alert(`Switched to ${nextRole}`);
};

/* =====================================================
   6. FARM REGISTRATION (FARMERS ONLY)
===================================================== */
document.getElementById("farmForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (currentUserRole !== "farmer") return alert("Only farmers can register farms");

  await addDoc(collection(db, "farms"), {
    name: farmForm.querySelector("input[placeholder='Farm Name']").value,
    location: farmForm.querySelector("input[placeholder='Location']").value,
    owner: auth.currentUser.uid,
    createdAt: serverTimestamp()
  });

  alert("Farm registered");
  showPage("farmer-dashboard");
});

/* =====================================================
   7. PRODUCT UPLOAD (FARMER & MIDDLEMAN)
===================================================== */
document.getElementById("product-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!["farmer", "middleman"].includes(currentUserRole)) {
    return alert("Only sellers can post products");
  }

  const name = e.target[0].value;
  const price = e.target[1].value;
  const file = e.target[2].files[0];

  // 🧠 Auto image fallback
  const imageUrl = file
    ? URL.createObjectURL(file)
    : `https://source.unsplash.com/600x400/?${encodeURIComponent(name)},farm,food`;

  await addDoc(collection(db, "products"), {
    name,
    price,
    image: imageUrl,
    sellerRole: currentUserRole,
    owner: auth.currentUser.uid,
    createdAt: serverTimestamp()
  });

  alert("Product posted");
  e.target.reset();
});

/* =====================================================
   8. MARKETPLACE LOADING (PRODUCT BASED)
===================================================== */
async function loadMarketplace() {
  const grids = document.querySelectorAll(".product-grid");
  grids.forEach(g => g.innerHTML = "");

  const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);

  snap.forEach(docu => {
    const p = docu.data();
    const gridIndex = p.sellerRole === "farmer" ? 0 : 1;

    grids[gridIndex].innerHTML += `
      <div class="product-card morph-card">
        <span class="badge ${p.sellerRole === "farmer" ? "farm-badge" : "middleman-badge"}">
          ${p.sellerRole === "farmer" ? "🌾 Farm Fresh" : "🧑‍💼 Market Seller"}
        </span>
        <img src="${p.image}" class="${p.image.includes('unsplash') ? 'auto-image' : ''}">
        <h4>${p.name}</h4>
        <p>₦${p.price}</p>
        <button class="btn-chat" onclick="showPage('chat-window')">Chat</button>
      </div>
    `;
  });
}

/* =====================================================
   9. CHAT (UI READY – FIRESTORE EXTENDABLE)
===================================================== */
document.getElementById("send-trigger")?.addEventListener("click", () => {
  const input = document.getElementById("user-msg");
  const display = document.getElementById("msg-display");
  if (!input.value.trim()) return;

  display.innerHTML += `
    <div class="message sent">${input.value}</div>
  `;
  input.value = "";
  display.scrollTop = display.scrollHeight;
});