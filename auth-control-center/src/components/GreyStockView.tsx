import React, { useState, useEffect } from "react";
import { collection, onSnapshot, setDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError } from "../firebase";
import { GreyStock, Party, PartyOrder, Item, OperationType } from "../types";
import { Search, Plus, Edit2, Eye, Trash2, RotateCcw, Box, Calendar, User, ShoppingBag, Layers, AlertCircle, FileText, ChevronRight, Check } from "lucide-react";

interface GreyStockViewProps {
  role: string;
}

export const GreyStockView: React.FC<GreyStockViewProps> = ({ role }) => {
  const [greyStocks, setGreyStocks] = useState<GreyStock[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [orders, setOrders] = useState<PartyOrder[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  const [search, setSearch] = useState("");
  const [showSoftDeleted, setShowSoftDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form modal states
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [editingStock, setEditingStock] = useState<GreyStock | null>(null);

  // Input states
  const [date, setDate] = useState("");
  const [challanNo, setChallanNo] = useState("");
  const [partyId, setPartyId] = useState("");
  const [orderId, setOrderId] = useState("none"); // "none" or specific ORD-XXX ID
  const [itemId, setItemId] = useState("");
  const [count, setCount] = useState("");
  const [receivedQtyKg, setReceivedQtyKg] = useState("");
  const [conesBags, setConesBags] = useState("");

  // Viewing modal state
  const [viewingStock, setViewingStock] = useState<GreyStock | null>(null);

  // Load backend data realtime
  useEffect(() => {
    setLoading(true);

    // 1. Grey Stocks
    const unsubscribeGrey = onSnapshot(
      collection(db, "grey_stocks"),
      (snap) => {
        const list: GreyStock[] = [];
        snap.forEach((docSnap) => {
          list.push(docSnap.data() as GreyStock);
        });
        setGreyStocks(list);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, "grey_stocks");
      }
    );

    // 2. Parties
    const unsubscribeParties = onSnapshot(
      collection(db, "parties"),
      (snap) => {
        const list: Party[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as Party;
          if (!data.isDeleted) {
            list.push(data);
          }
        });
        setParties(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "parties");
      }
    );

    // 3. Orders
    const unsubscribeOrders = onSnapshot(
      collection(db, "party_orders"),
      (snap) => {
        const list: PartyOrder[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as PartyOrder;
          if (!data.isDeleted) {
            list.push(data);
          }
        });
        setOrders(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "party_orders");
      }
    );

    // 4. Items
    const unsubscribeItems = onSnapshot(
      collection(db, "items"),
      (snap) => {
        const list: Item[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as Item;
          if (!data.isDeleted) {
            list.push(data);
          }
        });
        setItems(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "items");
      }
    );

    return () => {
      unsubscribeGrey();
      unsubscribeParties();
      unsubscribeOrders();
      unsubscribeItems();
    };
  }, []);

  // Set default form values based on linked Order
  useEffect(() => {
    if (orderId !== "none" && !editingStock) {
      const selectedOrder = orders.find((o) => o.orderId === orderId);
      if (selectedOrder) {
        setPartyId(selectedOrder.partyId);
        setItemId(selectedOrder.itemId);
        setCount(selectedOrder.count);
      }
    }
  }, [orderId, orders, editingStock]);

  const generateNextLotId = () => {
    let maxNum = 0;
    greyStocks.forEach((g) => {
      const match = g.lotId.match(/^L-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    const nextNum = maxNum + 1;
    return "L-" + String(nextNum).padStart(3, "0");
  };

  const triggerForm = (stock: GreyStock | null = null) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (stock) {
      setEditingStock(stock);
      setDate(stock.date);
      setChallanNo(stock.challanNo);
      setPartyId(stock.partyId);
      setOrderId(stock.orderId);
      setItemId(stock.itemId);
      setCount(stock.count);
      setReceivedQtyKg(stock.receivedQtyKg.toString());
      setConesBags(stock.conesBags.toString());
    } else {
      setEditingStock(null);
      setDate(new Date().toISOString().split("T")[0]);
      setChallanNo("");
      setPartyId(parties[0]?.partyId || "");
      setOrderId("none");
      setItemId(items[0]?.itemId || "");
      setCount("");
      setReceivedQtyKg("");
      setConesBags("");
    }
    setIsOpenForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const activeParty = parties.find((p) => p.partyId === partyId);
    const activeItem = items.find((i) => i.itemId === itemId);
    const numericQty = parseFloat(receivedQtyKg);
    const numericCones = parseInt(conesBags, 10);

    if (!partyId || !itemId) {
      setErrorMsg("Please define active Party and Item Master directories in the system first.");
      return;
    }

    if (!date || !challanNo.trim() || !count.trim()) {
      setErrorMsg("Date, Challan No, and Count details cannot be empty.");
      return;
    }

    if (isNaN(numericQty) || numericQty <= 0) {
      setErrorMsg("Received Weight (Qty Kg) must be a positive number.");
      return;
    }

    if (isNaN(numericCones) || numericCones < 0) {
      setErrorMsg("Cones Bags must be a non-negative integer count.");
      return;
    }

    try {
      const isNew = !editingStock;
      const lotId = isNew ? generateNextLotId() : editingStock!.lotId;
      const docRef = doc(db, "grey_stocks", lotId);

      const payload: GreyStock = {
        lotId,
        date,
        challanNo: challanNo.trim().toUpperCase(),
        partyId,
        partyName: activeParty?.partyName || "Unknown Party",
        orderId,
        itemId,
        itemName: activeItem?.itemName || "Unknown Item",
        count: count.trim(),
        receivedQtyKg: numericQty,
        conesBags: numericCones,
        isDeleted: isNew ? false : editingStock!.isDeleted,
        updatedAt: serverTimestamp(),
        createdAt: isNew ? serverTimestamp() : editingStock!.createdAt
      };

      await setDoc(docRef, payload);
      setSuccessMsg(`Grey Stock Lot ${lotId} cataloged successfully for "${payload.partyName}".`);
      setIsOpenForm(false);
    } catch (err) {
      setErrorMsg("Failed to upload Grey Stock entry to databases.");
      handleFirestoreError(err, editingStock ? OperationType.UPDATE : OperationType.CREATE, "grey_stocks");
    }
  };

  const toggleSoftDelete = async (stock: GreyStock) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const docRef = doc(db, "grey_stocks", stock.lotId);
      await updateDoc(docRef, {
        isDeleted: !stock.isDeleted,
        updatedAt: serverTimestamp()
      });
      setSuccessMsg(`Grey Stock Lot "${stock.lotId}" has been successfully ${stock.isDeleted ? "restored and re-cataloged" : "archived"}.`);
    } catch (err) {
      setErrorMsg("Database archive state toggle could not resolve.");
      handleFirestoreError(err, OperationType.UPDATE, `grey_stocks/${stock.lotId}`);
    }
  };

  const filteredStocks = greyStocks.filter((g) => {
    const term = search.toLowerCase();
    const matchesSearch =
      g.lotId.toLowerCase().includes(term) ||
      g.challanNo.toLowerCase().includes(term) ||
      g.partyName.toLowerCase().includes(term) ||
      g.itemName.toLowerCase().includes(term) ||
      g.count.toLowerCase().includes(term) ||
      (g.orderId !== "none" && g.orderId.toLowerCase().includes(term));

    const matchesDelete = showSoftDeleted ? g.isDeleted : !g.isDeleted;
    return matchesSearch && matchesDelete;
  });

  return (
    <div className="space-y-5 font-sans">
      {/* Alert Messages banner */}
      {(successMsg || errorMsg) && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs ${
          successMsg ? "bg-[#10b981]/10 border-[#10b981]/25 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-500"
        }`}>
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg || errorMsg}</span>
        </div>
      )}

      {/* Control Tools Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white/[0.02] border border-white/5 rounded-2xl p-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search grey stocks by Lot, Challan, Party, Item, Count, Order..."
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
            <span>Show Archival Folders</span>
          </label>

          {(role === "owner" || role === "manager") && (
            <button
              onClick={() => triggerForm()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-3.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Inward Grey Stock Lot</span>
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
                <th className="py-3 px-4">Lot Number</th>
                <th className="py-3 px-4">Inward Date</th>
                <th className="py-3 px-4">Challan reference</th>
                <th className="py-3 px-4">Client Party</th>
                <th className="py-3 px-4">Associated Order</th>
                <th className="py-3 px-4">Item Product</th>
                <th className="py-3 px-4">Count Specs</th>
                <th className="py-3 px-4 text-right">Received Qty (Kg)</th>
                <th className="py-3 px-4 text-right">Cones / Bags</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-500 font-mono">
                    Syncing Grey Stocks databases master registries...
                  </td>
                </tr>
              ) : filteredStocks.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-500">
                    No active grey stocks matched filter inputs query.
                  </td>
                </tr>
              ) : (
                filteredStocks.map((g) => (
                  <tr key={g.lotId} className="hover:bg-white/[0.018] transition-colors">
                    <td className="py-3 px-4 font-mono text-cyan-400 font-bold">{g.lotId}</td>
                    <td className="py-3 px-4 font-mono text-slate-400">{g.date}</td>
                    <td className="py-3 px-4 font-mono text-indigo-300 font-bold">{g.challanNo}</td>
                    <td className="py-3 px-4 font-medium text-white max-w-xs truncate" title={g.partyName}>{g.partyName}</td>
                    <td className="py-3 px-4">
                      {g.orderId === "none" ? (
                        <span className="text-slate-500 italic text-[11px]">Direct Inward</span>
                      ) : (
                        <span className="font-mono text-indigo-400 font-bold text-[11px] bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/10">
                          {g.orderId}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-300 max-w-xs truncate" title={g.itemName}>{g.itemName}</td>
                    <td className="py-3 px-4 font-mono text-amber-400 text-[11px]">{g.count}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-white">
                      {g.receivedQtyKg.toLocaleString(undefined, { minimumFractionDigits: 1 })} Kg
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-indigo-300">
                      {g.conesBags.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewingStock(g)}
                          className="p-1.5 border border-white/5 bg-white/[0.012] hover:bg-white/[0.05] rounded-l-lg rounded-r-lg text-slate-300 transition-colors cursor-pointer"
                          title="Lot details check"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {(role === "owner" || role === "manager") && (
                          <>
                            <button
                              onClick={() => triggerForm(g)}
                              className="p-1.5 border border-white/5 hover:border-indigo-500/35 bg-white/[0.012] hover:bg-indigo-500/10 text-slate-300 hover:text-indigo-400 rounded-lg transition-colors cursor-pointer"
                              title="Modify lot data"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => toggleSoftDelete(g)}
                              className={`p-1.5 border border-white/5 rounded-lg transition-colors cursor-pointer ${
                                g.isDeleted
                                  ? "hover:border-emerald-500/35 hover:bg-emerald-500/10 text-emerald-400"
                                  : "hover:border-red-500/35 hover:bg-red-500/10 text-red-400"
                              }`}
                              title={g.isDeleted ? "Unarchive Lot" : "Soft Archive Lot"}
                            >
                              {g.isDeleted ? <RotateCcw className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
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

      {/* Save Modal Form */}
      {isOpenForm && (
        <div className="fixed inset-0 bg-[#060a1d]/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b122c] border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Box className="w-4 h-4 text-indigo-400" />
              {editingStock ? "Modify Grey Stock Lot specifications" : "Record Inward Grey Stock Lot"}
            </h3>

            {parties.length === 0 || items.length === 0 ? (
              <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl text-center text-xs text-amber-400 space-y-2">
                <p>Dependency directories are blank! Please generate at least one Party and Item in database first.</p>
                <button
                  type="button"
                  onClick={() => setIsOpenForm(false)}
                  className="bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-lg text-white"
                >
                  Close Window
                </button>
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-4 text-xs">
                {/* 1. Date & Challan No */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Inward Received Date</label>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Challan reference Number</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CH-2345"
                      value={challanNo}
                      onChange={(e) => setChallanNo(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white uppercase focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                </div>

                {/* 2. Associated Order Link */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Link to Party Order Reference (Optional)</label>
                  <select
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="none" className="bg-[#0b122c]">
                      None / Direct Inward Stock
                    </option>
                    {orders.map((o) => (
                      <option key={o.orderId} value={o.orderId} className="bg-[#0b122c]">
                        {o.orderId} - PO: {o.poNumber} | {o.partyName} ({o.itemName})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Party Selector */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Legal Supplier / client Party</label>
                  <select
                    value={partyId}
                    onChange={(e) => setPartyId(e.target.value)}
                    required
                    disabled={orderId !== "none"}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400 disabled:opacity-50 cursor-pointer"
                  >
                    {parties.map((p) => (
                      <option key={p.partyId} value={p.partyId} className="bg-[#0b122c]">
                        {p.partyName} ({p.city})
                      </option>
                    ))}
                  </select>
                  {orderId !== "none" && (
                    <p className="text-[10px] text-slate-500 italic mt-0.5">Note: Derived automatically from selected Party Order.</p>
                  )}
                </div>

                {/* 4. Item and Count Specs */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Yarn Product catalog</label>
                    <select
                      value={itemId}
                      onChange={(e) => setItemId(e.target.value)}
                      required
                      disabled={orderId !== "none"}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400 disabled:opacity-50 cursor-pointer"
                    >
                      {items.map((i) => (
                        <option key={i.itemId} value={i.itemId} className="bg-[#0b122c]">
                          {i.itemName} ({i.itemCode})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Yarn Count Specifications</label>
                    <input
                      type="text"
                      required
                      disabled={orderId !== "none"}
                      placeholder="e.g. 2/40s Ne"
                      value={count}
                      onChange={(e) => setCount(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400 disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* 5. Received Kg & Cones Bags */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Received Qty (Kg)</label>
                    <input
                      type="number"
                      required
                      step="any"
                      min="0.1"
                      placeholder="e.g. 1000.5"
                      value={receivedQtyKg}
                      onChange={(e) => setReceivedQtyKg(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cones Bags Count</label>
                    <input
                      type="number"
                      required
                      min="0"
                      placeholder="e.g. 40"
                      value={conesBags}
                      onChange={(e) => setConesBags(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                </div>

                {/* Form Action Controls */}
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
                    Save Grey Stock Entry
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Detailed view design */}
      {viewingStock && (
        <div className="fixed inset-0 bg-[#060a1d]/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b122c] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-3">
              <Box className="w-4 h-4 text-cyan-400" />
              Grey Stock Lot Receipt Audit Card
            </h3>

            <div className="space-y-3 text-xs font-mono text-slate-300">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Auto Generated Lot Number</span>
                <span className="text-cyan-400 font-bold">{viewingStock.lotId}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Inward Date Logged</span>
                <span className="text-white">{viewingStock.date}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Reference Challan No</span>
                <span className="text-white">{viewingStock.challanNo}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Linked Client Party Name</span>
                <span className="text-white font-sans font-semibold text-right max-w-[210px] truncate" title={viewingStock.partyName}>
                  {viewingStock.partyName}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Associated Order reference</span>
                <span className="text-white">
                  {viewingStock.orderId === "none" ? (
                    <span className="text-slate-550 italic font-sans text-xs">Direct/Independent</span>
                  ) : (
                    <span className="text-indigo-300 font-bold">{viewingStock.orderId}</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Item Name Spec</span>
                <span className="text-white font-sans font-semibold text-right max-w-[210px] truncate" title={viewingStock.itemName}>
                  {viewingStock.itemName}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Yarn Count Specification</span>
                <span className="text-amber-400">{viewingStock.count}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Certified Received Qty (Kg)</span>
                <span className="text-emerald-400 font-extrabold">{viewingStock.receivedQtyKg.toLocaleString()} Kg</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Cones / Bags packaged units</span>
                <span className="text-indigo-300 font-bold">{viewingStock.conesBags.toLocaleString()} Units</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">Current Archive State</span>
                <span className={`font-bold ${viewingStock.isDeleted ? "text-red-400 animate-pulse" : "text-emerald-400"}`}>
                  {viewingStock.isDeleted ? "SOFT ARCHIVED" : "ACTIVE ON-DUTY"}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setViewingStock(null)}
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
