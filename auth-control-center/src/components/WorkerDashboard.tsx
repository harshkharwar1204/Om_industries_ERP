import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError } from "../firebase";
import { useAuth } from "./AuthProvider";
import { Task, WorkerLookup, OperationType } from "../types";
import { 
  CheckSquare, Clock, LogOut, ShieldAlert, Check, 
  User, RefreshCw, ClipboardList, Zap, Power, BookOpen, AlertCircle
} from "lucide-react";

export const WorkerDashboard: React.FC = () => {
  const { user, userProfile, workerProfile, logout, refreshProfile } = useAuth();
  
  // Real-time collections mapped to worker
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [opsLoading, setOpsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load custom worker profile context
  const targetWorkerId = workerProfile?.workerId || userProfile?.workerId;

  useEffect(() => {
    if (!targetWorkerId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Secure query: Only pull tasks matching current worker's ID username
    const tasksQuery = query(
      collection(db, "tasks"),
      where("assignedWorkerId", "==", targetWorkerId)
    );

    const unsubscribe = onSnapshot(
      tasksQuery,
      (snap) => {
        const loaded: Task[] = [];
        snap.forEach((docSnap) => loaded.push(docSnap.data() as Task));
        setMyTasks(loaded);
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "tasks");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [targetWorkerId]);

  // Update Task Status
  const handleUpdateTaskStatus = async (taskId: string, newStatus: Task["status"]) => {
    setOpsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const taskRef = doc(db, "tasks", taskId);
      await updateDoc(taskRef, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });

      setSuccessMsg(`Task "${taskId}" has been updated to "${newStatus.replace("_", " ")}".`);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Failed to update task: ${err.message}`);
    } finally {
      setOpsLoading(false);
    }
  };

  // Change Shift Duty Status
  const handleUpdateDutyStatus = async (newStatus: WorkerLookup["status"]) => {
    if (!targetWorkerId) return;

    setOpsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const workerRef = doc(db, "workers", targetWorkerId);
      await updateDoc(workerRef, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });

      setSuccessMsg(`Your shift status is now "${newStatus.toUpperCase().replace("_", " ")}".`);
      
      // Sync back AuthContext state
      if (user) {
        await refreshProfile(user.uid);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Failed to update shift registry status: ${err.message}`);
    } finally {
      setOpsLoading(false);
    }
  };

  if (!targetWorkerId) {
    return (
      <div className="min-h-screen bg-[#050b1a] text-slate-100 flex flex-col justify-center items-center px-4 font-sans relative overflow-hidden">
        {/* Decorative ambient background flares */}
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[150px] pointer-events-none"></div>

        <div className="w-full max-w-md bg-white/[0.03] backdrop-blur-2xl border border-white/10 p-6 rounded-3xl shadow-2xl text-center space-y-4 z-10">
          <ShieldAlert className="w-12 h-12 text-red-400 mx-auto" />
          <h1 className="text-xl font-bold text-white">Missing Worker Credentials</h1>
          <p className="text-slate-400 text-xs leading-relaxed">
            Your authenticated user metadata is missing a link to a registered Worker ID. Please log out and sign back in using the custom "Worker Portal" tab-form.
          </p>
          <button
            onClick={logout}
            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
          >
            Return to Login Portal
          </button>
        </div>
      </div>
    );
  }

  // Calculated counters
  const tasksPending = myTasks.filter(t => t.status === "pending").length;
  const tasksProgress = myTasks.filter(t => t.status === "in_progress").length;
  const tasksCompleted = myTasks.filter(t => t.status === "completed").length;

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
              <Zap className="w-5.5 h-5.5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight text-white leading-tight">
                  Worker Mission Panel
                </h1>
                <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-full">
                  🔩 WORKER: {targetWorkerId}
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-0.5">
                Personnel: {workerProfile?.name || userProfile?.displayName} &bull; {user?.email}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 bg-white/5 hover:bg-red-950/20 border border-white/10 hover:border-red-500/30 text-slate-300 hover:text-red-400 font-semibold px-4 py-2.5 rounded-xl text-xs tracking-wide transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            End Shift Session
          </button>
        </div>
      </header>

      {/* Main Operations Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6 z-10">
        
        {/* Alerts notifications bar */}
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

        {/* Worker Shift Status Slide-panel */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Power className="w-4 h-4 text-emerald-400 animate-pulse" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                Reporting Shift Duty Status
              </h2>
            </div>
            <p className="text-slate-450 text-xs">
              Toggle your active availability. Changes sync live on Manager boards.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 bg-white/5 p-1.5 rounded-xl border border-white/10 max-w-md w-full md:w-auto">
            <button
              onClick={() => handleUpdateDutyStatus("active")}
              disabled={opsLoading}
              className={`py-2 px-3 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                workerProfile?.status === "active"
                  ? "bg-emerald-600/40 text-emerald-250 border border-emerald-500/30 shadow-inner font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              🟢 Active
            </button>
            <button
              onClick={() => handleUpdateDutyStatus("on_duty")}
              disabled={opsLoading}
              className={`py-2 px-3 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                workerProfile?.status === "on_duty"
                  ? "bg-indigo-650/40 text-blue-250 border border-indigo-500/30 shadow-inner font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              🔵 On Duty
            </button>
            <button
              onClick={() => handleUpdateDutyStatus("off_duty")}
              disabled={opsLoading}
              className={`py-2 px-3 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                workerProfile?.status === "off_duty"
                  ? "bg-white/10 text-white shadow-inner font-bold"
                  : "text-slate-500 hover:text-white"
              }`}
            >
              ⚪ Off Duty
            </button>
          </div>
        </div>

        {/* Statistics trackers */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-xl p-4.5 shadow-md">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Assigned / Queue</span>
            <span className="text-2xl font-extrabold text-amber-400 leading-none">{tasksPending} Tasks</span>
          </div>

          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-xl p-4.5 shadow-md">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">In Progress</span>
            <span className="text-2xl font-extrabold text-indigo-400 leading-none">{tasksProgress} Tasks</span>
          </div>

          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-xl p-4.5 shadow-md">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Completed</span>
            <span className="text-2xl font-extrabold text-emerald-400 leading-none">{tasksCompleted} Tasks</span>
          </div>
        </div>

        {/* Isolated Task Queue ledger list */}
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">
                My Operational Work Orders
              </h2>
            </div>
            <span className="text-[10px] bg-white/5 text-slate-400 font-bold px-2.5 py-0.5 rounded border border-white/15">
              {myTasks.length} tasks
            </span>
          </div>

          {loading ? (
            <div className="text-center py-12 text-slate-500 text-xs animate-pulse">
              Syncing secure operational channels...
            </div>
          ) : myTasks.length === 0 ? (
            <div className="text-center py-12 bg-white/[0.01] border border-dashed border-white/10 rounded-xl text-slate-500 text-xs">
              <AlertCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <span>You have no active tasks in your queue. Enjoy your shift spacing!</span>
            </div>
          ) : (
            <div className="space-y-4">
              {myTasks.map((task) => (
                <div 
                  key={task.taskId}
                  className="bg-white/[0.02] backdrop-blur-md border border-white/10 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white/[0.04] transition-all"
                >
                  <div className="space-y-1.5 flex-1 pr-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[9px] font-bold text-slate-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded">
                        {task.taskId}
                      </span>
                      <h3 className="text-sm font-bold text-white tracking-tight">{task.title}</h3>
                      <span className={`text-[9px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                        task.status === "completed" 
                          ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400" 
                          : task.status === "in_progress"
                            ? "bg-indigo-500/10 border-indigo-500/25 text-indigo-400"
                            : "bg-amber-500/10 border-amber-500/25 text-amber-400"
                      }`}>
                        {task.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-slate-400 text-xs leading-relaxed">{task.description}</p>
                    <div className="text-[10px] text-slate-500">
                      Dispatched by Operations Manager: <strong className="text-slate-350">{task.createdBy}</strong> &bull; Task issued at {new Date(task.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Operational controls for advancing status */}
                  <div className="flex flex-col sm:flex-row gap-2 shrink-0 max-w-xs w-full sm:w-auto">
                    {task.status === "pending" && (
                      <button
                        onClick={() => handleUpdateTaskStatus(task.taskId, "in_progress")}
                        disabled={opsLoading}
                        className="w-full sm:w-auto bg-indigo-600/40 hover:bg-indigo-600/55 border border-indigo-550/40 text-white font-bold py-2 px-3.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        Start Task
                      </button>
                    )}
                    
                    {task.status === "in_progress" && (
                      <button
                        onClick={() => handleUpdateTaskStatus(task.taskId, "completed")}
                        disabled={opsLoading}
                        className="w-full sm:w-auto bg-emerald-600/40 hover:bg-emerald-600/55 border border-emerald-550/40 text-white font-bold py-2 px-3.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        Complete Work
                      </button>
                    )}

                    {task.status === "completed" && (
                      <div className="flex items-center gap-1.5 bg-emerald-950/20 border border-emerald-500/30 text-emerald-400 text-xs font-semibold px-3 py-2 rounded-xl">
                        <Check className="w-4 h-4" />
                        <span>Work Confirmed</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
};
