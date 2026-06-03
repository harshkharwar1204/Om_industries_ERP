import React, { useState, useEffect } from "react";
import { collection, onSnapshot, setDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError } from "../firebase";
import { Party, OperationType } from "../types";
import { Search, Plus, Edit2, Eye, Trash2, RotateCcw, Building2, AlertCircle } from "lucide-react";

interface PartyMasterViewProps {
  role: string;
}

export const PartyMasterView: React.FC<PartyMasterViewProps> = ({ role }) => {
  const [parties, setParties] = useState<Party[]>([]);
  const [search, setSearch] = useState("");
  const [showSoftDeleted, setShowSoftDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);

  // Inputs
  const [partyName, setPartyName] = useState("");
  const [mobile, setMobile] = useState("");
  const [city, setCity] = useState("");
  const [gst, setGst] = useState("");
  const [address, setAddress] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("Net 30");

  // Viewing
  const [viewingParty, setViewingParty] = useState<Party | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, "parties"),
      (snap) => {
        const list: Party[] = [];
        snap.forEach((docSnap) => {
          list.push(docSnap.data() as Party);
        });
        setParties(list);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, "parties");
      }
    );
    return () => unsubscribe();
  }, []);

  const triggerForm = (party: Party | null = null) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (party) {
      setEditingParty(party);
      setPartyName(party.partyName);
      setMobile(party.mobile);
      setCity(party.city);
      setGst(party.gst || "");
      setAddress(party.address);
      setPaymentTerms(party.paymentTerms);
    } else {
      setEditingParty(null);
      setPartyName("");
      setMobile("");
      setCity("");
      setGst("");
      setAddress("");
      setPaymentTerms("Net 30");
    }
    setIsOpenForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!partyName.trim() || !mobile.trim() || !city.trim() || !address.trim()) {
      setErrorMsg("Party Name, Mobile, City, and Address are required.");
      return;
    }

    try {
      const isNew = !editingParty;
      const partyId = isNew ? "PRT-" + Math.random().toString(36).substr(2, 9).toUpperCase() : editingParty!.partyId;
      const docRef = doc(db, "parties", partyId);

      const payload = {
        partyId,
        partyName: partyName.trim(),
        mobile: mobile.trim(),
        city: city.trim(),
        gst: gst.trim() || "N/A",
        address: address.trim(),
        paymentTerms,
        isDeleted: isNew ? false : editingParty!.isDeleted,
        updatedAt: serverTimestamp(),
        ...(isNew ? { createdAt: serverTimestamp() } : { createdAt: editingParty!.createdAt })
      };

      await setDoc(docRef, payload);
      setSuccessMsg(`Party "${partyName.trim()}" successfully registered.`);
      setIsOpenForm(false);
    } catch (err) {
      setErrorMsg("Failed to capture master group entry.");
      handleFirestoreError(err, editingParty ? OperationType.UPDATE : OperationType.CREATE, "parties");
    }
  };

  const toggleDelete = async (party: Party) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const docRef = doc(db, "parties", party.partyId);
      await updateDoc(docRef, {
        isDeleted: !party.isDeleted,
        updatedAt: serverTimestamp()
      });
      setSuccessMsg(`Party "${party.partyName}" was successfully ${party.isDeleted ? "restored to active directory" : "soft deleted"}.`);
    } catch (err) {
      setErrorMsg("Deletion failed.");
      handleFirestoreError(err, OperationType.UPDATE, `parties/${party.partyId}`);
    }
  };

  const filteredParties = parties.filter((p) => {
    const matchesSearch =
      p.partyName.toLowerCase().includes(search.toLowerCase()) ||
      p.city.toLowerCase().includes(search.toLowerCase()) ||
      p.mobile.includes(search);
    const matchesDelete = showSoftDeleted ? p.isDeleted : !p.isDeleted;
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
            placeholder="Search parties by name, city, contact..."
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
              <span>Catalog New Party</span>
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
                <th className="py-3 px-4">Party ID</th>
                <th className="py-3 px-4">Entity Legal Name</th>
                <th className="py-3 px-4">General Location (City)</th>
                <th className="py-3 px-4">Contact Phone</th>
                <th className="py-3 px-4">GST Number</th>
                <th className="py-3 px-4">Credit Terms</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    Syncing Parties indexes...
                  </td>
                </tr>
              ) : filteredParties.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500 font-sans text-slate-550">
                    No active corporate parties indexed matching catalog search.
                  </td>
                </tr>
              ) : (
                filteredParties.map((p) => (
                  <tr key={p.partyId} className="hover:bg-white/[0.015] transition-colors">
                    <td className="py-3 px-4 font-mono text-cyan-400 font-bold">{p.partyId}</td>
                    <td className="py-3 px-4 font-medium text-white">{p.partyName}</td>
                    <td className="py-3 px-4 text-slate-400">{p.city}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-indigo-300">{p.mobile}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-450 text-slate-450 text-slate-400">{p.gst || "N/A"}</td>
                    <td className="py-3 px-4">
                      <span className="bg-white/5 border border-white/10 px-2.5 py-0.5 rounded text-[10px] text-indigo-300 font-bold">
                        {p.paymentTerms}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setViewingParty(p)}
                          className="p-1.5 border border-white/5 bg-white/[0.012] hover:bg-white/[0.04] rounded-lg text-slate-300 cursor-pointer"
                          title="Review Profile Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {(role === "owner" || role === "manager") && (
                          <>
                            <button
                              onClick={() => triggerForm(p)}
                              className="p-1.5 border border-white/5 bg-white/[0.012] hover:border-indigo-500/25 text-slate-300 hover:text-indigo-400 rounded-lg cursor-pointer"
                              title="Modify Profile Properties"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => toggleDelete(p)}
                              className={`p-1.5 border border-white/5 rounded-lg cursor-pointer ${
                                p.isDeleted
                                  ? "hover:border-emerald-500/20 hover:bg-emerald-500/10 text-emerald-400"
                                  : "hover:border-red-500/20 hover:bg-red-500/10 text-red-400"
                              }`}
                              title={p.isDeleted ? "Unarchive party" : "Archive party"}
                            >
                              {p.isDeleted ? <RotateCcw className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
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

      {/* Form modal */}
      {isOpenForm && (
        <div className="fixed inset-0 bg-[#060a1d]/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b122c] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-400" />
              {editingParty ? "Modify Corporate Party Profile" : "Register Corporate Trading Party"}
            </h3>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Party / Client Title Spec</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Acme Spinning Mills Ltd."
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Contact Phone</label>
                  <input
                    type="text"
                    required
                    placeholder="9012345678"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Region City</label>
                  <input
                    type="text"
                    required
                    placeholder="New Delhi"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">GST unique number</label>
                  <input
                    type="text"
                    placeholder="07AAAAA1111A1Z1"
                    value={gst}
                    onChange={(e) => setGst(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white uppercase focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Credit Allocation Terms</label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="Immediate" className="bg-[#0c1128]">Immediate COD</option>
                    <option value="Net 15" className="bg-[#0c1128]">Net 15 Days</option>
                    <option value="Net 30" className="bg-[#0c1128]">Net 30 Days</option>
                    <option value="Net 45" className="bg-[#0c1128]">Net 45 Days</option>
                    <option value="Net 60" className="bg-[#0c1128]">Net 60 Days</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Full Billing Postal Address</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Insert detailed street address, factory complex numbers, pincode..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
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
                  className="bg-indigo-655 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-5 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review details dialog */}
      {viewingParty && (
        <div className="fixed inset-0 bg-[#060a1d]/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b122c] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-cyan-400" />
              Party profile ledger datasheet
            </h3>

            <div className="space-y-3.5 text-xs text-slate-300 font-mono">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Party System Lookup ID</span>
                <span className="text-white text-right">{viewingParty.partyId}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Entity Legal Title</span>
                <span className="text-white font-sans font-bold text-right">{viewingParty.partyName}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Mobile Phone</span>
                <span className="text-cyan-400 text-right">{viewingParty.mobile}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Regional Depot City</span>
                <span className="text-white text-right font-sans">{viewingParty.city}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">GST Registration Tax No</span>
                <span className="text-indigo-300 text-right">{viewingParty.gst || "N/A"}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Corporate Credit terms</span>
                <span className="text-white text-right bg-white/5 px-2 py-0.5 rounded border border-white/10">{viewingParty.paymentTerms}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 block">Billing Postal Address:</span>
                <div className="bg-white/[0.02] border border-white/5 p-3 rounded-xl font-sans text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {viewingParty.address}
                </div>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Corporate Active status</span>
                <span className={`font-bold ${viewingParty.isDeleted ? "text-red-400" : "text-emerald-400"}`}>
                  {viewingParty.isDeleted ? "Soft Archived Out of Scope" : "Fully Active Operational Entity"}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewingParty(null)}
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
