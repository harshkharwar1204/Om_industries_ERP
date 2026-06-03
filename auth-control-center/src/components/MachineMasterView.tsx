import React, { useState, useEffect } from "react";
import { collection, onSnapshot, setDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError } from "../firebase";
import { Machine, OperationType } from "../types";
import { Search, Plus, Edit2, Eye, Trash2, RotateCcw, Cpu, AlertCircle } from "lucide-react";

interface MachineMasterViewProps {
  role: string;
}

export const MachineMasterView: React.FC<MachineMasterViewProps> = ({ role }) => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [search, setSearch] = useState("");
  const [showSoftDeleted, setShowSoftDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);

  // Inputs
  const [machineName, setMachineName] = useState("");
  const [machineCode, setMachineCode] = useState("");
  const [capacity, setCapacity] = useState("");
  const [machineType, setMachineType] = useState("Dyeing");
  const [status, setStatus] = useState<"active" | "inactive" | "maintenance">("active");

  // Viewing
  const [viewingMachine, setViewingMachine] = useState<Machine | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, "machines"),
      (snap) => {
        const list: Machine[] = [];
        snap.forEach((docSnap) => {
          list.push(docSnap.data() as Machine);
        });
        setMachines(list);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, "machines");
      }
    );
    return () => unsubscribe();
  }, []);

  const triggerForm = (mach: Machine | null = null) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (mach) {
      setEditingMachine(mach);
      setMachineName(mach.machineName);
      setMachineCode(mach.machineCode);
      setCapacity(mach.capacity);
      setMachineType(mach.machineType);
      setStatus(mach.status);
    } else {
      setEditingMachine(null);
      setMachineName("");
      setMachineCode("");
      setCapacity("");
      setMachineType("Dyeing");
      setStatus("active");
    }
    setIsOpenForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!machineName.trim() || !machineCode.trim()) {
      setErrorMsg("Machine Name and Unique Asset Code are required.");
      return;
    }

    try {
      const isNew = !editingMachine;
      const machineId = isNew ? "MCH-" + Math.random().toString(36).substr(2, 9).toUpperCase() : editingMachine!.machineId;
      const docRef = doc(db, "machines", machineId);

      const payload = {
        machineId,
        machineName: machineName.trim(),
        machineCode: machineCode.trim().toUpperCase(),
        capacity: capacity.trim(),
        machineType,
        status,
        isDeleted: isNew ? false : editingMachine!.isDeleted,
        updatedAt: serverTimestamp(),
        ...(isNew ? { createdAt: serverTimestamp() } : { createdAt: editingMachine!.createdAt })
      };

      await setDoc(docRef, payload);
      setSuccessMsg(`Machine asset "${machineName.trim()}" successfully recorded.`);
      setIsOpenForm(false);
    } catch (err) {
      setErrorMsg("Failed to catalog machinery component.");
      handleFirestoreError(err, editingMachine ? OperationType.UPDATE : OperationType.CREATE, "machines");
    }
  };

  const toggleDelete = async (mach: Machine) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const docRef = doc(db, "machines", mach.machineId);
      await updateDoc(docRef, {
        isDeleted: !mach.isDeleted,
        updatedAt: serverTimestamp()
      });
      setSuccessMsg(`Machine "${mach.machineName}" successfully ${mach.isDeleted ? "restored" : "soft archived"}.`);
    } catch (err) {
      setErrorMsg("Could not process machine status flag.");
      handleFirestoreError(err, OperationType.UPDATE, `machines/${mach.machineId}`);
    }
  };

  const filteredMachines = machines.filter((m) => {
    const matchesSearch =
      m.machineName.toLowerCase().includes(search.toLowerCase()) ||
      m.machineCode.toLowerCase().includes(search.toLowerCase()) ||
      m.machineType.toLowerCase().includes(search.toLowerCase());
    const matchesDelete = showSoftDeleted ? m.isDeleted : !m.isDeleted;
    return matchesSearch && matchesDelete;
  });

  return (
    <div className="space-y-5 font-sans">
      {(successMsg || errorMsg) && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs ${
          successMsg ? "bg-[#10b981]/10 border-[#10b981]/25 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-500"
        }`}>
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg || errorMsg}</span>
        </div>
      )}

      {/* Control bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white/[0.02] border border-white/5 rounded-2xl p-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search machines by designation, type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/40"
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
            <span>Show Archival Logs</span>
          </label>

          {(role === "owner" || role === "manager") && (
            <button
              onClick={() => triggerForm()}
              className="bg-indigo-650 hover:bg-indigo-650/80 text-white font-bold py-2 px-3.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Catalog New Machine</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid List */}
      <div className="bg-[#0a1128]/50 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.012] text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Machine Code</th>
                <th className="py-3 px-4">Asset Name</th>
                <th className="py-3 px-4">Classification</th>
                <th className="py-3 px-4 font-mono">Max Capacity</th>
                <th className="py-3 px-4">Real-time status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    Syncing Machineries index in real-time...
                  </td>
                </tr>
              ) : filteredMachines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500 font-sans text-slate-550">
                    No recorded machinery components match search parameters.
                  </td>
                </tr>
              ) : (
                filteredMachines.map((mach) => (
                  <tr key={mach.machineId} className="hover:bg-white/[0.015] transition-colors">
                    <td className="py-3 px-4 font-mono text-cyan-400 font-bold">{mach.machineCode}</td>
                    <td className="py-3 px-4 font-medium text-white">{mach.machineName}</td>
                    <td className="py-3 px-4 text-slate-400 font-semibold">{mach.machineType}</td>
                    <td className="py-3 px-4 font-mono text-indigo-300 font-bold">{mach.capacity || "N/A"}</td>
                    <td className="py-3 px-4">
                      <span className={`text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded border ${
                        mach.status === "active"
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                          : mach.status === "inactive"
                            ? "bg-white/5 border border-white/10 text-slate-500"
                            : "bg-amber-400/10 border-amber-400/25 text-amber-400"
                      }`}>
                        {mach.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setViewingMachine(mach)}
                          className="p-1.5 border border-white/5 bg-white/[0.012] hover:bg-white/[0.04] rounded-lg text-slate-300 cursor-pointer"
                          title="Review Asset Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {(role === "owner" || role === "manager") && (
                          <>
                            <button
                              onClick={() => triggerForm(mach)}
                              className="p-1.5 border border-white/5 bg-white/[0.012] hover:border-indigo-500/25 text-slate-300 hover:text-indigo-400 rounded-lg cursor-pointer"
                              title="Modify Properties"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => toggleDelete(mach)}
                              className={`p-1.5 border border-white/5 rounded-lg cursor-pointer ${
                                mach.isDeleted
                                  ? "hover:border-emerald-500/20 hover:bg-emerald-500/10 text-emerald-400"
                                  : "hover:border-red-500/20 hover:bg-red-500/10 text-red-400"
                              }`}
                              title={mach.isDeleted ? "Unarchive machine" : "Archive machine"}
                            >
                              {mach.isDeleted ? <RotateCcw className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
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

      {/* Form Dialog */}
      {isOpenForm && (
        <div className="fixed inset-0 bg-[#060a1d]/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b122c] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-400" />
              {editingMachine ? "Modify Machinery Details" : "Catalog Production Machine Node"}
            </h3>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Machine designation Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Fongs Dyeing Machine-01"
                  value={machineName}
                  onChange={(e) => setMachineName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-450"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Asset / Serial Code ID</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., FNG-DY-01"
                    value={machineCode}
                    onChange={(e) => setMachineCode(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white uppercase focus:outline-none focus:border-indigo-450"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Production Type</label>
                  <select
                    value={machineType}
                    onChange={(e) => setMachineType(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="Dyeing" className="bg-[#0c1128]">Dyeing (Coloring)</option>
                    <option value="Spinning" className="bg-[#0c1128]">Spinning (Yarn assembly)</option>
                    <option value="Stenter" className="bg-[#0c1128]">Stenter (Finishing)</option>
                    <option value="Printing" className="bg-[#0c1128]">Printing (Decal)</option>
                    <option value="Packaging" className="bg-[#0c1128]">Packaging (Box/Disp)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Capacity Limit Designation</label>
                  <input
                    type="text"
                    placeholder="e.g., 500 Kg, 1000 Pcs/hr"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Initial operational state</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="active" className="bg-[#0c1128]">Active (Operational)</option>
                    <option value="inactive" className="bg-[#0c1128]">Inactive (Idle on standby)</option>
                    <option value="maintenance" className="bg-[#0c1128]">Maintenance (Tuning/Repair)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsOpenForm(false)}
                  className="bg-white/5 hover:bg-white/10 text-slate-300 font-bold py-2 px-4 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-650 hover:bg-indigo-600 text-white font-bold py-2 px-5 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View dialog */}
      {viewingMachine && (
        <div className="fixed inset-0 bg-[#060a1d]/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b122c] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              Machine node audit datasheet
            </h3>

            <div className="space-y-3.5 text-xs text-slate-300 font-mono">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Machine Registry UID</span>
                <span className="text-white text-right">{viewingMachine.machineId}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Asset / Serial Code</span>
                <span className="text-cyan-400 font-bold text-right">{viewingMachine.machineCode}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Machinery Name</span>
                <span className="text-white font-sans font-bold text-right">{viewingMachine.machineName}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Volumetric Max Capacity</span>
                <span className="text-white text-right">{viewingMachine.capacity || "Unlimited"}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Manufacturing Classification</span>
                <span className="text-indigo-300 text-right font-sans font-semibold">{viewingMachine.machineType}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Operation Working Condition</span>
                <span className={`text-[10px] font-bold uppercase ${
                  viewingMachine.status === "active"
                    ? "text-emerald-400"
                    : viewingMachine.status === "inactive"
                      ? "text-slate-500"
                      : "text-amber-400"
                }`}>
                  {viewingMachine.status}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Registry Life State</span>
                <span className={`font-bold ${viewingMachine.isDeleted ? "text-red-400" : "text-emerald-400"}`}>
                  {viewingMachine.isDeleted ? "Soft Archived Out of Service" : "Fully Indexed Active asset"}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewingMachine(null)}
                className="bg-white/5 hover:bg-white/10 text-white font-bold py-2 px-5 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
