import React, { useState, useEffect } from "react";
import { collection, query, onSnapshot, setDoc, doc, deleteDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db, handleFirestoreError } from "../firebase";
import { useAuth } from "./AuthProvider";
import { UserProfile, WorkerLookup, Task, OperationType } from "../types";
import { 
  Plus, Users, Briefcase, CheckSquare, Clock, LogOut, 
  UserPlus, ShieldAlert, Check, RefreshCw, Trash2, ShieldCheck, HelpCircle 
} from "lucide-react";

export const OwnerDashboard: React.FC = () => {
  const { user, userProfile, logout } = useAuth();
  
  // Real-time Collections Data
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workers, setWorkers] = useState<WorkerLookup[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);

  // Loading States
  const [dataLoading, setDataLoading] = useState(true);
  const [opsLoading, setOpsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form States: New Task
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");

  // Form States: Register User
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regRole, setRegRole] = useState<"manager" | "worker">("worker");
  const [regWorkerId, setRegWorkerId] = useState("");
  const [regMobile, setRegMobile] = useState("");

  // Load real-time data from Firestore
  useEffect(() => {
    setDataLoading(true);
    
    // Subscribe to Tasks
    const unsubscribeTasks = onSnapshot(
      collection(db, "tasks"),
      (snap) => {
        const loadedTasks: Task[] = [];
        snap.forEach((docSnap) => {
          loadedTasks.push(docSnap.data() as Task);
        });
        setTasks(loadedTasks);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "tasks");
      }
    );

    // Subscribe to Workers
    const unsubscribeWorkers = onSnapshot(
      collection(db, "workers"),
      (snap) => {
        const loadedWorkers: WorkerLookup[] = [];
        snap.forEach((docSnap) => {
          loadedWorkers.push(docSnap.data() as WorkerLookup);
        });
        setWorkers(loadedWorkers);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "workers");
      }
    );

    // Subscribe to Users
    const unsubscribeUsers = onSnapshot(
      collection(db, "users"),
      (snap) => {
        const loadedUsers: UserProfile[] = [];
        snap.forEach((docSnap) => {
          loadedUsers.push(docSnap.data() as UserProfile);
        });
        setUsers(loadedUsers);
        setDataLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "users");
      }
    );

    return () => {
      unsubscribeTasks();
      unsubscribeWorkers();
      unsubscribeUsers();
    };
  }, []);

  // Operation: Create Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle || !taskDesc || !taskAssignee) {
      setErrorMsg("Please fill in all task fields.");
      return;
    }

    setOpsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const taskId = `TASK-${Date.now().toString().slice(-6)}`;
      const taskDocRef = doc(db, "tasks", taskId);

      const newTaskPayload: Task = {
        taskId,
        title: taskTitle.trim(),
        description: taskDesc.trim(),
        assignedWorkerId: taskAssignee,
        createdBy: userProfile?.displayName || "System Owner",
        status: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(taskDocRef, newTaskPayload);
      setSuccessMsg(`Task "${taskId}" successfully created and assigned.`);
      setTaskTitle("");
      setTaskDesc("");
      setTaskAssignee("");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Authorization failed to create task: ${err.message}`);
    } finally {
      setOpsLoading(false);
    }
  };

  // Operation: Register Staff / Worker Directory
  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!regName || !regEmail) {
      setErrorMsg("Name and email are required parameters.");
      return;
    }

    if (regRole === "worker" && (!regWorkerId || !regMobile)) {
      setErrorMsg("Worker Registration requires Worker ID Username and Mobile Number password.");
      return;
    }

    setOpsLoading(true);

    try {
      const formattedWorkerId = regWorkerId.trim().toUpperCase();
      
      if (regRole === "worker") {
        // Create Firestore Worker registration doc. The worker's login will auto-heal
        // the Auth credentials securely upon first entry to bypass multi-cookie logout issues.
        const workerRef = doc(db, "workers", formattedWorkerId);
        
        // Check duplication
        const checkSnap = await getDoc(workerRef);
        if (checkSnap.exists()) {
          throw new Error(`Worker ID "${formattedWorkerId}" is already registered.`);
        }

        await setDoc(workerRef, {
          workerId: formattedWorkerId,
          mobileNumber: regMobile.trim(),
          userId: `PENDING_AUTH_${Date.now()}`,
          name: regName.trim(),
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        setSuccessMsg(`Successfully registered Worker ${regName} (ID: ${formattedWorkerId})! They can log in immediately.`);
      } else {
        // For managers, we write a pending user document. Since authenticating standard users on client side signs out the owner,
        // we'll instruct the owner to let the manager sign up or seed them via demo options.
        const mockManagerUid = `mgr_${Date.now().toString().slice(-6)}`;
        await setDoc(doc(db, "users", mockManagerUid), {
          userId: mockManagerUid,
          email: regEmail.trim(),
          role: "manager",
          displayName: regName.trim(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        
        setSuccessMsg(`Manager profile created in Firestore: ${regName}. Please use the demo accounts for credentials.`);
      }

      // Reset form
      setRegName("");
      setRegEmail("");
      setRegWorkerId("");
      setRegMobile("");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Failed directory registration: ${err.message}`);
    } finally {
      setOpsLoading(false);
    }
  };

  // Operation: Delete Task
  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm(`Are you sure you want to retire task "${taskId}"?`)) return;
    try {
      await deleteDoc(doc(db, "tasks", taskId));
      setSuccessMsg(`Task ${taskId} moved to archives.`);
    } catch (err: any) {
      setErrorMsg(`Task deletion failed: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#050b1a] text-slate-100 flex flex-col font-sans relative overflow-hidden">
      
      {/* Decorative ambient background flares */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[125px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[150px] pointer-events-none"></div>

      {/* Top Header */}
      <header className="bg-white/[0.02] backdrop-blur-xl border-b border-white/10 py-4 px-6 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600/25 border border-indigo-500/35 p-2.5 rounded-xl flex items-center justify-center shadow-md">
              <ShieldCheck className="w-5.5 h-5.5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight text-white leading-tight">
                  Role-Based Operations
                </h1>
                <span className="bg-indigo-500/10 border border-indigo-500/15 text-indigo-400 font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-full">
                  👑 OWNER
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-0.5">
                Owner profile: {userProfile?.displayName} &bull; {user?.email}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 bg-white/5 hover:bg-red-950/20 border border-white/10 hover:border-red-500/30 text-slate-300 hover:text-red-400 font-semibold px-4 py-2.5 rounded-xl text-xs tracking-wide transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            End Admin Session
          </button>
        </div>
      </header>

      {/* Main Layout Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6 z-10">
        
        {/* Status Alerts banner */}
        {(successMsg || errorMsg) && (
          <div className="space-y-2">
            {successMsg && (
              <div className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-500/20 p-4 rounded-xl text-emerald-300 text-xs animate-fadeIn backdrop-blur-md">
                <Check className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}
            {errorMsg && (
              <div className="flex items-start gap-2.5 bg-red-950/40 border border-red-500/20 p-4 rounded-xl text-red-300 text-xs animate-fadeIn backdrop-blur-md">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        )}

        {/* 1. Statistics Bento Box */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl p-4.5 flex items-center justify-between shadow-md relative overflow-hidden">
            <div className="space-y-1">
              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">Staff Profiles</span>
              <span className="text-2xl font-extrabold text-white leading-none">
                {users.length}
              </span>
            </div>
            <div className="p-3 bg-indigo-600/20 border border-indigo-500/25 text-indigo-400 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl p-4.5 flex items-center justify-between shadow-md">
            <div className="space-y-1">
              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">Active Workers</span>
              <span className="text-2xl font-extrabold text-white leading-none">
                {workers.length}
              </span>
            </div>
            <div className="p-3 bg-amber-600/20 border border-amber-500/25 text-amber-400 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl p-4.5 flex items-center justify-between shadow-md">
            <div className="space-y-1">
              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">Total Tasks</span>
              <span className="text-2xl font-extrabold text-white leading-none">
                {tasks.length}
              </span>
            </div>
            <div className="p-3 bg-blue-600/20 border border-blue-500/25 text-indigo-400 rounded-xl">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl p-4.5 flex items-center justify-between shadow-md">
            <div className="space-y-1">
              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">Closing Rate</span>
              <span className="text-2xl font-extrabold text-white leading-none">
                {tasks.length > 0 
                  ? `${Math.round((tasks.filter(t => t.status === "completed").length / tasks.length) * 100)}%` 
                  : "0%"
                }
              </span>
            </div>
            <div className="p-3 bg-emerald-600/20 border border-emerald-500/25 text-emerald-400 rounded-xl">
              <CheckSquare className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* 2. Operational Form Grid Centers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Create Task Form */}
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-5 shadow-lg flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">
                Dispatch Work Order
              </h2>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                    Task Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Conduct Site Fire Extinguisher Check"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-all font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                    Description & Specifications
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Provide exact coordinates, required checklists, and safety bounds..."
                    value={taskDesc}
                    onChange={(e) => setTaskDesc(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-all resize-none font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                    Assign Operational Worker
                  </label>
                  <select
                    required
                    value={taskAssignee}
                    onChange={(e) => setTaskAssignee(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-xs text-white focus:outline-none focus:border-indigo-500/50 transition-all cursor-pointer font-sans"
                  >
                    <option value="" disabled className="text-slate-500 bg-[#050b1a]">--- Pick Assigned Worker ---</option>
                    {workers.map((w) => (
                      <option key={w.workerId} value={w.workerId} className="bg-[#050b1a] text-white">
                        {w.workerId} &bull; {w.name}
                      </option>
                    ))}
                    {workers.length === 0 && (
                      <option disabled className="text-slate-600 bg-[#050b1a]">No active workers found in registry.</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={opsLoading || workers.length === 0}
                  className="w-full bg-indigo-650/40 hover:bg-indigo-650/55 border border-indigo-500/35 text-white font-semibold py-3 px-3 rounded-xl text-xs shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  {opsLoading ? "Dispatching Operations..." : "Dispatch Task Order"}
                </button>
              </div>
            </form>
          </div>

          {/* Directory Registration Form */}
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-5 shadow-lg flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <UserPlus className="w-4 h-4 text-emerald-410" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">
                Register Operations Directory
              </h2>
            </div>

            <form onSubmit={handleRegisterUser} className="space-y-3.5 flex-1 flex flex-col justify-between font-sans">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Clara Oswald"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-all font-sans"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g., clara@ops.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-all font-sans"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                    Directory Scope (Role)
                  </label>
                  <div className="grid grid-cols-2 bg-white/5 border border-white/10 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setRegRole("worker")}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        regRole === "worker"
                          ? "bg-emerald-600/40 text-emerald-250 border border-emerald-500/35"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      🔧 Worker
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegRole("manager")}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        regRole === "manager"
                          ? "bg-indigo-650/40 text-indigo-250 border border-indigo-500/35"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      💼 Manager
                    </button>
                  </div>
                </div>

                {regRole === "worker" && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-white/5 border border-white/10 rounded-xl animate-dropdown">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Worker ID (Username)
                      </label>
                      <input
                        type="text"
                        required={regRole === "worker"}
                        placeholder="e.g., W-120"
                        value={regWorkerId}
                        onChange={(e) => setRegWorkerId(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 uppercase font-sans"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Mobile Phone (Password)
                      </label>
                      <input
                        type="text"
                        required={regRole === "worker"}
                        placeholder="e.g., 9012345678"
                        value={regMobile}
                        onChange={(e) => setRegMobile(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 font-sans"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={opsLoading}
                  className="w-full bg-emerald-600/40 hover:bg-emerald-600/55 border border-emerald-500/30 text-white font-semibold py-3 px-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-emerald-500/10"
                >
                  <Plus className="w-4 h-4" />
                  {opsLoading ? "Processing Registry Entries..." : `Register New ${regRole === "worker" ? "Worker ID Link" : "Manager"}`}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* 3. Ledgers Area */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 font-sans">
          
          {/* Active Tasks Ledger list */}
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-5 shadow-lg xl:col-span-2">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-400" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300 font-sans">
                  Operational Task Ledger
                </h2>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                {tasks.length} active
              </span>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {tasks.length === 0 ? (
                <div className="text-center py-12 bg-white/[0.01] border border-dashed border-white/10 rounded-xl text-slate-550 text-xs animate-pulse font-sans">
                  No active operational tasks dispatched yet.
                </div>
              ) : (
                tasks.map((task) => (
                  <div 
                    key={task.taskId} 
                    className="bg-white/[0.02] border border-white/10 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:bg-white/[0.04] transition-all duration-250 animate-fadeIn"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-mono text-[10px] font-bold text-slate-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                          {task.taskId}
                        </span>
                        <h4 className="font-sans text-sm font-bold text-white tracking-tight">
                          {task.title}
                        </h4>
                        
                        {/* Status badges */}
                        <span className={`text-[10px] font-extrabold uppercase tracking-wide px-2.5 py-0.5 rounded-full ${
                          task.status === "completed" 
                            ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-sans" 
                            : task.status === "in_progress"
                              ? "bg-indigo-550/10 border border-indigo-500/25 text-indigo-400 font-sans"
                              : "bg-amber-550/10 border border-amber-500/25 text-amber-400 font-sans"
                        }`}>
                          {task.status.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-slate-400 text-xs line-clamp-2 pr-4 leading-relaxed">
                        {task.description}
                      </p>
                      <div className="flex items-center gap-3 text-[10px] text-slate-500 flex-wrap">
                        <span>Assignee: <strong className="text-slate-300">{task.assignedWorkerId}</strong></span>
                        <span>&bull;</span>
                        <span>Dispatched by: <strong className="text-slate-300">{task.createdBy}</strong></span>
                        <span>&bull;</span>
                        <span>Last change: <strong className="font-mono">{new Date(task.updatedAt).toLocaleTimeString()}</strong></span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteTask(task.taskId)}
                      className="p-2 bg-white/5 border border-white/10 text-slate-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 hover:border-red-500/20 transition-all cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Connected Directory Registries (Workers / Staff) */}
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-5 shadow-lg space-y-6">
            
            {/* Workers Panel card */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">
                    Operations Registry
                  </h3>
                </div>
                <span className="text-[10px] bg-white/5 font-bold text-amber-400 px-2 py-0.5 rounded-full border border-white/10">
                  {workers.length} registered
                </span>
              </div>

              <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                {workers.map((w) => (
                  <div key={w.workerId} className="flex items-center justify-between p-2.5 bg-white/[0.02] border border-white/10 rounded-xl text-xs">
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-white">
                        <span className="font-mono text-amber-400">{w.workerId}</span>
                        <span>{w.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block font-mono">Secret Key (Ph): {w.mobileNumber}</span>
                    </div>
                    <span className={`text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded border ${
                      w.status === "on_duty" 
                        ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400 font-sans" 
                        : w.status === "active"
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-sans"
                          : "bg-white/5 border border-white/10 text-slate-500 font-sans"
                    }`}>
                      {w.status.replace("_", " ")}
                    </span>
                  </div>
                ))}
                {workers.length === 0 && (
                  <div className="text-center py-6 text-slate-500 text-xs font-sans">
                    No registered workers.
                  </div>
                )}
              </div>
            </div>

            {/* Corporate Staff Registry (Managers / Owners) */}
            <div className="space-y-3 border-t border-white/10 pt-5 font-sans">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">
                    Staff Profiles
                  </h3>
                </div>
                <span className="text-[10px] bg-white/5 font-bold text-emerald-400 px-2 py-0.5 rounded-full border border-white/10">
                  {users.filter(u => u.role !== "worker").length} profiles
                </span>
              </div>

              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                {users.map((item) => (
                  <div key={item.userId} className="flex items-center justify-between p-2.5 bg-white/[0.02] border border-white/10 rounded-xl text-xs">
                    <div>
                      <span className="font-bold text-white block">{item.displayName}</span>
                      <span className="text-[10px] text-slate-400 block">{item.email}</span>
                    </div>
                    <span className={`text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded border ${
                      item.role === "owner" 
                        ? "bg-red-500/10 border-red-500/20 text-red-100 font-sans" 
                        : "bg-indigo-500/10 border-indigo-500/25 text-indigo-400 font-sans"
                    }`}>
                      {item.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

      </main>
    </div>
  );
};
