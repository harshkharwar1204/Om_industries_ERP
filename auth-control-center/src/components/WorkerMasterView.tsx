import React, { useState, useEffect } from "react";
import { collection, onSnapshot, setDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError } from "../firebase";
import { WorkerMaster, OperationType } from "../types";
import { Search, Plus, Edit2, Eye, Trash2, RotateCcw, User, MapPin, Phone, Briefcase, DollarSign, Archive, AlertCircle, Camera, Check } from "lucide-react";

interface WorkerMasterViewProps {
  role: string;
}

const PRESET_UNITS = ["Hanks Unit", "Dyeing Unit", "Conning Unit"];
const PRESET_ROLES = ["Operator", "Helper", "Supervisor", "Weaver", "Tailor", "Technician", "Inspector"];

export const WorkerMasterView: React.FC<WorkerMasterViewProps> = ({ role }) => {
  const [workers, setWorkers] = useState<WorkerMaster[]>([]);
  const [search, setSearch] = useState("");
  const [showSoftDeleted, setShowSoftDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form modal states
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [editingWorker, setEditingWorker] = useState<WorkerMaster | null>(null);

  // Input states
  const [workerName, setWorkerName] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [unit, setUnit] = useState("Hanks Unit");
  const [customUnit, setCustomUnit] = useState("");
  const [isCustomUnit, setIsCustomUnit] = useState(false);
  const [workerRole, setWorkerRole] = useState("Operator");
  const [customRole, setCustomRole] = useState("");
  const [isCustomRole, setIsCustomRole] = useState(false);
  const [rate, setRate] = useState<string>("0");
  const [workerType, setWorkerType] = useState<"Piece Rate" | "Daily Wage">("Piece Rate");

  // Viewing modal state
  const [viewingWorker, setViewingWorker] = useState<WorkerMaster | null>(null);

  // Biometric Facial Recognition registration states
  const [facePhoto, setFacePhoto] = useState<string>("");
  const [showWebcam, setShowWebcam] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  // Auto handle webcam stream cycle
  useEffect(() => {
    if (showWebcam) {
      setErrorMsg(null);
      navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } })
        .then((s) => {
          setStream(s);
          setTimeout(() => {
            if (videoRef.current) {
              videoRef.current.srcObject = s;
              videoRef.current.play().catch(e => console.log("Stream play error:", e));
            }
          }, 150);
        })
        .catch((err) => {
          console.error("Camera permissions blocked / unsupported device error:", err);
          setErrorMsg("Facial capture hardware connection failed. Verify webcam permissions.");
          setShowWebcam(false);
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
  }, [showWebcam]);

  // Capture current frame from webcam
  const captureFrame = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = 300;
      canvas.height = 300;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const v = videoRef.current;
        const size = Math.min(v.videoWidth || 320, v.videoHeight || 240);
        const xOffset = ((v.videoWidth || 320) - size) / 2;
        const yOffset = ((v.videoHeight || 240) - size) / 2;
        ctx.drawImage(v, xOffset, yOffset, size, size, 0, 0, 300, 300);
        setFacePhoto(canvas.toDataURL("image/jpeg", 0.9));
        setShowWebcam(false);
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
          setStream(null);
        }
      }
    }
  };

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, "worker_masters"),
      (snap) => {
        const list: WorkerMaster[] = [];
        snap.forEach((docSnap) => {
          list.push(docSnap.data() as WorkerMaster);
        });
        setWorkers(list);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, "worker_masters");
      }
    );
    return () => unsubscribe();
  }, []);

  const triggerForm = (worker: WorkerMaster | null = null) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (worker) {
      setEditingWorker(worker);
      setWorkerName(worker.workerName);
      setMobile(worker.mobile);
      setAddress(worker.address);
      
      if (PRESET_UNITS.includes(worker.unit)) {
        setUnit(worker.unit);
        setCustomUnit("");
        setIsCustomUnit(false);
      } else {
        setUnit("Other");
        setCustomUnit(worker.unit);
        setIsCustomUnit(true);
      }

      if (PRESET_ROLES.includes(worker.role)) {
        setWorkerRole(worker.role);
        setCustomRole("");
        setIsCustomRole(false);
      } else {
        setWorkerRole("Other");
        setCustomRole(worker.role);
        setIsCustomRole(true);
      }

      setRate(worker.rate.toString());
      setWorkerType(worker.workerType || "Piece Rate");
      setFacePhoto(worker.facePhoto || "");
      setShowWebcam(false);
    } else {
      setEditingWorker(null);
      setWorkerName("");
      setMobile("");
      setAddress("");
      setUnit("Hanks Unit");
      setCustomUnit("");
      setIsCustomUnit(false);
      setWorkerRole("Operator");
      setCustomRole("");
      setIsCustomRole(false);
      setRate("0");
      setWorkerType("Piece Rate");
      setFacePhoto("");
      setShowWebcam(false);
    }
    setIsOpenForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const finalName = workerName.trim();
    const finalMobile = mobile.trim();
    const finalAddress = address.trim();
    const finalUnit = isCustomUnit ? customUnit.trim() : unit;
    const finalRole = isCustomRole ? customRole.trim() : workerRole;
    const finalRateValue = parseFloat(rate);

    if (!finalName || !finalMobile || !finalAddress || !finalUnit || !finalRole) {
      setErrorMsg("All fields are required. Please verify inputs.");
      return;
    }

    if (isNaN(finalRateValue) || finalRateValue < 0) {
      setErrorMsg("Rate must be a non-negative number.");
      return;
    }

    try {
      const isNew = !editingWorker;
      // Auto generate Auto Worker ID: WRK- followed by 5 random numeric digits for perfect unique reference
      const workerId = isNew ? "WRK-" + Math.random().toString().slice(2, 7) : editingWorker!.workerId;
      const docRef = doc(db, "worker_masters", workerId);

      const payload: WorkerMaster = {
        workerId,
        workerName: finalName,
        mobile: finalMobile,
        address: finalAddress,
        unit: finalUnit,
        role: finalRole,
        rate: finalRateValue,
        workerType,
        facePhoto: facePhoto || "",
        isDeleted: isNew ? false : editingWorker!.isDeleted,
        updatedAt: serverTimestamp(),
        createdAt: isNew ? serverTimestamp() : editingWorker!.createdAt
      };

      await setDoc(docRef, payload);
      setSuccessMsg(`Worker "${finalName}" successfully ${isNew ? "created and cataloged" : "updated"} under ID ${workerId}.`);
      setIsOpenForm(false);
    } catch (err) {
      setErrorMsg("Failed to update Worker Master directory entries.");
      handleFirestoreError(err, editingWorker ? OperationType.UPDATE : OperationType.CREATE, "worker_masters");
    }
  };

  const toggleDelete = async (worker: WorkerMaster) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const docRef = doc(db, "worker_masters", worker.workerId);
      await updateDoc(docRef, {
        isDeleted: !worker.isDeleted,
        updatedAt: serverTimestamp()
      });
      setSuccessMsg(`Worker "${worker.workerName}" statement successfully ${worker.isDeleted ? "restored to active log" : "soft archived"}.`);
    } catch (err) {
      setErrorMsg("Archive state change requested could not register.");
      handleFirestoreError(err, OperationType.UPDATE, `worker_masters/${worker.workerId}`);
    }
  };

  const filteredWorkers = workers.filter((w) => {
    const term = search.toLowerCase();
    const matchesSearch =
      w.workerId.toLowerCase().includes(term) ||
      w.workerName.toLowerCase().includes(term) ||
      w.mobile.includes(term) ||
      w.unit.toLowerCase().includes(term) ||
      w.role.toLowerCase().includes(term);
    const matchesDelete = showSoftDeleted ? w.isDeleted : !w.isDeleted;
    return matchesSearch && matchesDelete;
  });

  return (
    <div className="space-y-5 font-sans">
      {/* Messages */}
      {(successMsg || errorMsg) && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs ${
          successMsg ? "bg-[#10b981]/10 border-[#10b981]/25 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-500"
        }`}>
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg || errorMsg}</span>
        </div>
      )}

      {/* Control Tools */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white/[0.02] border border-white/5 rounded-2xl p-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search workers by ID, Name, unit or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showSoftDeleted}
              onChange={(e) => setShowSoftDeleted(e.target.checked)}
              className="rounded border-white/10 bg-white/5 text-indigo-600 focus:ring-0 focus:ring-offset-0"
            />
            <span className="flex items-center gap-1">
              <Archive className="w-3.5 h-3.5" />
              Show Archived Roster
            </span>
          </label>

          {(role === "owner" || role === "manager") && (
            <button
              onClick={() => triggerForm()}
              className="bg-indigo-605 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-3.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Commission New Worker</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Table Grid */}
      <div className="bg-[#0a1128]/50 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.012] text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Worker ID</th>
                <th className="py-3 px-4">Worker Legal Name</th>
                <th className="py-3 px-4">Contact Phone</th>
                <th className="py-3 px-4">Assigned Unit</th>
                <th className="py-3 px-4">Designated Role</th>
                <th className="py-3 px-4">Worker Type</th>
                <th className="py-3 px-4 text-right">Base / Daily Rate</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500 font-mono">
                    Syncing Workers database master ledger...
                  </td>
                </tr>
              ) : filteredWorkers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500">
                    No active staff registers matched indices query.
                  </td>
                </tr>
              ) : (
                filteredWorkers.map((w) => (
                  <tr key={w.workerId} className="hover:bg-white/[0.018] transition-colors">
                    <td className="py-3 px-4 font-mono text-cyan-400 font-bold">{w.workerId}</td>
                    <td className="py-3 px-4 font-medium text-white">
                      <div className="flex items-center gap-2.5">
                        {w.facePhoto ? (
                          <img src={w.facePhoto} alt="" className="w-7 h-7 rounded-full object-cover border border-white/15" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] text-slate-500 font-bold">
                            {w.workerName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span>{w.workerName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-indigo-300">{w.mobile}</td>
                    <td className="py-3 px-4">
                      <span className="bg-white/5 border border-white/5 px-2.5 py-0.5 rounded text-[10px] uppercase font-bold text-slate-300">
                        {w.unit}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded text-[10px] text-indigo-300 font-bold">
                        {w.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`border px-2 py-0.5 rounded text-[10px] font-bold ${
                        w.workerType === "Daily Wage"
                          ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                          : "bg-indigo-500/10 border-indigo-500/20 text-indigo-300"
                      }`}>
                        {w.workerType || "Piece Rate"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                      ${w.rate.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setViewingWorker(w)}
                          className="p-1.5 border border-white/5 bg-white/[0.012] hover:bg-white/[0.05] rounded-l-lg rounded-r-lg text-slate-300 transition-colors cursor-pointer"
                          title="Details verification"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {(role === "owner" || role === "manager") && (
                          <>
                            <button
                              onClick={() => triggerForm(w)}
                              className="p-1.5 border border-white/5 hover:border-indigo-500/35 bg-white/[0.012] hover:bg-indigo-500/10 text-slate-300 hover:text-indigo-400 rounded-lg transition-colors cursor-pointer"
                              title="Modify active attributes"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => toggleDelete(w)}
                              className={`p-1.5 border border-white/5 rounded-lg transition-colors cursor-pointer ${
                                w.isDeleted
                                  ? "hover:border-emerald-500/35 hover:bg-emerald-500/10 text-emerald-400"
                                  : "hover:border-red-500/35 hover:bg-red-500/10 text-red-400"
                              }`}
                              title={w.isDeleted ? "Unarchive Roster" : "Soft Archive Worker"}
                            >
                              {w.isDeleted ? <RotateCcw className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main form Modal */}
      {isOpenForm && (
        <div className="fixed inset-0 bg-[#060a1d]/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b122c] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-400" />
              {editingWorker ? "Modify Worker Master Profile" : "Commission New Corporate Worker"}
            </h3>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Worker Legal Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., John Smith"
                  value={workerName}
                  onChange={(e) => setWorkerName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Mobile Phone</label>
                  <input
                    type="tel"
                    required
                    placeholder="9012345678"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-2.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Worker Type</label>
                  <select
                    value={workerType}
                    onChange={(e) => setWorkerType(e.target.value as "Piece Rate" | "Daily Wage")}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-2.5 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="Piece Rate" className="bg-[#0b122c]">Piece Rate</option>
                    <option value="Daily Wage" className="bg-[#0b122c]">Daily Wage</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    {workerType === "Daily Wage" ? "Daily Rate ($)" : "Base Rate ($)"}
                  </label>
                  <input
                    type="number"
                    required
                    step="any"
                    min="0"
                    placeholder="e.g., 12.50"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-2.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Production Unit</label>
                  <select
                    value={unit}
                    onChange={(e) => {
                      setUnit(e.target.value);
                      setIsCustomUnit(e.target.value === "Other");
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    {PRESET_UNITS.map((u) => (
                      <option key={u} value={u} className="bg-[#0b122c]">{u}</option>
                    ))}
                    <option value="Other" className="bg-[#0b122c]">Other / Custom</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Designated Role</label>
                  <select
                    value={workerRole}
                    onChange={(e) => {
                      setWorkerRole(e.target.value);
                      setIsCustomRole(e.target.value === "Other");
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    {PRESET_ROLES.map((r) => (
                      <option key={r} value={r} className="bg-[#0b122c]">{r}</option>
                    ))}
                    <option value="Other" className="bg-[#0b122c]">Other / Custom</option>
                  </select>
                </div>
              </div>

              {/* Custom Input Fields if Custom values are toggled */}
              {(isCustomUnit || isCustomRole) && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-white/5 border border-white/10 rounded-2xl animate-fadeIn">
                  {isCustomUnit ? (
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-amber-400 uppercase tracking-wider block">Custom Unit Title</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., Unit 4"
                        value={customUnit}
                        onChange={(e) => setCustomUnit(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                  ) : <div />}
                  {isCustomRole ? (
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider block">Custom Role Title</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., Dye master"
                        value={customRole}
                        onChange={(e) => setCustomRole(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-400"
                      />
                    </div>
                  ) : <div />}
                </div>
              )}

              {/* Face Biometric profile */}
              <div className="space-y-2 p-3 bg-white/[0.02] border border-white/5 rounded-2xl">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center justify-between">
                  <span>Face Biometrics Registry</span>
                  <span className="text-[9px] text-indigo-400 font-mono tracking-normal capitalize">{facePhoto ? "Registered" : "Unassigned"}</span>
                </label>

                {showWebcam ? (
                  <div className="space-y-2">
                    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-indigo-500/30">
                      <video
                        ref={videoRef}
                        className="w-full h-full object-cover scale-x-[-1]"
                        playsInline
                        muted
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-24 h-24 border-2 border-indigo-500/60 rounded-full border-dashed animate-pulse relative">
                          <div className="absolute top-0 left-1/2 w-32 h-0.5 bg-indigo-500/70 animate-bounce shadow-[0_0_8px_rgba(99,102,241,0.7)]" style={{ transform: "translateX(-50%)" }} />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-center">
                      <button
                        type="button"
                        onClick={captureFrame}
                        className="bg-emerald-500 shadow-md shadow-emerald-500/10 hover:bg-emerald-400 text-slate-950 font-extrabold px-3 py-1.5 rounded-lg text-[9px] uppercase cursor-pointer"
                      >
                        Capture Snapshot
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowWebcam(false)}
                        className="bg-white/5 text-slate-300 border border-white/10 px-3 py-1.5 rounded-lg text-[9px] uppercase cursor-pointer"
                      >
                        Cancel Camera
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    {facePhoto ? (
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-emerald-500/50 flex-shrink-0 group">
                        <img src={facePhoto} alt="Worker Face" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <button
                          type="button"
                          onClick={() => setFacePhoto("")}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-red-400 text-[9px] uppercase font-bold transition-opacity cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 flex-shrink-0">
                        <Camera className="w-5 h-5" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowWebcam(true)}
                      className="bg-indigo-600/10 border border-indigo-600/20 hover:bg-indigo-600/20 text-indigo-400 text-[10px] font-bold px-3 py-2 rounded-xl uppercase tracking-wider cursor-pointer transition-colors"
                    >
                      {facePhoto ? "Re-scan Facial Profile" : "Register Worker Face (Webcam)"}
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Postal Mailing Address</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Street Address, City, State, Pincode"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsOpenForm(false)}
                  className="bg-white/5 hover:bg-white/10 text-slate-300 font-bold py-2 px-4 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-5 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review details Dialog */}
      {viewingWorker && (
        <div className="fixed inset-0 bg-[#060a1d]/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b122c] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-cyan-400" />
              Worker ledger audit card
            </h3>

            <div className="space-y-3 font-mono text-xs text-slate-300">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-550 text-slate-500 flex items-center gap-1">Auto System ID</span>
                <span className="text-white font-bold">{viewingWorker.workerId}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Legal Name</span>
                <span className="text-white font-sans font-bold">{viewingWorker.workerName}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500 flex items-center gap-1">Mobile Contact</span>
                <span className="text-cyan-400">{viewingWorker.mobile}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Operating Unit</span>
                <span className="text-white text-[11px] font-sans font-medium uppercase">{viewingWorker.unit}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Operating Role</span>
                <span className="text-indigo-300 font-sans font-medium">{viewingWorker.role}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-550 text-slate-500 flex items-center gap-1">Worker Compensation Type</span>
                <span className="text-amber-400 font-bold font-sans">{viewingWorker.workerType || "Piece Rate"}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Assigned Rate</span>
                <span className="text-emerald-400 font-extrabold font-mono">${viewingWorker.rate.toFixed(2)} {viewingWorker.workerType === "Daily Wage" ? "/ Day" : "/ Unit"}</span>
              </div>
              <div className="space-y-1 border-b border-white/5 pb-2">
                <span className="text-slate-500 block">Personal Address Log:</span>
                <p className="font-sans leading-relaxed text-slate-300 bg-white/[0.02] border border-white/5 p-3 rounded-xl whitespace-pre-wrap">
                  {viewingWorker.address}
                </p>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">Roster System Status</span>
                <span className={`font-bold ${viewingWorker.isDeleted ? "text-red-400 animate-pulse" : "text-emerald-400"}`}>
                  {viewingWorker.isDeleted ? "ARCHIVED OUT OF ROSTER" : "FULLY ACTIVE ON-DUTY"}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setViewingWorker(null)}
                className="bg-white/5 hover:bg-white/10 text-white font-bold py-2 px-5 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
