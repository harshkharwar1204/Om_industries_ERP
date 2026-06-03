import React, { useState, useEffect } from "react";
import { collection, query, onSnapshot, setDoc, doc, deleteDoc, getDoc } from "firebase/firestore";
import { db, handleFirestoreError } from "../firebase";
import { useAuth } from "./AuthProvider";
import { UserProfile, WorkerLookup, Task, OperationType } from "../types";
import { 
  Plus, Users, Briefcase, CheckSquare, LogOut, 
  UserPlus, ShieldAlert, Check, Trash2, ClipboardList 
} from "lucide-react";

export const ManagerDashboard: React.FC = () => {
  const { user, userProfile, logout } = useAuth();
  
  // Real-time collections in index
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workers, setWorkers] = useState<WorkerLookup[]>([]);

  // Local statuses
  const [dataLoading, setDataLoading] = useState(true);
  const [opsLoading, setOpsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form: Tasks
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");

  // Form: Workers
  const [workerName, setWorkerName] = useState("");
  const [workerEmail, setWorkerEmail] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [workerMobile, setWorkerMobile] = useState("");

  useEffect(() => {
    setDataLoading(true);

    const unsubscribeTasks = onSnapshot(
      collection(db, "tasks"),
      (snap) => {
        const loaded: Task[] = [];
        snap.forEach((d) => loaded.push(d.data() as Task));
        setTasks(loaded);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "tasks");
      }
    );

    const unsubscribeWorkers = onSnapshot(
      collection(db, "workers"),
      (snap) => {
        const loaded: WorkerLookup[] = [];
        snap.forEach((d) => loaded.push(d.data() as WorkerLookup));
        setWorkers(loaded);
        setDataLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "workers");
      }
    );

    return () => {
      unsubscribeTasks();
      unsubscribeWorkers();
    };
  }, []);

  // Dispatch work order
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
        createdBy: userProfile?.displayName || "Operations Manager",
        status: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(taskDocRef, newTaskPayload);
      setSuccessMsg(`Task "${taskId}" has been dispatched to worker ${taskAssignee}.`);
      setTaskTitle("");
      setTaskDesc("");
      setTaskAssignee("");
    } catch (err: any) {
      setErrorMsg(`Authorization failed to create task: ${err.message}`);
    } finally {
      setOpsLoading(false);
    }
  };

  // Register a worker lookup registry
  const handleRegisterWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerName || !workerEmail || !workerId || !workerMobile) {
      setErrorMsg("All worker profile registration fields are required.");
      return;
    }

    setOpsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const formattedWorkerId = workerId.trim().toUpperCase();
      const workerRef = doc(db, "workers", formattedWorkerId);

      // Check duplication
      const checkSnap = await getDoc(workerRef);
      if (checkSnap.exists()) {
        throw new Error(`Worker ID "${formattedWorkerId}" already exists in company registry.`);
      }

      await setDoc(workerRef, {
        workerId: formattedWorkerId,
        mobileNumber: workerMobile.trim(),
        userId: `PENDING_AUTH_${Date.now()}`,
        name: workerName.trim(),
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setSuccessMsg(`Worker "${workerName}" has been added to operational lookup registries. Worker ID: ${formattedWorkerId}`);
      setWorkerName("");
      setWorkerEmail("");
      setWorkerId("");
      setWorkerMobile("");
    } catch (err: any) {
      setErrorMsg(`Registry registration failed: ${err.message}`);
    } finally {
      setOpsLoading(false);
    }
  };

  // Delete task
  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm(`Retire operational task record "${taskId}"?`)) return;
    try {
      await deleteDoc(doc(db, "tasks", taskId));
      setSuccessMsg(`Task ${taskId} removed.`);
    } catch (err: any) {
      setErrorMsg(`Failed to delete task: ${err.message}`);
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
              <ClipboardList className="w-5.5 h-5.5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight text-white leading-tight">
                  Manager Dispatch Operations
                </h1>
                <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-full">
                  💼 MANAGER
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-0.5">
                Staff profile: {userProfile?.displayName} &bull; {user?.email}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 bg-white/5 hover:bg-red-950/20 border border-white/10 hover:border-red-500/30 text-slate-300 hover:text-red-400 font-semibold px-4 py-2.5 rounded-xl text-xs tracking-wide transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            End Manager Session
          </button>
        </div>
      </header>

      {/* Main Grid Workroom */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6 z-10">
        
        {/* Banner updates */}
        {(successMsg || errorMsg) && (
          <div className="space-y-2">
            {successMsg && (
              <div className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-500/25 p-4 rounded-xl text-emerald-300 text-xs animate-fadeIn backdrop-blur-md">
                <Check className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}
            {errorMsg && (
              <div className="flex items-start gap-2.5 bg-red-950/40 border border-red-500/25 p-4 rounded-xl text-red-300 text-xs animate-fadeIn backdrop-blur-md">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        )}

        {/* 1. Statistics Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl p-4.5 flex items-center justify-between shadow-md">
            <div>
              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">Registries</span>
              <span className="text-2xl font-extrabold text-white leading-none">{workers.length} Workers</span>
            </div>
            <Users className="w-8 h-8 text-indigo-500/30" />
          </div>

          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl p-4.5 flex items-center justify-between shadow-md">
            <div>
              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">Active Loads</span>
              <span className="text-2xl font-extrabold text-white leading-none">
                {tasks.filter(t => t.status !== "completed").length} Tasks
              </span>
            </div>
            <Briefcase className="w-8 h-8 text-indigo-400/30" />
          </div>

          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl p-4.5 flex items-center justify-between shadow-md">
            <div>
              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">Completed Tasks</span>
              <span className="text-2xl font-extrabold text-white leading-none">
                {tasks.filter(t => t.status === "completed").length} Tasks
              </span>
            </div>
            <CheckSquare className="w-8 h-8 text-emerald-500/30" />
          </div>
        </div>

        {/* 2. Operations Interface split forms */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Create Task component */}
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">
                Dispatch Target Task
              </h2>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4 flex-1 flex flex-col justify-between font-sans">
              <div className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                    Task Title Order
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Clean System Coolers B4"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-3 text-xs text-white focus:outline-none focus:border-indigo-500/50 transition-all font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                    Description & Safety Specifications
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Provide sequence checklists, security zones, and deadlines..."
                    value={taskDesc}
                    onChange={(e) => setTaskDesc(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500/50 transition-all resize-none font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                    Operational Field Worker
                  </label>
                  <select
                    required
                    value={taskAssignee}
                    onChange={(e) => setTaskAssignee(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-xs text-white focus:outline-none focus:border-indigo-500/50 transition-all cursor-pointer font-sans"
                  >
                    <option value="" disabled className="text-slate-650 bg-slate-950">--- Assign Registered Worker ---</option>
                    {workers.map((w) => (
                      <option key={w.workerId} value={w.workerId} className="bg-[#050b1a] text-white">
                        {w.workerId} &bull; {w.name}
                      </option>
                    ))}
                    {workers.length === 0 && (
                      <option disabled className="text-slate-600 bg-slate-950">Register a worker profile first.</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={opsLoading || workers.length === 0}
                  className="w-full bg-indigo-600/40 hover:bg-indigo-600/55 border border-indigo-500/30 text-white font-semibold py-3 px-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-indigo-500/10"
                >
                  <Plus className="w-4 h-4" />
                  {opsLoading ? "Dispatching Work Orders..." : "Dispatch Task Order"}
                </button>
              </div>
            </form>
          </div>

          {/* Quick-Register Worker Profiles (No standard mail needed) */}
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-4">
              <UserPlus className="w-4 h-4 text-emerald-480" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">
                Onboard Worker Directory
              </h2>
            </div>

            <form onSubmit={handleRegisterWorker} className="space-y-3.5 flex-1 flex flex-col justify-between font-sans">
              <div className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                      Worker Full Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Mickey Smith"
                      value={workerName}
                      onChange={(e) => setWorkerName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                      Corporate Email
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g., mickey@company.net"
                      value={workerEmail}
                      onChange={(e) => setWorkerEmail(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 p-3 bg-white/5 border border-white/10 rounded-xl">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Worker ID (Username)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., W-505"
                      value={workerId}
                      onChange={(e) => setWorkerId(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50 uppercase"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Mobile Phone (Password)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., 9876543210"
                      value={workerMobile}
                      onChange={(e) => setWorkerMobile(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={opsLoading}
                  className="w-full bg-emerald-600/40 hover:bg-emerald-600/55 border border-emerald-500/30 text-white font-semibold py-3 px-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-emerald-500/10"
                >
                  <Plus className="w-4 h-4" />
                  {opsLoading ? "Adding Worker profiles..." : "Onboard Worker Registry"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* 3. Task monitor ledger and Roster status */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 font-sans">
          
          {/* Live Task Ledger */}
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-5 shadow-lg xl:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-indigo-400" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">
                  Operational Task Ledger
                </h2>
              </div>
              <span className="text-[10px] bg-white/5 text-slate-450 font-bold uppercase px-2.5 py-0.5 rounded-full border border-white/15">
                {tasks.length} live
              </span>
            </div>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {tasks.length === 0 ? (
                <div className="text-center py-12 bg-white/[0.01] border border-dashed border-white/10 rounded-xl text-slate-500 text-xs animate-pulse">
                  No active work tasks dispatched yet. Use the dispatch tool above!
                </div>
              ) : (
                tasks.map((t) => (
                  <div key={t.taskId} className="bg-white/[0.02] backdrop-blur-md border border-white/10 p-4 rounded-xl flex items-center justify-between gap-4 hover:bg-white/[0.04] transition-all">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[9px] font-bold text-slate-400 bg-white/5 px-2 py-0.5 border border-white/10 rounded-md">
                          {t.taskId}
                        </span>
                        <h4 className="text-xs font-bold text-white tracking-tight">{t.title}</h4>
                        <span className={`text-[9px] font-extrabold uppercase tracking-widest py-0.5 px-2 rounded-full border ${
                          t.status === "completed" 
                            ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400" 
                            : t.status === "in_progress"
                              ? "bg-indigo-500/10 border-indigo-500/25 text-indigo-400"
                              : "bg-amber-500/10 border-amber-500/25 text-amber-400"
                        }`}>
                          {t.status.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-slate-400 text-xs leading-relaxed line-clamp-1">{t.description}</p>
                      <div className="flex items-center gap-3 text-[10px] text-slate-505">
                        <span>Assigned to: <strong className="text-slate-300">{t.assignedWorkerId}</strong></span>
                        <span>&bull;</span>
                        <span>Issuer: <strong className="text-slate-300">{t.createdBy}</strong></span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteTask(t.taskId)}
                      className="p-2 bg-white/5 border border-white/10 text-slate-400 hover:text-red-400 rounded-lg shrink-0 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Connected roster status panel */}
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">
                  Workers Directory
                </h3>
              </div>
              <span className="text-[10px] bg-white/5 text-slate-450 font-bold px-2 py-0.5 rounded border border-white/15">
                {workers.length} registered
              </span>
            </div>

            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {workers.map((w) => (
                <div key={w.workerId} className="p-3 bg-white/[0.02] hover:bg-white/[0.04] border border-white/10 rounded-xl text-xs space-y-1.5 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{w.name}</span>
                    <span className={`text-[8px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 rounded border ${
                      w.status === "on_duty" 
                        ? "bg-indigo-650/10 border-indigo-500/25 text-indigo-400" 
                        : w.status === "active"
                          ? "bg-emerald-600/10 border border-emerald-500/25 text-emerald-450"
                          : "bg-white/5 border border-white/10 text-slate-500"
                    }`}>
                      {w.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-500">
                    <span>Worker ID: <strong className="font-mono text-amber-500">{w.workerId}</strong></span>
                    <span>Ph: {w.mobileNumber}</span>
                  </div>
                </div>
              ))}
              {workers.length === 0 && (
                <div className="text-center py-8 text-slate-650 text-xs text-slate-500">
                  No active workers onboarded.
                </div>
              )}
            </div>
          </div>

        </div>

      </main>
    </div>
  );
};
