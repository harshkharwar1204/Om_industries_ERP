import React, { useState, useEffect } from "react";
import { collection, onSnapshot, setDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError } from "../firebase";
import { Shade, OperationType } from "../types";
import { Search, Plus, Edit2, Eye, Trash2, RotateCcw, Columns, AlertCircle } from "lucide-react";

interface ShadeMasterViewProps {
  role: string;
}

export const ShadeMasterView: React.FC<ShadeMasterViewProps> = ({ role }) => {
  const [shades, setShades] = useState<Shade[]>([]);
  const [search, setSearch] = useState("");
  const [showSoftDeleted, setShowSoftDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [editingShade, setEditingShade] = useState<Shade | null>(null);

  // Inputs
  const [shadeName, setShadeName] = useState("");
  const [shadeCode, setShadeCode] = useState("");
  const [description, setDescription] = useState("");

  // Viewing
  const [viewingShade, setViewingShade] = useState<Shade | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, "shades"),
      (snap) => {
        const list: Shade[] = [];
        snap.forEach((docSnap) => {
          list.push(docSnap.data() as Shade);
        });
        setShades(list);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, "shades");
      }
    );
    return () => unsubscribe();
  }, []);

  const triggerForm = (shade: Shade | null = null) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (shade) {
      setEditingShade(shade);
      setShadeName(shade.shadeName);
      setShadeCode(shade.shadeCode);
      setDescription(shade.description);
    } else {
      setEditingShade(null);
      setShadeName("");
      setShadeCode("");
      setDescription("");
    }
    setIsOpenForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!shadeName.trim() || !shadeCode.trim()) {
      setErrorMsg("Shade designation properties cannot be empty.");
      return;
    }

    try {
      const isNew = !editingShade;
      const shadeId = isNew ? "SHD-" + Math.random().toString(36).substr(2, 9).toUpperCase() : editingShade!.shadeId;
      const docRef = doc(db, "shades", shadeId);

      const payload = {
        shadeId,
        shadeName: shadeName.trim(),
        shadeCode: shadeCode.trim().toUpperCase(),
        description: description.trim(),
        isDeleted: isNew ? false : editingShade!.isDeleted,
        updatedAt: serverTimestamp(),
        ...(isNew ? { createdAt: serverTimestamp() } : { createdAt: editingShade!.createdAt })
      };

      await setDoc(docRef, payload);
      setSuccessMsg(`Shade profile "${shadeName.trim()}" successfully registered.`);
      setIsOpenForm(false);
    } catch (err) {
      setErrorMsg("Write failed.");
      handleFirestoreError(err, editingShade ? OperationType.UPDATE : OperationType.CREATE, "shades");
    }
  };

  const toggleDelete = async (shade: Shade) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const docRef = doc(db, "shades", shade.shadeId);
      await updateDoc(docRef, {
        isDeleted: !shade.isDeleted,
        updatedAt: serverTimestamp()
      });
      setSuccessMsg(`Shade "${shade.shadeName}" successfully ${shade.isDeleted ? "restored to active listing" : "archived"}.`);
    } catch (err) {
      setErrorMsg("Could not process record status change.");
      handleFirestoreError(err, OperationType.UPDATE, `shades/${shade.shadeId}`);
    }
  };

  const filteredShades = shades.filter((sh) => {
    const matchesSearch =
      sh.shadeName.toLowerCase().includes(search.toLowerCase()) ||
      sh.shadeCode.toLowerCase().includes(search.toLowerCase()) ||
      sh.description.toLowerCase().includes(search.toLowerCase());
    const matchesDelete = showSoftDeleted ? sh.isDeleted : !sh.isDeleted;
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
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-550 text-slate-500" />
          <input
            type="text"
            placeholder="Search shades by name, formula number..."
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
              className="bg-indigo-650 hover:bg-indigo-600 text-white font-bold py-2 px-3.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Catalog New Shade</span>
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
                <th className="py-3 px-4">Shade Code Reference</th>
                <th className="py-3 px-4">Color Designation</th>
                <th className="py-3 px-4">Formula / Notes</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-slate-500">
                    Syncing Shade recipe registers...
                  </td>
                </tr>
              ) : filteredShades.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-slate-500 font-sans text-slate-550">
                    No registered shade codes detected matching criteria.
                  </td>
                </tr>
              ) : (
                filteredShades.map((sh) => (
                  <tr key={sh.shadeId} className="hover:bg-white/[0.015] transition-colors">
                    <td className="py-3 px-4 font-mono text-cyan-400 font-bold">{sh.shadeCode}</td>
                    <td className="py-3 px-4 font-medium text-white">{sh.shadeName}</td>
                    <td className="py-3 px-4 text-slate-450 text-slate-400 truncate max-w-xs" title={sh.description}>
                      {sh.description || "No recipes annotated"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setViewingShade(sh)}
                          className="p-1.5 border border-white/5 bg-white/[0.012] hover:bg-white/[0.04] rounded-lg transition-all text-slate-300 cursor-pointer"
                          title="Audit Shade Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {(role === "owner" || role === "manager") && (
                          <>
                            <button
                              onClick={() => triggerForm(sh)}
                              className="p-1.5 border border-white/5 bg-white/[0.012] hover:border-indigo-500/25 text-slate-300 hover:text-indigo-400 rounded-lg transition-all cursor-pointer"
                              title="Modify shade rules"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => toggleDelete(sh)}
                              className={`p-1.5 border border-white/5 rounded-lg transition-colors cursor-pointer ${
                                sh.isDeleted
                                  ? "hover:border-emerald-500/20 hover:bg-emerald-500/10 text-emerald-400"
                                  : "hover:border-red-500/20 hover:bg-red-500/10 text-red-400"
                              }`}
                              title={sh.isDeleted ? "Unarchive shade" : "Archive shade"}
                            >
                              {sh.isDeleted ? <RotateCcw className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
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

      {/* Creation Modal */}
      {isOpenForm && (
        <div className="fixed inset-0 bg-[#060a1d]/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b122c] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Columns className="w-4 h-4 text-indigo-400" />
              {editingShade ? "Modify Design Shade Index" : "Create Master Shade Recipe"}
            </h3>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Shade Designation (Name)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Royal Cobalt Blue F-2"
                  value={shadeName}
                  onChange={(e) => setShadeName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Lab Code (Formula SKU)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., COBALT-85-D"
                  value={shadeCode}
                  onChange={(e) => setShadeCode(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white uppercase focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Formula Recipe & Description Notes</label>
                <textarea
                  rows={3}
                  placeholder="Dye compound instructions, chemical composition, percentage mix instructions..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none resize-none"
                />
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
      {viewingShade && (
        <div className="fixed inset-0 bg-[#060a1d]/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b122c] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Columns className="w-4 h-4 text-cyan-400" />
              Shade master recipe audit
            </h3>

            <div className="space-y-3.5 text-xs text-slate-300 font-mono">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Shade System ID</span>
                <span className="text-white text-right">{viewingShade.shadeId}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Unique Lab Code</span>
                <span className="text-cyan-400 font-bold text-right">{viewingShade.shadeCode}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Color Design Term</span>
                <span className="text-white font-sans font-bold text-right">{viewingShade.shadeName}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 block">Recipe Notes / Description:</span>
                <div className="bg-white/[0.02] border border-white/5 p-3 rounded-xl font-sans text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {viewingShade.description || "No personalized formula notes documented."}
                </div>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Registry Scope</span>
                <span className={`font-bold ${viewingShade.isDeleted ? "text-red-400" : "text-emerald-400"}`}>
                  {viewingShade.isDeleted ? "Archived Listing" : "Active In Production Reciprocators"}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewingShade(null)}
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
