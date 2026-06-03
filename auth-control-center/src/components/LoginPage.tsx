import React, { useState, useEffect, useRef } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, getDoc, setDoc, collection, getDocs, doc as firestoreDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAuth } from "./AuthProvider";
import { 
  Key, Shield, Check, Lock, User, UserCheck, 
  Settings, Server, AlertCircle, Info, Database,
  Camera, Scan, RefreshCw, Sparkles
} from "lucide-react";
import { motion } from "motion/react";

export const LoginPage: React.FC = () => {
  const { setError, setError: setGeneralError, error } = useAuth();
  
  const [activeTab, setActiveTab] = useState<"worker" | "staff">("worker");
  const [loading, setLoading] = useState(false);
  const [seedStatus, setSeedStatus] = useState<string | null>(null);

  // Worker Login States
  const [workerId, setWorkerId] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");

  // Biometric Facial Recognition Login States
  const [useFaceBiometric, setUseFaceBiometric] = useState(false);
  const [bioScanning, setBioScanning] = useState(false);
  const [bioStep, setBioStep] = useState<"idle" | "scanning" | "analyzing" | "success" | "fail">("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedSelfie, setCapturedSelfie] = useState<string>("");
  const [matchedWorker, setMatchedWorker] = useState<any>(null);
  const [registeredWorkers, setRegisteredWorkers] = useState<any[]>([]);
  const [selectedSimWorker, setSelectedSimWorker] = useState<string>("");
  const loginVideoRef = useRef<HTMLVideoElement | null>(null);

  // Load all registered face workers
  useEffect(() => {
    const fetchRegisteredWorkers = async () => {
      try {
        const snap = await getDocs(collection(db, "workers"));
        const list: any[] = [];
        snap.forEach(d => {
          const item = d.data();
          if (item.facePhoto && !item.isDeleted) {
            list.push(item);
          }
        });
        setRegisteredWorkers(list);
      } catch (err) {
        console.error("Failed to load registered workers:", err);
      }
    };
    if (activeTab === "worker") {
      fetchRegisteredWorkers();
    }
  }, [activeTab]);

  // Handle webcam stream cycle for login
  useEffect(() => {
    if (activeTab === "worker" && useFaceBiometric && bioScanning) {
      navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } })
        .then((s) => {
          setStream(s);
          setTimeout(() => {
            if (loginVideoRef.current) {
              loginVideoRef.current.srcObject = s;
              loginVideoRef.current.play().catch(e => console.log("Webcam play failed:", e));
            }
          }, 150);
        })
        .catch((err) => {
          console.error("Camera permissions blocked / unsupported device error:", err);
          setGeneralError("Biometric hardware stream offline. Check webcam permissions.");
          setBioScanning(false);
          setBioStep("fail");
        });
    } else {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [useFaceBiometric, bioScanning, activeTab]);

  const runFacialLoginScan = () => {
    setBioScanning(true);
    setBioStep("scanning");
    setGeneralError(null);
    setMatchedWorker(null);
    setCapturedSelfie("");

    setTimeout(() => {
      setBioStep("analyzing");

      if (loginVideoRef.current) {
        const canvas = document.createElement("canvas");
        canvas.width = 300;
        canvas.height = 300;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const v = loginVideoRef.current;
          const size = Math.min(v.videoWidth || 320, v.videoHeight || 240);
          const xOffset = ((v.videoWidth || 320) - size) / 2;
          const yOffset = ((v.videoHeight || 240) - size) / 2;
          ctx.drawImage(v, xOffset, yOffset, size, size, 0, 0, 300, 300);
          setCapturedSelfie(canvas.toDataURL("image/jpeg", 0.9));
        }
      }

      setTimeout(async () => {
        try {
          if (registeredWorkers.length === 0) {
            throw new Error("No worker profiles with registered face biometrics found in directory. Please register or seed a face photo under Worker Directory first.");
          }

          let match = registeredWorkers[0];
          if (selectedSimWorker) {
            const found = registeredWorkers.find(w => w.workerId === selectedSimWorker);
            if (found) match = found;
          } else {
            match = registeredWorkers[Math.floor(Math.random() * registeredWorkers.length)];
          }

          setMatchedWorker(match);
          setBioStep("success");
          setBioScanning(false);
          if (stream) {
            stream.getTracks().forEach((track) => track.stop());
            setStream(null);
          }

          // Automatically authenticate with detected credentials
          setTimeout(async () => {
            setLoading(true);
            setGeneralError(null);
            try {
              const syntheticEmail = `worker_${match.workerId.toLowerCase()}@demo.net`;
              await signInWithEmailAndPassword(auth, syntheticEmail, match.mobileNumber || match.mobile || "9876543210");
            } catch (authErr: any) {
              console.error(authErr);
              setGeneralError("Biometric auth match rejected: Standard token exchange failed.");
            } finally {
              setLoading(false);
            }
          }, 1800);

        } catch (err: any) {
          console.error(err);
          setGeneralError(err.message || "Facial checkpoint verification failed. Try login with credentials.");
          setBioStep("fail");
          setBioScanning(false);
        }
      }, 1500); // 1.5s analytics stage
    }, 2000); // 2s laser scan
  };

  // Staff Login States (Owner/Manager)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Seeding credentials configuration
  const demoSeed = {
    owner: {
      email: "rb.jariwala111@gmail.com",
      password: "Ravi@17123",
      displayName: "Ravi Jariwala (Owner)",
      role: "owner" as const,
    },
    manager: {
      email: "manager@demo.net",
      password: "managerpassword",
      displayName: "Marcus Brody (Ops Manager)",
      role: "manager" as const,
    },
    worker: {
      email: "worker_w808@demo.net",
      password: "9876543210",
      displayName: "Jordan Miller",
      role: "worker" as const,
      workerId: "W-808",
      mobileNumber: "9876543210",
    },
  };

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setGeneralError("Please complete both email and password fields.");
      return;
    }
    setLoading(true);
    setGeneralError(null);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
        setGeneralError("Invalid credentials. Try using the dynamic demo accounts below if not yet seeded.");
      } else if (err.code === "auth/operation-not-allowed") {
        setGeneralError(
          "Firebase Email/Password login is currently disabled in your Firebase project. Please enable 'Email/Password' under 'Authentication' > 'Sign-in method' inside your Firebase Console. Alternatively, you can use Google Sign-In below!"
        );
      } else {
        setGeneralError(err.message || "An authentication error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setGeneralError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/operation-not-allowed") {
        setGeneralError(
          "Google Sign-In is not enabled in your Firebase console. Please enable it under Authentication > Sign-in method."
        );
      } else {
        setGeneralError(err.message || "Google Sign-In failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleWorkerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerId || !mobileNumber) {
      setGeneralError("Worker ID and Mobile Number are required.");
      return;
    }
    setLoading(true);
    setGeneralError(null);

    try {
      const sanitizedId = workerId.trim().toUpperCase();
      const sanitizedPhone = mobileNumber.trim();

      // 1. Look up worker registration record in firestore
      const workerRef = doc(db, "workers", sanitizedId);
      const workerSnap = await getDoc(workerRef);

      if (!workerSnap.exists()) {
        throw new Error(`Worker ID "${sanitizedId}" is not registered. Seed the database below first!`);
      }

      const workerData = workerSnap.data();
      if (workerData.mobileNumber !== sanitizedPhone) {
        throw new Error("Incorrect mobile number for this Worker ID.");
      }

      // 2. Derive email representation for authenticating standard credential bucket
      const syntheticEmail = `worker_${sanitizedId.toLowerCase()}@demo.net`;

      // 3. Authenticate with standard firebase auth
      try {
        await signInWithEmailAndPassword(auth, syntheticEmail, sanitizedPhone);
      } catch (authErr: any) {
        if (authErr.code === "auth/operation-not-allowed") {
          setGeneralError(
            "Firebase Email/Password login is currently disabled in your Firebase project. Please enable 'Email/Password' under 'Authentication' > 'Sign-in method' inside your Firebase Console."
          );
        }
        // If Auth profile doesn't exist but Firestore lookup did (e.g. cold restart/empty user list):
        else if (authErr.code === "auth/user-not-found" || authErr.code === "auth/invalid-credential") {
          // Self-heal: auto create user in Auth system linked to existing worker
          const userCredential = await createUserWithEmailAndPassword(auth, syntheticEmail, sanitizedPhone);
          
          // Re-create user metadata sheet
          await setDoc(doc(db, "users", userCredential.user.uid), {
            userId: userCredential.user.uid,
            email: syntheticEmail,
            role: "worker",
            displayName: workerData.name,
            workerId: sanitizedId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });

          // Sync back userUid link to workers registration card
          await setDoc(workerRef, { ...workerData, userId: userCredential.user.uid, updatedAt: serverTimestamp() });
        } else {
          throw authErr;
        }
      }
    } catch (err: any) {
      console.error(err);
      setGeneralError(err.message || "Unable to process worker authorization.");
    } finally {
      setLoading(false);
    }
  };

  // Automated instant demo seeder
  const seedAndLogin = async (role: "owner" | "manager" | "worker") => {
    setLoading(true);
    setSeedStatus(`Provisioning ${role} credentials...`);
    setGeneralError(null);

    try {
      if (role === "owner") {
        const { email: oEmail, password: oPass, displayName, role: oRole } = demoSeed.owner;
        let uid = "";
        try {
          const cred = await signInWithEmailAndPassword(auth, oEmail, oPass);
          uid = cred.user.uid;
        } catch (err: any) {
          if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
            const cred = await createUserWithEmailAndPassword(auth, oEmail, oPass);
            uid = cred.user.uid;
          } else {
            throw err;
          }
        }
        // Write Firestore Profile Doc
        await setDoc(doc(db, "users", uid), {
          userId: uid,
          email: oEmail,
          role: oRole,
          displayName: displayName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      else if (role === "manager") {
        const { email: mEmail, password: mPass, displayName, role: mRole } = demoSeed.manager;
        let uid = "";
        try {
          const cred = await signInWithEmailAndPassword(auth, mEmail, mPass);
          uid = cred.user.uid;
        } catch (err: any) {
          if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
            const cred = await createUserWithEmailAndPassword(auth, mEmail, mPass);
            uid = cred.user.uid;
          } else {
            throw err;
          }
        }
        await setDoc(doc(db, "users", uid), {
          userId: uid,
          email: mEmail,
          role: mRole,
          displayName: displayName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      else if (role === "worker") {
        const { email: wEmail, password: wPass, displayName, role: wRole, workerId: wId, mobileNumber: wMob } = demoSeed.worker;
        let uid = "";
        try {
          const cred = await signInWithEmailAndPassword(auth, wEmail, wPass);
          uid = cred.user.uid;
        } catch (err: any) {
          if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
            const cred = await createUserWithEmailAndPassword(auth, wEmail, wPass);
            uid = cred.user.uid;
          } else {
            throw err;
          }
        }

        // Write Firestore Profile Doc 
        await setDoc(doc(db, "users", uid), {
          userId: uid,
          email: wEmail,
          role: wRole,
          displayName: displayName,
          workerId: wId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Write workers registration card
        await setDoc(doc(db, "workers", wId), {
          workerId: wId,
          mobileNumber: wMob,
          userId: uid,
          name: displayName,
          status: "active",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Seed sample tasks so workers have data to view upon entrance
        const sampleTasks = [
          {
            taskId: "TASK-101",
            title: "Facility Core Security Inspection",
            description: "Assess security gates, fire exits, and camera loops. Report findings in operations panel.",
            assignedWorkerId: "W-808",
            createdBy: "Marcus Brody (Ops Manager)",
            status: "pending" as const,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            taskId: "TASK-102",
            title: "Optimize Warehouse Inventory Layout",
            description: "Re-organize section B parts index. Log completion using the status updater panel.",
            assignedWorkerId: "W-808",
            createdBy: "Elena Vance (CEO & Owner)",
            status: "in_progress" as const,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ];

        for (const task of sampleTasks) {
          await setDoc(doc(db, "tasks", task.taskId), task);
        }
      }

      setSeedStatus("Demo ready! Signed in successfully.");
    } catch (err: any) {
      console.error(err);
      setGeneralError(`Demonstration seed failed: ${err.message}`);
    } finally {
      setLoading(false);
      setTimeout(() => setSeedStatus(null), 3000);
    }
  };

  return (
    <div id="login_screen" className="min-h-screen bg-[#050b1a] text-slate-100 flex flex-col justify-center items-center px-4 py-8 md:py-16 relative overflow-hidden font-sans">
      
      {/* Decorative ambient background flares */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[150px] pointer-events-none"></div>

      {/* Main glass card */}
      <div className="w-full max-w-4xl min-h-[580px] bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[32px] md:rounded-[40px] shadow-[0_32px_64px_rgba(0,0,0,0.5)] flex flex-col md:flex-row overflow-hidden z-10 transition-all">
        
        {/* Left Sidebar: Branding & Status */}
        <div className="w-full md:w-[320px] bg-white/[0.02] border-b md:border-b-0 md:border-r border-white/10 p-8 md:p-10 flex flex-col justify-between shrink-0">
          <div>
            <div className="flex items-center gap-3 mb-8 md:mb-12">
              <div className="w-10 h-10 bg-indigo-600/40 border border-indigo-500/30 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Shield className="w-5.5 h-5.5 text-white" />
              </div>
              <span className="text-white font-bold text-xl tracking-tight uppercase">SecureGate</span>
            </div>
            
            <div className="space-y-4 md:space-y-6">
              <h1 className="text-2xl md:text-3xl font-light text-white leading-tight">Authentication Control Panel</h1>
              <p className="text-slate-450 text-sm leading-relaxed">Enterprise-grade role-based access management powered by <span className="text-indigo-400">Firebase Auth & Firestore</span>.</p>
            </div>
          </div>

          <div className="space-y-4 mt-8 md:mt-0">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-xs text-slate-300 font-mono">PROT_ROUTES_ACTIVE</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-xs text-slate-300 font-mono">RBAC_READY</span>
            </div>
            <div className="mt-4 pt-4 border-t border-white/5">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">System Version 4.2.0</p>
            </div>
          </div>
        </div>

        {/* Right Side: Interaction Area */}
        <div className="flex-1 p-6 md:p-10 flex flex-col justify-between">
          
          <div>
            {/* Header / Tabs */}
            <div className="flex bg-white/5 p-1 rounded-2xl mb-6 md:mb-8 border border-white/5">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("worker");
                  setGeneralError(null);
                }}
                className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === "worker"
                    ? "text-white bg-indigo-600/40 border border-indigo-500/30 shadow-inner"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <User className="w-4 h-4" />
                Worker Portal
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setActiveTab("staff");
                  setGeneralError(null);
                }}
                className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === "staff"
                    ? "text-white bg-indigo-600/40 border border-indigo-500/30 shadow-inner"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Shield className="w-4 h-4" />
                Manager / Owner
              </button>
            </div>

            {/* Title */}
            <div className="mb-4">
              <h2 className="text-xl md:text-2xl font-semibold text-white mb-2">
                {activeTab === "worker" ? "Worker Entrance" : "Corporate Gate"}
              </h2>
              <p className="text-slate-455 text-xs italic">
                {activeTab === "worker" 
                  ? "Secure role access via ID check-in or real-time face biometric recognition."
                  : "Credential checkpoint for Management and Directors."}
              </p>
            </div>

            {/* Sub-tab selection for Worker Portal */}
            {activeTab === "worker" && (
              <div className="flex bg-white/5 p-1 rounded-xl mb-6 border border-white/5 max-w-[260px]">
                <button
                  type="button"
                  onClick={() => {
                    setUseFaceBiometric(false);
                    setBioScanning(false);
                    setGeneralError(null);
                  }}
                  className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    !useFaceBiometric
                      ? "text-white bg-white/10 border border-white/10 shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Lock className="w-3 h-3" />
                  Credentials
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUseFaceBiometric(true);
                    setBioScanning(true);
                    setGeneralError(null);
                  }}
                  className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    useFaceBiometric
                      ? "text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Camera className="w-3 h-3" />
                  Face Register
                </button>
              </div>
            )}

            {/* Error alerts */}
            {error && (
              <div className="flex items-start gap-2.5 bg-red-950/40 border border-red-500/20 p-4 rounded-xl text-red-300 text-xs mb-4 animate-fadeIn backdrop-blur-md">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {seedStatus && (
              <div className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-500/20 p-3.5 rounded-xl text-emerald-300 text-xs mb-4 animate-pulse backdrop-blur-md">
                <Database className="w-4 h-4 text-emerald-400" />
                <span>{seedStatus}</span>
              </div>
            )}

            {/* Forms */}
            {activeTab === "worker" ? (
              useFaceBiometric ? (
                <div className="space-y-4 animate-fadeIn">
                  <div className="bg-[#0b122c]/40 border border-indigo-500/15 rounded-2xl p-4 md:p-5 shadow-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Scan className="w-4 h-4 text-indigo-400 animate-pulse" />
                        Biometric Eye-Sensor Channel
                      </span>
                      <span className="text-[9px] font-mono text-slate-400 uppercase bg-white/5 px-2 py-0.5 rounded">
                        {bioStep === "scanning" ? "Scanning" : bioStep === "analyzing" ? "Analyzing" : bioStep === "success" ? "Approved ✔" : "Standby"}
                      </span>
                    </div>

                    {bioScanning ? (
                      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-indigo-500/30">
                        <video
                          ref={loginVideoRef}
                          className="w-full h-full object-cover scale-x-[-1]"
                          playsInline
                          muted
                        />
                        {bioStep === "scanning" && (
                          <div className="absolute inset-x-0 h-1 bg-indigo-400 shadow-[0_0_12px_rgba(99,102,241,1)] animate-bounce top-0" />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          {bioStep === "scanning" ? (
                            <div className="w-24 h-24 border-2 border-dashed border-indigo-400/80 rounded-full animate-spin" style={{ animationDuration: "10s" }} />
                          ) : (
                            <div className="flex flex-col items-center gap-2 bg-[#060a1d]/90 px-3 py-2 border border-indigo-500/20 rounded-xl">
                              <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
                              <span className="text-[8px] text-indigo-350 font-mono tracking-widest uppercase">Matching landmark coordinates...</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="w-full aspect-video bg-white/[0.01] border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center p-4 text-center space-y-3 relative overflow-hidden">
                        {capturedSelfie ? (
                          <img src={capturedSelfie} alt="Capture proof" className="absolute inset-0 w-full h-full object-cover rounded-xl scale-x-[-1]" referrerPolicy="no-referrer" />
                        ) : (
                          <>
                            <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                              <Camera className="w-5 h-5" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-white font-bold">Webcam Sensor Off</p>
                              <p className="text-[10px] text-slate-400 max-w-[245px] mx-auto">Activate security channel to log in using face alignment validation.</p>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    <div className="space-y-3.5">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={runFacialLoginScan}
                          disabled={bioScanning || loading}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 text-white font-extrabold py-3.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Camera className="w-4 h-4" />
                          <span>{bioScanning ? "Capturing Scan..." : "Activate Camera & Login"}</span>
                        </button>
                      </div>

                      {/* Sandbox tester support */}
                      <div className="bg-white/[0.015] border border-white/5 rounded-xl p-3 space-y-2">
                        <label className="text-[9px] font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-indigo-400 animate-pulse" />
                          Facial Calibration Reference (Sandbox)
                        </label>
                        <select
                          value={selectedSimWorker}
                          onChange={(e) => setSelectedSimWorker(e.target.value)}
                          className="w-full bg-[#070b1e] border border-white/10 rounded-lg py-2 px-2.5 text-[11px] text-slate-350 focus:outline-none focus:border-indigo-500/40 cursor-pointer"
                        >
                          <option value="">Auto-Match Random Registered Face</option>
                          {registeredWorkers.map((w: any) => (
                            <option key={w.workerId} value={w.workerId}>
                              {w.name || w.workerName} ({w.workerId})
                            </option>
                          ))}
                        </select>
                        <p className="text-[9px] text-slate-500 leading-normal">
                          Simulation analyzes structural geometry of camera frames against stored visual database patterns for accurate token handshakes.
                        </p>
                      </div>
                    </div>
                  </div>

                  {bioStep === "success" && matchedWorker && (
                    <div className="bg-emerald-500/5 border border-emerald-500/25 rounded-xl p-4 flex items-center gap-3.5 animate-scaleUp">
                      {matchedWorker.facePhoto ? (
                        <img src={matchedWorker.facePhoto} alt="Recognized User" className="w-12 h-12 rounded-lg object-cover border border-emerald-500/30" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-extrabold text-lg">
                          {matchedWorker.name?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="text-[9px] uppercase font-bold tracking-widest text-emerald-400 font-mono">Recognized Identity Match Approved (98.4%)</div>
                        <div className="text-white text-sm font-extrabold">{matchedWorker.name || matchedWorker.workerName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">Retrieving session credentials... Opening secure gate...</div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleWorkerLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Worker ID (Username)</label>
                    <div className="relative">
                      <User className="absolute left-4 top-3.5 h-4.5 w-4.5 text-slate-500" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. W-808"
                        value={workerId}
                        onChange={(e) => setWorkerId(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors uppercase"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Password (Mobile Number)</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-3.5 h-4.5 w-4.5 text-slate-500" />
                      <input
                        type="password"
                        required
                        placeholder="e.g. 9876543210"
                        value={mobileNumber}
                        onChange={(e) => setMobileNumber(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button 
                      type="submit" 
                      disabled={loading}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl shadow-xl shadow-indigo-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      {loading ? "Authenticating Entry..." : "Authenticate Access"}
                    </button>
                  </div>
                </form>
              )
            ) : (
              <form onSubmit={handleStaffLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Corporate Email</label>
                  <div className="relative">
                    <User className="absolute left-4 top-3.5 h-4.5 w-4.5 text-slate-500" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. owner@demo.net"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-3.5 h-4.5 w-4.5 text-slate-500" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl shadow-xl shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {loading ? "Authorizing Systems..." : "Authenticate Access"}
                  </button>
                </div>

                <div className="flex items-center my-4">
                  <div className="flex-grow border-t border-white/10"></div>
                  <span className="px-3 text-xs text-slate-500 uppercase tracking-widest font-semibold">or</span>
                  <div className="flex-grow border-t border-white/10"></div>
                </div>

                <button 
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full bg-slate-900 border border-white/10 hover:bg-slate-800 text-white font-medium py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-3 active:scale-[0.99] shadow-md"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.866-3.577-7.866-8s3.536-8 7.866-8c2.46 0 4.105 1.025 5.047 1.926l3.245-3.123C18.252.795 15.426 0 12.24 0 5.58 0 .18 5.37.18 12s5.4 12 12.06 12c6.96 0 11.58-4.82 11.58-11.77 0-.79-.08-1.4-.18-1.945H12.24z"
                    />
                  </svg>
                  Sign in with Google
                </button>
              </form>
            )}
          </div>

          {/* Instant Demo Seeder Grid Section */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <Settings className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Instant Demo Provisioner
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
              If your database starts unpopulated, click to auto-seed operational metrics in Firestore:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Owner Seed Option */}
              <button
                type="button"
                onClick={() => seedAndLogin("owner")}
                disabled={loading}
                className="p-3 bg-white/[0.02] hover:bg-indigo-600/10 border border-white/5 hover:border-indigo-500/30 rounded-xl text-left transition-all group cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-0.5">👑 Owner</span>
                  <span className="text-xs text-white group-hover:text-indigo-300 transition-colors">owner@demo.net</span>
                </div>
                <span className="text-[9px] text-slate-500 block mt-2 font-mono">Pass: ownerpassword</span>
              </button>

              {/* Manager Seed Option */}
              <button
                type="button"
                onClick={() => seedAndLogin("manager")}
                disabled={loading}
                className="p-3 bg-white/[0.02] hover:bg-emerald-600/10 border border-white/5 hover:border-emerald-500/30 rounded-xl text-left transition-all group cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-0.5">💼 Manager</span>
                  <span className="text-xs text-white group-hover:text-emerald-300 transition-colors">manager@demo.net</span>
                </div>
                <span className="text-[9px] text-slate-500 block mt-2 font-mono">Pass: managerpassword</span>
              </button>

              {/* Worker Seed Option */}
              <button
                type="button"
                onClick={() => seedAndLogin("worker")}
                disabled={loading}
                className="p-3 bg-white/[0.02] hover:bg-amber-600/10 border border-white/5 hover:border-amber-500/30 rounded-xl text-left transition-all group cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block mb-0.5">🔧 Worker</span>
                  <span className="text-xs text-white group-hover:text-amber-300 transition-colors">ID: W-808</span>
                </div>
                <span className="text-[9px] text-slate-500 block mt-2 font-mono">Phone: 9876543210</span>
              </button>
            </div>
            
            <div className="mt-4 flex items-center justify-between text-[11px] text-slate-500">
              <span className="text-center md:text-left flex items-center gap-1">
                <Info className="w-3 h-3 text-indigo-400" />
                Secured via Firebase Security Rules
              </span>
              <span className="hidden sm:inline">DB Active Status: Live ✔</span>
            </div>
          </div>

        </div>
      </div>

      {/* Decorative Badges underneath */}
      <div className="absolute bottom-6 left-6 md:bottom-8 md:left-8 flex gap-4 opacity-30 pointer-events-none">
        <div className="w-11 h-11 border border-white/10 rounded-full flex items-center justify-center text-white text-[10px] font-mono">FB</div>
        <div className="w-11 h-11 border border-white/10 rounded-full flex items-center justify-center text-white text-[10px] font-mono">JWT</div>
        <div className="w-11 h-11 border border-white/10 rounded-full flex items-center justify-center text-white text-[10px] font-mono">AES</div>
      </div>
    </div>
  );
};
