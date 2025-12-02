import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, where, updateDoc, getDocs } from 'firebase/firestore';
import { Loader, Mail, DollarSign, User, LogOut, UserPlus, Shield, CheckCircle, Clock, Smartphone, XCircle, TrendingUp, LogIn } from 'lucide-react';

// --- Configuration & Constants for Vercel/Vite deployment ---
// Vercel/Vite environment variables se Firebase keys fetch ki jaati hain.
// NOTE: Vercel mein aapko yeh variables (VITE_FIREBASE_API_KEY, etc.) set karne honge.
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID; 
const appId = projectId || 'default-app-id'; // Project ID ko stable App ID ki tarah use kar rahe hain
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const initializedConfig = firebaseConfig.apiKey ? firebaseConfig : null;

// --- Admin Email ---
const ADMIN_EMAIL = 'hamzadigitalhd@gmail.com'; 
const EMAIL_PRICE = 5; 
const OWNER_WHATSAPP = '+923132573544';

const App = () => { 
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('login'); 

  // Dashboard/Submission State
  const [emailToSubmit, setEmailToSubmit] = useState('');
  const [submissionMessage, setSubmissionMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userSubmissions, setUserSubmissions] = useState([]);

  // Admin State
  const [allSubmissions, setAllSubmissions] = useState([]);
  
  const isAdmin = useMemo(() => user && user.email === ADMIN_EMAIL, [user]);

  // 1. Firebase Initialization and Authentication
  useEffect(() => {
    try {
      if (!initializedConfig) {
        console.error("Firebase Configuration is missing. Please set Environment Variables in Vercel.");
        setLoading(false);
        setIsAuthReady(true);
        return; 
      }
      
      const app = initializeApp(initializedConfig);
      const firestore = getFirestore(app);
      const firebaseAuth = getAuth(app);
      
      setDb(firestore);
      setAuth(firebaseAuth);

      const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (currentUser) => {
        setUser(currentUser);
        setIsAuthReady(true);
        setLoading(false);
        if (currentUser) {
            if (currentUser.email === ADMIN_EMAIL) {
                setView('admin');
            } else {
                setView('dashboard');
            }
        } else {
             setView('login');
        }
      });

      return () => unsubscribeAuth();

    } catch (e) {
      console.error("Firebase Initialization Error:", e);
      setLoading(false);
      setIsAuthReady(true);
    }
  }, []); 

  // Define Firestore collection reference
  const submissionCollection = useMemo(() => {
    if (!db) return null;
    return collection(db, 'artifacts', appId, 'public', 'data', 'submitted_emails');
  }, [db, appId]);


  // 2. Data Listeners (Admin and User)
  useEffect(() => {
    if (!isAuthReady || !db || !submissionCollection || !user) return;

    let unsubscribeSnapshot;

    if (isAdmin) {
        // ADMIN: Fetch ALL submissions
        unsubscribeSnapshot = onSnapshot(submissionCollection, (snapshot) => {
            const submissions = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            submissions.sort((a, b) => b.submissionDate - a.submissionDate);
            setAllSubmissions(submissions);
        }, (e) => {
            console.error("Admin Snapshot Error:", e);
        });
    } else if (user && user.uid) { 
        // USER: Fetch only current user's submissions
        const userQuery = query(submissionCollection, where("submittedByUserId", "==", user.uid));
        unsubscribeSnapshot = onSnapshot(userQuery, (snapshot) => {
            const submissions = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            submissions.sort((a, b) => b.submissionDate - a.submissionDate);
            setUserSubmissions(submissions);
        }, (e) => {
            console.error("User Snapshot Error:", e);
        });
    }

    return () => { if(unsubscribeSnapshot) unsubscribeSnapshot(); };
  }, [isAuthReady, user, isAdmin, submissionCollection, db]);


  // 3. Authentication Handlers
  const handleAuth = async (isSignUp, email, password, setStatus) => {
    if (!auth) {
        setStatus("System error: Firebase Auth not initialized.");
        return;
    }
    setStatus('');
    setLoading(true);

    try {
      let userCredential;
      if (isSignUp) {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        setStatus("Registration successful! Logging in...");
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
        setStatus("Login successful! Redirecting...");
      }

      if (userCredential.user.email === ADMIN_EMAIL) {
          setView('admin');
      } else {
          setView('dashboard');
      }
      
    } catch (error) {
      console.error("Auth Error:", error);
      let msg = 'Authentication Failed. Check console for details.';
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
          msg = 'Invalid email or password.';
      } else if (error.code === 'auth/email-already-in-use' && isSignUp) {
          msg = 'This email is already registered. Please log in.';
      } else if (error.code === 'auth/weak-password') {
          msg = 'Password should be at least 6 characters.';
      }
      setStatus(`Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
      setUser(null);
      setView('login');
      setUserSubmissions([]);
      setAllSubmissions([]);
    }
  };

  // 4. Email Submission Logic
  const handleSubmitEmail = async (e) => {
    e.preventDefault();
    if (!user || isSubmitting || !emailToSubmit.trim() || !submissionCollection) return;

    const email = emailToSubmit.trim();
    if (!email.endsWith('@gmail.com')) {
        setSubmissionMessage("Kripya sirf valid '@gmail.com' ID daalein.");
        return;
    }

    setIsSubmitting(true);
    setSubmissionMessage('');

    try {
      // Check for Duplicate Email using query (Firestore's limit on OR queries means we can only check one field here)
      const emailQuery = query(submissionCollection, where("email", "==", email));
      const emailQuerySnapshot = await getDocs(emailQuery);

      if (!emailQuerySnapshot.empty) {
        setSubmissionMessage("Yeh Email ID pehle se darj hai. Kripya naya Gmail banakar daalein.");
        return;
      }

      const docRef = doc(submissionCollection, btoa(email)); 
      
      await setDoc(docRef, {
        email: email,
        submittedByUserId: user.uid,
        userName: user.email || 'Registered User', 
        submissionDate: Date.now(),
        price: EMAIL_PRICE, 
        status: 'Pending Verification', 
        isPaid: false,
      });

      setSubmissionMessage(`Aapka Gmail ID (${email}) darj ho gaya hai. Status 'Pending Verification' hai.`);
      setEmailToSubmit('');

    } catch (e) {
      console.error("Submission Error:", e);
      setSubmissionMessage("Email submit karne mein galti hui. Kripya dobara koshish karein.");
    } finally {
      setIsSubmitting(false);
    }
  };


  // 5. Admin Action Logic
  const handleAdminAction = async (submissionId, newStatus, isPaid) => {
    if (!isAdmin || !submissionCollection) return;
    
    const docRef = doc(submissionCollection, submissionId);
    
    try {
      await updateDoc(docRef, {
        status: newStatus,
        isPaid: isPaid,
        adminUpdatedAt: Date.now(),
        adminUpdatedBy: user.email,
      });
    } catch (e) {
      console.error("Admin Update Error:", e);
      console.error("STATUS UPDATE FAILED: Could not update document status in Firestore.");
    }
  };


  // --- UI Components ---

  const AuthForm = ({ type }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [status, setStatus] = useState('');

    const isSignUp = type === 'signup';
    
    return (
      <div className="w-full max-w-sm p-6 bg-stone-900 rounded-xl shadow-2xl border border-orange-500/20">
        <h2 className="text-3xl font-bold text-white mb-6 text-center">
          {isSignUp ? 'Naya Account Banaayein' : 'Login Karein'}
        </h2>
        <form onSubmit={(e) => { e.preventDefault(); handleAuth(isSignUp, email, password, setStatus); }} className="space-y-4">
          <input
            type="email"
            placeholder="Email ID"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 bg-stone-800 border border-stone-700 rounded text-white placeholder-stone-500 focus:ring-orange-500 focus:border-orange-500"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 bg-stone-800 border border-stone-700 rounded text-white placeholder-stone-500 focus:ring-orange-500 focus:border-orange-500"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded transition-colors disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? <Loader className="w-5 h-5 animate-spin mr-2" /> : (isSignUp ? <UserPlus className="w-5 h-5 mr-2" /> : <LogIn className="w-5 h-5 mr-2" />)}
            {isSignUp ? 'ID Banaayein (Sign Up)' : 'Login Karein'}
          </button>
        </form>
        {status && <p className="mt-4 text-sm text-center text-red-400">{status}</p>}
        
        <div className="mt-6 pt-4 border-t border-stone-700 text-center">
          <button 
            onClick={() => setView(isSignUp ? 'login' : 'signup')}
            className="text-sm text-orange-400 hover:text-orange-300"
          >
            {isSignUp ? 'Pehle se Account hai? Login karein.' : 'Account nahi hai? ID Banaayein.'}
          </button>
        </div>
      </div>
    );
  };
  
  // --- USER DASHBOARD ---
  const Dashboard = () => {
    const totalPending = userSubmissions.filter(s => s.status === 'Approved' && !s.isPaid).length * EMAIL_PRICE;
    const submissionsCount = userSubmissions.length;
    
    return (
      <div className="p-4 sm:p-8">
        <header className="flex justify-between items-center mb-6 border-b border-stone-800 pb-4">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <User className="w-6 h-6 text-orange-400" /> Aapka Dashboard
          </h1>
          <button onClick={handleLogout} className="text-sm bg-stone-800 hover:bg-stone-700 text-red-400 font-medium py-2 px-4 rounded-full flex items-center">
            <LogOut className="w-4 h-4 mr-2" /> Log Out
          </button>
        </header>

        {/* Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-stone-900 p-5 rounded-lg border border-orange-500/50 shadow-lg">
            <p className="text-sm text-stone-400">Aaj Ki Price</p>
            <h2 className="text-3xl font-bold text-orange-400 mt-1 flex items-center">
              <DollarSign className="w-6 h-6 mr-1" /> {EMAIL_PRICE} PKR
            </h2>
            <p className="text-xs text-stone-500 mt-1">Per valid Gmail ID</p>
          </div>
          <div className="bg-stone-900 p-5 rounded-lg border border-stone-800 shadow-lg">
            <p className="text-sm text-stone-400">Total Submissions</p>
            <h2 className="text-3xl font-bold text-white mt-1">{submissionsCount}</h2>
            <p className="text-xs text-stone-500 mt-1">Aapke emails</p>
          </div>
          <div className="bg-stone-900 p-5 rounded-lg border border-stone-800 shadow-lg">
            <p className="text-sm text-stone-400">Total Pending Earning</p>
            <h2 className="text-3xl font-bold text-yellow-400 mt-1 flex items-center">
               <DollarSign className="w-6 h-6 mr-1" /> {totalPending} PKR
            </h2>
            <p className="text-xs text-stone-500 mt-1">Total approved but not yet paid</p>
          </div>
        </div>

        {/* Email Submission Box */}
        <section className="bg-stone-900 p-6 rounded-lg mb-8 border border-stone-800">
          <h3 className="text-xl font-semibold text-white mb-4">Naya Gmail ID Darj Karein</h3>
          <p className="text-stone-400 mb-4 text-sm">
            Naya Gmail ID (sirf @gmail.com) banaayein aur yahan daalein.
          </p>
          <form onSubmit={handleSubmitEmail} className="flex flex-col sm:flex-row gap-4">
            <input
              type="email"
              placeholder="Naya Gmail ID daalein (example@gmail.com)"
              value={emailToSubmit}
              onChange={(e) => setEmailToSubmit(e.target.value)}
              className="flex-grow p-3 bg-stone-800 border border-stone-700 rounded text-white placeholder-stone-500 focus:ring-orange-500 focus:border-orange-500"
              required
              disabled={isSubmitting}
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="py-3 px-6 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              {isSubmitting ? <Loader className="w-5 h-5 animate-spin mr-2" /> : <Mail className="w-5 h-5 mr-2" />}
              Submit Karein
            </button>
          </form>
          {submissionMessage && (
            <p className={`mt-3 text-sm font-medium ${submissionMessage.includes('pehle se darj hai') || submissionMessage.includes('valid') ? 'text-red-400' : 'text-green-400'}`}>
              {submissionMessage}
            </p>
          )}
        </section>

        {/* Submission History */}
        <section>
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-400" /> Aapki History
          </h3>
          <p className="text-stone-500 mb-4 text-sm">Aapki payments 48 ghante ke andar process ki jaayengi.</p>

          <div className="overflow-x-auto bg-stone-900 rounded-lg border border-stone-800 shadow-xl">
            <table className="min-w-full divide-y divide-stone-800">
              <thead className="bg-stone-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-stone-400 uppercase tracking-wider">Gmail ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-stone-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-stone-400 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-stone-400 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800">
                {userSubmissions.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-4 text-center text-stone-500 italic">
                      Abhi tak koi submission nahi hai.
                    </td>
                  </tr>
                ) : (
                  userSubmissions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-stone-800/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{sub.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${sub.isPaid ? 'bg-blue-600 text-white' : 
                            sub.status === 'Approved' ? 'bg-green-100 text-green-800' :
                            sub.status === 'Declined' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'}`}>
                          {sub.isPaid ? 'Paid' : sub.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-300">
                        <span className="flex items-center">
                          {sub.price} PKR
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-500">
                        {new Date(sub.submissionDate).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Contact Info */}
        <div className="mt-12 p-4 bg-red-900/30 border border-red-700 rounded-lg text-sm text-stone-300">
            <h4 className="font-bold text-red-400 mb-2 flex items-center gap-2">
                <Smartphone className="w-4 h-4" /> Shikayat/Raabta (Contact)
            </h4>
            <p>Kisi bhi masale ki surat mein is number par **WhatsApp** par raabta karein:</p>
            <p className="mt-1 text-lg font-mono text-red-300">{OWNER_WHATSAPP}</p>
        </div>
      </div>
    );
  };
  
  // --- ADMIN PANEL ---
  const AdminPanel = () => {
    
    // Summary data
    const totalSubmissions = allSubmissions.length;
    const pendingCount = allSubmissions.filter(s => s.status === 'Pending Verification').length;
    const approvedUnpaidCount = allSubmissions.filter(s => s.status === 'Approved' && !s.isPaid).length;
    const paidCount = allSubmissions.filter(s => s.isPaid).length;

    return (
      <div className="p-4 sm:p-8">
        <header className="flex justify-between items-center mb-6 border-b border-orange-700 pb-4">
          <h1 className="text-3xl font-bold text-orange-400 flex items-center gap-3">
            <Shield className="w-6 h-6" /> Admin Control Panel
          </h1>
          <button onClick={handleLogout} className="text-sm bg-orange-900 hover:bg-orange-800 text-white font-medium py-2 px-4 rounded-full flex items-center">
            <LogOut className="w-4 h-4 mr-2" /> Log Out
          </button>
        </header>

        <p className="text-stone-400 mb-6">Welcome, {ADMIN_EMAIL}. Yahan aap users ke submissions ko manage kar sakte hain.</p>

        {/* Admin Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-stone-900 p-5 rounded-lg border border-stone-800 shadow-lg text-center">
                <p className="text-sm text-stone-400">Total Submissions</p>
                <h2 className="text-3xl font-bold text-white mt-1">{totalSubmissions}</h2>
            </div>
            <div className="bg-stone-900 p-5 rounded-lg border border-yellow-600 shadow-lg text-center">
                <p className="text-sm text-stone-400">Pending Verific
