<script type="module">
    // 1. IMPORTS
    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
    // On importe getAuth et les fonctions nécessaires
    import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
    import { getFirestore, collection, addDoc, getDocs, query, where, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
    
    // 2. CONFIGURATION (Celle que tu m'as donnée)
    const firebaseConfig = {
      apiKey: "AIzaSyBKhKfAjLnwB_6sLmxCfqqsQar3dui1uWg",
      authDomain: "whatquiz-porf.firebaseapp.com",
      projectId: "whatquiz-porf",
      storageBucket: "whatquiz-porf.firebasestorage.app",
      messagingSenderId: "845440438526",
      appId: "1:845440438526:web:68fba6143ed4bee28895af",
      measurementId: "G-E0LXVXWMRL"
    };
    
    // 3. INITIALISATION
    // On initialise l'app d'abord
    const app = initializeApp(firebaseConfig);
    
    // IMPORTANT : On passe 'app' explicitement à getAuth et getFirestore
    // C'est souvent la cause de l'erreur "configuration-not-found" si omis
    const auth = getAuth(app); 
    const db = getFirestore(app);
    
    // --- VARIABLES GLOBALES ---
    const $ = id => document.getElementById(id);
    let currentUser = null;
    let isRegistering = false;
    
    // --- SOCKET IO (Optionnel tant que le serveur Node ne tourne pas) ---
    // Si tu n'as pas lancé le serveur Node.js, ceci fera une erreur silencieuse, c'est normal.
    let socket = null;
    try {
        socket = io("http://localhost:3000"); // Ou ton URL serveur
    } catch(e) { console.log("Socket server not running"); }

    // --- LOGIQUE D'INTERFACE (Toast) ---
    const toast = (msg) => {
        const t = document.createElement('div'); 
        t.className='toast'; 
        t.innerText = msg;
        $('toasts').appendChild(t); 
        setTimeout(()=>t.remove(), 3000);
    }

    // --- GESTION LOGIN / INSCRIPTION ---
    // Bascule entre les onglets
    $('tab-login').onclick = () => { isRegistering=false; updateAuthUI(); }
    $('tab-register').onclick = () => { isRegistering=true; updateAuthUI(); }

    function updateAuthUI() {
        $('tab-login').className = isRegistering ? 'auth-tab' : 'auth-tab active';
        $('tab-register').className = isRegistering ? 'auth-tab active' : 'auth-tab';
        $('register-fields').classList.toggle('hidden', !isRegistering);
        // Change le texte du bouton
        $('auth-form').querySelector('button').innerText = isRegistering ? "S'inscrire" : "Se connecter";
    }

    // SOUMISSION DU FORMULAIRE
    $('auth-form').onsubmit = async (e) => {
        e.preventDefault(); // Empêche le rechargement de page
        
        const email = $('auth-email').value;
        const pass = $('auth-pass').value;
        const btn = $('auth-form').querySelector('button');
        
        if(!email || !pass) return toast("Email et mot de passe requis");

        // Petit effet de chargement
        btn.innerText = "Chargement...";
        btn.disabled = true;

        try {
            if(isRegistering) {
                // --- INSCRIPTION ---
                const name = $('auth-name').value;
                const role = $('auth-role').value;
                
                if(!name) throw new Error("Le nom est obligatoire");
                
                // 1. Créer l'utilisateur dans Auth
                const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
                const user = userCredential.user;
                
                // 2. Mettre à jour le profil (Nom affiché)
                await updateProfile(user, { displayName: name });
                
                // 3. Sauvegarder le rôle dans Firestore (Base de données)
                await setDoc(doc(db, "users", user.uid), {
                    name: name,
                    email: email,
                    role: role,
                    createdAt: new Date()
                });
                
                toast("Compte créé avec succès !");
            } else {
                // --- CONNEXION ---
                await signInWithEmailAndPassword(auth, email, pass);
                toast("Connexion réussie !");
            }
        } catch(error) {
            console.error(error); // Affiche le détail dans la console du navigateur (F12)
            
            // Gestion des messages d'erreur courants en Français
            let msg = error.message;
            if(msg.includes("auth/email-already-in-use")) msg = "Cet email est déjà utilisé.";
            if(msg.includes("auth/wrong-password")) msg = "Mauvais mot de passe.";
            if(msg.includes("auth/user-not-found")) msg = "Aucun compte avec cet email.";
            if(msg.includes("auth/weak-password")) msg = "Le mot de passe doit faire 6 caractères min.";
            if(msg.includes("auth/configuration-not-found")) msg = "Erreur config: Activez Email/Password dans la console Firebase !";
            
            toast("Erreur : " + msg);
        } finally {
            btn.disabled = false;
            updateAuthUI(); // Remet le texte du bouton
        }
    };
    
    // --- ÉCOUTEUR D'ÉTAT (Connecté ou non) ---
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // L'utilisateur est connecté
            $('view-auth').classList.add('hidden');
            $('btn-logout').classList.remove('hidden');
            
            // On récupère ses infos (rôle) depuis Firestore
            const docSnap = await getDoc(doc(db, "users", user.uid));
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                currentUser = { uid: user.uid, ...data };
                
                // Redirection selon le rôle
                if(data.role === 'teacher') {
                    document.querySelector('#view-teacher').classList.remove('hidden');
                    $('teacher-name-display').innerText = data.name;
                    // Ici tu pourras charger les quiz
                } else {
                    document.querySelector('#view-student').classList.remove('hidden');
                }
            } else {
                // Cas rare : Auth existe mais pas Firestore
                toast("Erreur profil utilisateur.");
            }
            
        } else {
            // L'utilisateur est déconnecté
            currentUser = null;
            $('view-auth').classList.remove('hidden');
            document.querySelector('#view-teacher').classList.add('hidden');
            document.querySelector('#view-student').classList.add('hidden');
            $('btn-logout').classList.add('hidden');
        }
    });

    // BOUTON DÉCONNEXION
    $('btn-logout').onclick = () => {
        signOut(auth);
        toast("Déconnecté.");
    };

</script>