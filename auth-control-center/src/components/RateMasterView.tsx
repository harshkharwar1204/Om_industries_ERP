import React, { useState, useEffect } from "react";
import { collection, onSnapshot, setDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError } from "../firebase";
import { Rate, Party, Item, Shade, OperationType } from "../types";
import { Search, Plus, Edit2, Eye, Trash2, RotateCcw, Wallet, AlertCircle } from "lucide-react";

interface RateMasterViewProps {
  role: string;
}

export const RateMasterView: React.FC<RateMasterViewProps> = ({ role }) => {
  const [rates, setRates] = useState<Rate[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [shades, setShades] = useState<Shade[]>([]);
  
  const [search, setSearch] = useState("");
  const [showSoftDeleted, setShowSoftDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [editingRate, setEditingRate] = useState<Rate | null>(null);

  // Inputs
  const [partyId, setPartyId] = useState("");
  const [itemId, setItemId] = useState("");
  const [shadeId, setShadeId] = useState("none");
  const [rateVal, setRateVal] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");

  // Viewing
  const [viewingRate, setViewingRate] = useState<Rate | null>(null);

  useEffect(() => {
    setLoading(true);
    
    // Subscribe Rates
    const unsubRates = onSnapshot(collection(db, "rates"), (snap) => {
      const list: Rate[] = [];
      snap.forEach((docSnap) => {
        list.push(docSnap.data() as Rate);
      });
      setRates(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, "rates"));

    // Subscribe Parties
    const unsubParties = onSnapshot(collection(db, "parties"), (snap) => {
      const list: Party[] = [];
      snap.forEach((docSnap) => {
        list.push(docSnap.data() as Party);
      });
      setParties(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, "parties"));

    // Subscribe Items
    const unsubItems = onSnapshot(collection(db, "items"), (snap) => {
      const list: Item[] = [];
      snap.forEach((docSnap) => {
        list.push(docSnap.data() as Item);
      });
      setItems(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, "items"));

    // Subscribe Shades
    const unsubShades = onSnapshot(collection(db, "shades"), (snap) => {
      const list: Shade[] = [];
      snap.forEach((docSnap) => {
        list.push(docSnap.data() as Shade);
      });
      setShades(list);
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, "shades"));

    return () => {
      unsubRates();
      unsubParties();
      unsubItems();
      unsubShades();
    };
  }, []);

  const triggerForm = (rateObj: Rate | null = null) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (rateObj) {
      setEditingRate(rateObj);
      setPartyId(rateObj.partyId);
      setItemId(rateObj.itemId);
      setShadeId(rateObj.shadeId || "none");
      setRateVal(String(rateObj.rate));
      setEffectiveDate(rateObj.effectiveDate);
    } else {
      setEditingRate(null);
      setPartyId(parties[0]?.partyId || "");
      setItemId(items[0]?.itemId || "");
      setShadeId("none");
      setRateVal("");
      // Default to today
      const today = new Date().toISOString().split("T")[0];
      setEffectiveDate(today);
    }
    setIsOpenForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const parsedRate = parseFloat(rateVal);
    if (isNaN(parsedRate) || parsedRate <= 0) {
      setErrorMsg("Rate price quotes must be valid numbers greater than zero.");
      return;
    }

    if (!partyId || !itemId) {
      setErrorMsg("Please select a valid Party and Item Master profile first.");
      return;
    }

    try {
      const isNew = !editingRate;
      const rateId = isNew ? "RAT-" + Math.random().toString(36).substr(2, 9).toUpperCase() : editingRate!.rateId;
      const docRef = doc(db, "rates", rateId);

      const payload = {
        rateId,
        partyId,
        itemId,
        shadeId,
        rate: parsedRate,
        effectiveDate: effectiveDate || new Date().toISOString().split("T")[0],
        isDeleted: isNew ? false : editingRate!.isDeleted,
        updatedAt: serverTimestamp(),
        ...(isNew ? { createdAt: serverTimestamp() } : { createdAt: editingRate!.createdAt })
      };

      await setDoc(docRef, payload);
      setSuccessMsg(`Billing quote profile saved successfully.`);
      setIsOpenForm(false);
    } catch (err) {
      setErrorMsg("Failed to capture billing rate structure.");
      handleFirestoreError(err, editingRate ? OperationType.UPDATE : OperationType.CREATE, "rates");
    }
  };

  const toggleDelete = async (rateObj: Rate) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const docRef = doc(db, "rates", rateObj.rateId);
      await updateDoc(docRef, {
        isDeleted: !rateObj.isDeleted,
        updatedAt: serverTimestamp()
      });
      setSuccessMsg(`Billing quote was successfully ${rateObj.isDeleted ? "restored to active log" : "archived"}.`);
    } catch (err) {
      setErrorMsg("Could not change archival state.");
      handleFirestoreError(err, OperationType.UPDATE, `rates/${rateObj.rateId}`);
    }
  };

  // Helper Resolution Methods
  const getPartyName = (id: string) => {
    const p = parties.find((party) => party.partyId === id);
    return p ? p.partyName : `Unknown Party [${id}]`;
  };

  const getItemName = (id: string) => {
    const i = items.find((item) => item.itemId === id);
    return i ? `${i.itemName} (${i.itemCode})` : `Unknown Item [${id}]`;
  };

  const getShadeName = (id: string) => {
    if (id === "none") return "General / Any Color";
    const s = shades.find((shade) => shade.shadeId === id);
    return s ? `${s.shadeName} (${s.shadeCode})` : `Unknown Shade [${id}]`;
  };

  // Filter & Search Rates
  const filteredRates = rates.filter((r) => {
    const pName = getPartyName(r.partyId).toLowerCase();
    const iName = getItemName(r.itemId).toLowerCase();
    const sName = getShadeName(r.shadeId).toLowerCase();
    const matchesSearch =
      pName.includes(search.toLowerCase()) ||
      iName.includes(search.toLowerCase()) ||
      sName.includes(search.toLowerCase());
    
    const matchesDelete = showSoftDeleted ? r.isDeleted : !r.isDeleted;
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

      {/* Control Panel */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white/[0.02] border border-white/5 rounded-2xl p-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search quotes by party, product name, shade..."
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
              <span>Catalog New Rate</span>
            </button>
          )}
        </div>
      </div>

      {/* Pricing list layout */}
      <div className="bg-[#0a1128]/50 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.012] text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Billing Party</th>
                <th className="py-3 px-4">Material / Product Product Spec</th>
                <th className="py-3 px-4">Design Shade</th>
                <th className="py-3 px-4 font-mono text-right">Price Rate</th>
                <th className="py-3 px-4 text-center">Effectivity Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    Syncing customized corporate rates lists...
                  </td>
                </tr>
              ) : filteredRates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500 font-sans text-slate-550">
                    No custom rates registered in ledger. Try adding item prices!
                  </td>
                </tr>
              ) : (
                filteredRates.map((rt) => (
                  <tr key={rt.rateId} className="hover:bg-white/[0.015] transition-colors">
                    <td className="py-3 px-4 font-semibold text-white">{getPartyName(rt.partyId)}</td>
                    <td className="py-3 px-4 text-indigo-200">{getItemName(rt.itemId)}</td>
                    <td className="py-3 px-4 text-cyan-400 font-mono text-[11px]">{getShadeName(rt.shadeId)}</td>
                    <td className="py-3 px-4 font-mono font-black text-right text-emerald-400 text-sm">${rt.rate.toFixed(2)}</td>
                    <td className="py-3 px-4 text-center font-mono text-slate-450 text-[10px]">{rt.effectiveDate || "Today"}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setViewingRate(rt)}
                          className="p-1.5 border border-white/5 bg-white/[0.012] hover:bg-white/[0.04] rounded-lg text-slate-300 cursor-pointer"
                          title="View Audit details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {(role === "owner" || role === "manager") && (
                          <>
                            <button
                              onClick={() => triggerForm(rt)}
                              className="p-1.5 border border-white/5 bg-white/[0.012] hover:border-indigo-500/25 text-slate-300 hover:text-indigo-400 rounded-lg cursor-pointer"
                              title="Modify properties"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => toggleDelete(rt)}
                              className={`p-1.5 border border-white/5 rounded-lg cursor-pointer ${
                                rt.isDeleted
                                  ? "hover:border-emerald-500/20 hover:bg-emerald-500/10 text-emerald-400"
                                  : "hover:border-red-500/20 hover:bg-red-500/10 text-red-400"
                              }`}
                              title={rt.isDeleted ? "Unarchive record" : "Archive rate record"}
                            >
                              {rt.isDeleted ? <RotateCcw className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
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

      {/* Editing dialog modal */}
      {isOpenForm && (
        <div className="fixed inset-0 bg-[#060a1d]/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b122c] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Wallet className="w-4 h-4 text-indigo-400" />
              {editingRate ? "Update Specialized Custom Price" : "Register Custom Pricing Quote"}
            </h3>

            {parties.length === 0 || items.length === 0 ? (
              <div className="text-center p-5 space-y-2 border border-white/5 bg-white/[0.015] rounded-xl text-slate-400 text-xs text-slate-550 leading-relaxed">
                You must registers <strong>Parties</strong> and <strong>Items</strong> in Masters catalog first prior to writing specialized rate cards.
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Trading Party</label>
                  <select
                    value={partyId}
                    onChange={(e) => setPartyId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    {parties.filter(p => !p.isDeleted).map((p) => (
                      <option key={p.partyId} value={p.partyId} className="bg-[#0c1128] text-white">
                        {p.partyName} ({p.city})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Indexed Product Spec (Item)</label>
                  <select
                    value={itemId}
                    onChange={(e) => setItemId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    {items.filter(i => !i.isDeleted).map((i) => (
                      <option key={i.itemId} value={i.itemId} className="bg-[#0c1128] text-white">
                        {i.itemName} &bull; Code: {i.itemCode}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Design Shade Recipe (Optional)</label>
                  <select
                    value={shadeId}
                    onChange={(e) => setShadeId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="none" className="bg-[#0c1128]">General / No Specific Color Tone</option>
                    {shades.filter(s => !s.isDeleted).map((s) => (
                      <option key={s.shadeId} value={s.shadeId} className="bg-[#0c1128] text-white">
                        {s.shadeName} &bull; {s.shadeCode}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Max Unit Rate Quote ($)</label>
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="e.g., 25.50"
                      value={rateVal}
                      onChange={(e) => setRateVal(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Effective start Date</label>
                    <input
                      type="date"
                      required
                      value={effectiveDate}
                      onChange={(e) => setEffectiveDate(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-[11px] text-white focus:outline-none cursor-pointer"
                    />
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
            )}
          </div>
        </div>
      )}

      {/* Viewing Details dialog */}
      {viewingRate && (
        <div className="fixed inset-0 bg-[#060a1d]/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b122c] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Wallet className="w-4 h-4 text-cyan-400" />
              Specialized quote audit datasheet
            </h3>

            <div className="space-y-3.5 text-xs text-slate-300 font-mono">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Rate Registry UID</span>
                <span className="text-white text-right">{viewingRate.rateId}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Associated Client Party</span>
                <span className="text-white font-sans font-bold text-right">{getPartyName(viewingRate.partyId)}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500 font-bold">Product Item Node</span>
                <span className="text-cyan-400 font-bold text-right">{getItemName(viewingRate.itemId)}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Color Tone Shade reference</span>
                <span className="text-white font-bold text-right font-sans">{getShadeName(viewingRate.shadeId)}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2 text-sm">
                <span className="text-slate-500">Agreed Unit billing rate</span>
                <span className="text-emerald-400 font-extrabold text-right font-mono">${viewingRate.rate.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2 font-mono text-[10px]">
                <span className="text-slate-500">Effective Date Start</span>
                <span className="text-indigo-300 text-right">{viewingRate.effectiveDate || "N/A"}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Registry Active status</span>
                <span className={`font-bold ${viewingRate.isDeleted ? "text-red-400" : "text-emerald-400"}`}>
                  {viewingRate.isDeleted ? "Soft Archived Out of Billing Cycle" : "Active agreed billing rules"}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewingRate(null)}
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
