import React, { useState, useEffect } from "react";
import { collection, onSnapshot, setDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError } from "../firebase";
import { Item, OperationType } from "../types";
import { Search, Plus, Edit2, Eye, Trash2, RotateCcw, Package, AlertCircle } from "lucide-react";

interface ItemMasterViewProps {
  role: string;
}

export const ItemMasterView: React.FC<ItemMasterViewProps> = ({ role }) => {
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [showSoftDeleted, setShowSoftDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states for creating/editing
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  
  // Input fields
  const [itemName, setItemName] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [unit, setUnit] = useState("Kg");
  const [description, setDescription] = useState("");

  // Viewing state
  const [viewingItem, setViewingItem] = useState<Item | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, "items"),
      (snap) => {
        const list: Item[] = [];
        snap.forEach((docSnap) => {
          list.push(docSnap.data() as Item);
        });
        setItems(list);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, "items");
      }
    );
    return () => unsubscribe();
  }, []);

  const triggerForm = (item: Item | null = null) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (item) {
      setEditingItem(item);
      setItemName(item.itemName);
      setItemCode(item.itemCode);
      setUnit(item.unit);
      setDescription(item.description);
    } else {
      setEditingItem(null);
      setItemName("");
      setItemCode("");
      setUnit("Kg");
      setDescription("");
    }
    setIsOpenForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!itemName.trim() || !itemCode.trim()) {
      setErrorMsg("Item Name and unique Code are required.");
      return;
    }

    try {
      const isNew = !editingItem;
      const itemId = isNew ? "ITM-" + Math.random().toString(36).substr(2, 9).toUpperCase() : editingItem!.itemId;
      const docRef = doc(db, "items", itemId);

      const payload = {
        itemId,
        itemName: itemName.trim(),
        itemCode: itemCode.trim().toUpperCase(),
        unit,
        description: description.trim(),
        isDeleted: isNew ? false : editingItem!.isDeleted,
        updatedAt: serverTimestamp(),
        ...(isNew ? { createdAt: serverTimestamp() } : { createdAt: editingItem!.createdAt })
      };

      await setDoc(docRef, payload);
      setSuccessMsg(`Item "${itemName.trim()}" successfully ${isNew ? "created" : "updated"}.`);
      setIsOpenForm(false);
    } catch (err) {
      setErrorMsg("Failed to capture master entry. Please check configuration log.");
      handleFirestoreError(err, editingItem ? OperationType.UPDATE : OperationType.CREATE, "items");
    }
  };

  const toggleDelete = async (item: Item) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const docRef = doc(db, "items", item.itemId);
      await updateDoc(docRef, {
        isDeleted: !item.isDeleted,
        updatedAt: serverTimestamp()
      });
      setSuccessMsg(`Item "${item.itemName}" was successfully ${item.isDeleted ? "restored" : "soft deleted"}.`);
    } catch (err) {
      setErrorMsg("Operation failed.");
      handleFirestoreError(err, OperationType.UPDATE, `items/${item.itemId}`);
    }
  };

  // Searching and Filtering
  const filteredItems = items.filter((itm) => {
    const matchesSearch =
      itm.itemName.toLowerCase().includes(search.toLowerCase()) ||
      itm.itemCode.toLowerCase().includes(search.toLowerCase()) ||
      itm.description.toLowerCase().includes(search.toLowerCase());
    const matchesDelete = showSoftDeleted ? itm.isDeleted : !itm.isDeleted;
    return matchesSearch && matchesDelete;
  });

  return (
    <div className="space-y-5 font-sans">
      {/* Alert Banner feedback */}
      {(successMsg || errorMsg) && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs ${
          successMsg ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"
        }`}>
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg || errorMsg}</span>
        </div>
      )}

      {/* Lookup controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white/[0.02] border border-white/5 rounded-2xl p-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search items by name, SKU/code..."
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
            <span>Show Archival Logs</span>
          </label>

          {(role === "owner" || role === "manager") && (
            <button
              onClick={() => triggerForm()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-3.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Catalog New Item</span>
            </button>
          )}
        </div>
      </div>

      {/* Main catalog view */}
      <div className="bg-[#0a1128]/50 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.01] text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Item Code</th>
                <th className="py-3 px-4">Name Specification</th>
                <th className="py-3 px-4">Unit Quote</th>
                <th className="py-3 px-4">Brief Notes</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    Syncing Item registers in real-time...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-550 text-slate-500">
                    No item specifications index found matching search guidelines.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.itemId} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-mono text-cyan-400 font-bold">{item.itemCode}</td>
                    <td className="py-3 px-4 font-medium text-white">{item.itemName}</td>
                    <td className="py-3 px-4">
                      <span className="bg-white/5 px-2 py-0.5 rounded border border-white/10 font-mono text-indigo-300">
                        {item.unit}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 truncate max-w-xs" title={item.description}>
                      {item.description || "N/A"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setViewingItem(item)}
                          className="p-1.5 border border-white/5 hover:border-white/15 bg-white/[0.02] hover:bg-white/[0.05] text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                          title="View Ledger Detail"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {(role === "owner" || role === "manager") && (
                          <>
                            <button
                              onClick={() => triggerForm(item)}
                              className="p-1.5 border border-white/5 hover:border-indigo-500/35 bg-white/[0.02] hover:bg-indigo-500/10 text-slate-300 hover:text-indigo-400 rounded-lg transition-colors cursor-pointer"
                              title="Modify Properties"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => toggleDelete(item)}
                              className={`p-1.5 border border-white/5 rounded-lg transition-colors cursor-pointer ${
                                item.isDeleted
                                  ? "hover:border-emerald-500/35 hover:bg-emerald-500/10 text-emerald-400"
                                  : "hover:border-red-500/35 hover:bg-red-500/10 text-red-400"
                              }`}
                              title={item.isDeleted ? "Restore item" : "Archive item"}
                            >
                              {item.isDeleted ? <RotateCcw className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
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

      {/* Catalog Entry / Editing Form Modal */}
      {isOpenForm && (
        <div className="fixed inset-0 bg-[#060a1d]/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b122c] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-indigo-400" />
              {editingItem ? "Modify Catalog Item Properties" : "Register Catalog Item Specification"}
            </h3>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Item Title Spec</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Polyester Yarn, 150 Denier"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500/55"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">SKU / Code ID</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., PLY-150D"
                    value={itemCode}
                    onChange={(e) => setItemCode(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white uppercase focus:outline-none focus:border-indigo-500/55"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Unit Quote</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="Kg" className="bg-[#0c1128]">Kg (Kilograms)</option>
                    <option value="Mtr" className="bg-[#0c1128]">Mtr (Meters)</option>
                    <option value="Pcs" className="bg-[#0c1128]">Pcs (Pieces)</option>
                    <option value="Ltr" className="bg-[#0c1128]">Ltr (Liters)</option>
                    <option value="Box" className="bg-[#0c1128]">Box (Packages)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Brief Description Details</label>
                <textarea
                  rows={3}
                  placeholder="Insert chemical composite details, processing parameters, warp/weft specifics..."
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
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-5 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Viewing details Dialog */}
      {viewingItem && (
        <div className="fixed inset-0 bg-[#060a1d]/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b122c] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-cyan-400" />
              Item Spec ledger audit
            </h3>

            <div className="space-y-3.5 text-xs text-slate-300 font-mono">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Item Index Key</span>
                <span className="text-white text-right">{viewingItem.itemId}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Unification Code</span>
                <span className="text-cyan-400 font-bold text-right">{viewingItem.itemCode}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">General Desc Title</span>
                <span className="text-white font-sans font-bold text-right">{viewingItem.itemName}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Billing Measurement Unit</span>
                <span className="text-white text-right bg-white/5 px-2 rounded border border-white/10">{viewingItem.unit}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 block">Description Summary Ledger:</span>
                <div className="bg-white/[0.02] border border-white/5 p-3 rounded-xl font-sans text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {viewingItem.description || "No customized notes recorded."}
                </div>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Status Register</span>
                <span className={`font-bold ${viewingItem.isDeleted ? "text-red-400" : "text-emerald-400"}`}>
                  {viewingItem.isDeleted ? "Archived Logs Only" : "Fully Active In Production"}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewingItem(null)}
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
