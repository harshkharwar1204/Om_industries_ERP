import React, { useState, useEffect } from "react";
import { collection, onSnapshot, setDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError } from "../firebase";
import { PartyOrder, Party, Item, Shade, OperationType } from "../types";
import { Search, Plus, Edit2, Eye, Trash2, RotateCcw, ShoppingBag, Calendar, User, Tag, Layers, Star, Info, AlertCircle } from "lucide-react";

interface PartyOrderViewProps {
  role: string;
}

const PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;
const STATUSES = ["Pending", "Processing", "Completed", "Cancelled"] as const;

export const PartyOrderView: React.FC<PartyOrderViewProps> = ({ role }) => {
  const [orders, setOrders] = useState<PartyOrder[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [shades, setShades] = useState<Shade[]>([]);

  const [search, setSearch] = useState("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("All");
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>("All");
  const [showSoftDeleted, setShowSoftDeleted] = useState(false);
  const [loading, setLoading] = useState(true);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form Modal States
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PartyOrder | null>(null);

  // Input States
  const [partyId, setPartyId] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [itemId, setItemId] = useState("");
  const [count, setCount] = useState("");
  const [shadeId, setShadeId] = useState("");
  const [qtyKg, setQtyKg] = useState("");
  const [rate, setRate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [priority, setPriority] = useState<typeof PRIORITIES[number]>("Medium");
  const [status, setStatus] = useState<typeof STATUSES[number]>("Pending");

  // Viewing Detail State
  const [viewingOrder, setViewingOrder] = useState<PartyOrder | null>(null);

  // Load Realtime Data
  useEffect(() => {
    setLoading(true);

    // 1. Party Orders
    const unsubOrders = onSnapshot(
      collection(db, "party_orders"),
      (snap) => {
        const list: PartyOrder[] = [];
        snap.forEach((docSnap) => {
          list.push(docSnap.data() as PartyOrder);
        });
        setOrders(list);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, "party_orders");
      }
    );

    // 2. Parties
    const unsubParties = onSnapshot(
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

    // 3. Items
    const unsubItems = onSnapshot(
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

    // 4. Shades
    const unsubShades = onSnapshot(
      collection(db, "shades"),
      (snap) => {
        const list: Shade[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as Shade;
          if (!data.isDeleted) {
            list.push(data);
          }
        });
        setShades(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "shades");
      }
    );

    return () => {
      unsubOrders();
      unsubParties();
      unsubItems();
      unsubShades();
    };
  }, []);

  const generateNextOrderId = () => {
    let maxNum = 0;
    orders.forEach((o) => {
      const match = o.orderId.match(/^ORD-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    const nextNum = maxNum + 1;
    return "ORD-" + String(nextNum).padStart(4, "0");
  };

  const triggerForm = (order: PartyOrder | null = null) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (order) {
      setEditingOrder(order);
      setPartyId(order.partyId);
      setPoNumber(order.poNumber);
      setItemId(order.itemId);
      setCount(order.count);
      setShadeId(order.shadeId);
      setQtyKg(order.qtyKg.toString());
      setRate(order.rate.toString());
      setDeliveryDate(order.deliveryDate);
      setPriority(order.priority);
      setStatus(order.status);
    } else {
      setEditingOrder(null);
      // Select default party, item, shade if available
      setPartyId(parties[0]?.partyId || "");
      setPoNumber("");
      setItemId(items[0]?.itemId || "");
      setCount("");
      setShadeId(shades[0]?.shadeId || "");
      setQtyKg("");
      setRate("");
      setDeliveryDate(new Date().toISOString().split("T")[0]);
      setPriority("Medium");
      setStatus("Pending");
    }
    setIsOpenForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const activeParty = parties.find((p) => p.partyId === partyId);
    const activeItem = items.find((i) => i.itemId === itemId);
    const activeShade = shades.find((s) => s.shadeId === shadeId);
    const numericQty = parseFloat(qtyKg);
    const numericRate = parseFloat(rate);

    if (!partyId || !itemId || !shadeId) {
      setErrorMsg("Please register at least one Active Party, Item, and Shade in system first.");
      return;
    }

    if (!poNumber.trim() || !count.trim() || !deliveryDate) {
      setErrorMsg("PO Number, Count, and Delivery Date are required.");
      return;
    }

    if (isNaN(numericQty) || numericQty <= 0) {
      setErrorMsg("Quantity must be a positive number.");
      return;
    }

    if (isNaN(numericRate) || numericRate < 0) {
      setErrorMsg("Rate must be a non-negative number.");
      return;
    }

    try {
      const isNew = !editingOrder;
      const orderId = isNew ? generateNextOrderId() : editingOrder!.orderId;
      const docRef = doc(db, "party_orders", orderId);

      const payload: PartyOrder = {
        orderId,
        partyId,
        partyName: activeParty?.partyName || "Unknown Party",
        poNumber: poNumber.trim().toUpperCase(),
        itemId,
        itemName: activeItem?.itemName || "Unknown Item",
        count: count.trim(),
        shadeId,
        shadeName: activeShade?.shadeName || "Unknown Shade",
        qtyKg: numericQty,
        rate: numericRate,
        deliveryDate,
        priority,
        status,
        isDeleted: isNew ? false : editingOrder!.isDeleted,
        updatedAt: serverTimestamp(),
        createdAt: isNew ? serverTimestamp() : editingOrder!.createdAt,
      };

      await setDoc(docRef, payload);
      setSuccessMsg(`Order ${orderId} successfully ${isNew ? "created and cataloged" : "updated"} for party "${payload.partyName}".`);
      setIsOpenForm(false);
    } catch (err) {
      setErrorMsg("Failed to update Party Order parameters ledger.");
      handleFirestoreError(err, editingOrder ? OperationType.UPDATE : OperationType.CREATE, "party_orders");
    }
  };

  const toggleDelete = async (order: PartyOrder) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const docRef = doc(db, "party_orders", order.orderId);
      await updateDoc(docRef, {
        isDeleted: !order.isDeleted,
        updatedAt: serverTimestamp()
      });
      setSuccessMsg(`Order "${order.orderId}" statement has been successfully ${order.isDeleted ? "restored and reinstated" : "soft archived"}.`);
    } catch (err) {
      setErrorMsg("Archive status toggle requested could not resolve.");
      handleFirestoreError(err, OperationType.UPDATE, `party_orders/${order.orderId}`);
    }
  };

  const filteredOrders = orders.filter((o) => {
    const term = search.toLowerCase();
    const matchesSearch =
      o.orderId.toLowerCase().includes(term) ||
      o.poNumber.toLowerCase().includes(term) ||
      o.partyName.toLowerCase().includes(term) ||
      o.itemName.toLowerCase().includes(term) ||
      o.shadeName.toLowerCase().includes(term) ||
      o.count.toLowerCase().includes(term);

    const matchesStatus = selectedStatusFilter === "All" || o.status === selectedStatusFilter;
    const matchesPriority = selectedPriorityFilter === "All" || o.priority === selectedPriorityFilter;
    const matchesDelete = showSoftDeleted ? o.isDeleted : !o.isDeleted;

    return matchesSearch && matchesStatus && matchesPriority && matchesDelete;
  });

  return (
    <div className="space-y-5 font-sans">
      {/* Visual Header Messages */}
      {(successMsg || errorMsg) && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs ${
          successMsg ? "bg-[#10b981]/10 border-[#10b981]/25 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-500"
        }`}>
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg || errorMsg}</span>
        </div>
      )}

      {/* Controller Tools Bar */}
      <div className="flex flex-col xl:flex-row items-center justify-between gap-4 bg-white/[0.02] border border-white/5 rounded-2xl p-4">
        <div className="flex flex-col md:flex-row items-center gap-3 w-full xl:w-auto">
          {/* Main Search */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-505 text-slate-550" />
            <input
              type="text"
              placeholder="Search orders, PO, client, shade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          {/* Status Filter Dropdown */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Status:</span>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500/50 cursor-pointer"
            >
              <option value="All" className="bg-[#0b122c]">All Statuses</option>
              {STATUSES.map((st) => (
                <option key={st} value={st} className="bg-[#0b122c]">{st}</option>
              ))}
            </select>
          </div>

          {/* Priority Filter Dropdown */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Priority:</span>
            <select
              value={selectedPriorityFilter}
              onChange={(e) => setSelectedPriorityFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500/50 cursor-pointer"
            >
              <option value="All" className="bg-[#0b122c]">All Priorities</option>
              {PRIORITIES.map((pr) => (
                <option key={pr} value={pr} className="bg-[#0b122c]">{pr}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Toggles & Create Buttons */}
        <div className="flex items-center gap-3 w-full xl:w-auto justify-end">
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
              <span>Catalog New Order</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Database Table Grid */}
      <div className="bg-[#0a1128]/50 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.012] text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Order Code</th>
                <th className="py-3 px-4">Corporate Party Name</th>
                <th className="py-3 px-4">PO Number</th>
                <th className="py-3 px-4">Item Cataloged</th>
                <th className="py-3 px-4">Count Specs</th>
                <th className="py-3 px-4">Shade Lab Code</th>
                <th className="py-3 px-4 text-right">Qty (Kg)</th>
                <th className="py-3 px-4 text-right">Order Rate</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4 text-center">Priority</th>
                <th className="py-3 px-4 text-center">Order Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-10 text-center text-slate-500 font-mono">
                    Syncing Orders Master databases...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-10 text-center text-slate-500">
                    No active corporate party orders matching parameters index criteria.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => (
                  <tr key={o.orderId} className="hover:bg-white/[0.015] transition-colors">
                    <td className="py-3 px-4 font-mono text-cyan-400 font-bold">{o.orderId}</td>
                    <td className="py-3 px-4 font-medium text-white max-w-xs truncate" title={o.partyName}>
                      {o.partyName}
                    </td>
                    <td className="py-3 px-4 font-mono text-indigo-300 font-semibold">{o.poNumber}</td>
                    <td className="py-3 px-4 text-slate-300 max-w-xs truncate" title={o.itemName}>
                      {o.itemName}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-amber-400">{o.count}</td>
                    <td className="py-3 px-4 max-w-xs truncate text-[11px] text-indigo-200" title={o.shadeName}>
                      {o.shadeName}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-white">
                      {o.qtyKg.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-400 font-bold">
                      ${o.rate.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {o.deliveryDate}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${
                        o.priority === "Urgent"
                          ? "bg-red-500/15 border-red-500/30 text-red-400"
                          : o.priority === "High"
                            ? "bg-orange-500/15 border-orange-500/30 text-orange-400"
                            : o.priority === "Medium"
                              ? "bg-yellow-500/15 border-yellow-500/30 text-yellow-400"
                              : "bg-blue-500/10 border-blue-500/20 text-blue-400"
                      }`}>
                        {o.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${
                        o.status === "Completed"
                          ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                          : o.status === "Processing"
                            ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-300"
                            : o.status === "Cancelled"
                              ? "bg-rose-500/10 border-rose-500/20 text-slate-450 text-rose-400"
                              : "bg-slate-500/10 border-slate-500/20 text-yellow-250 text-slate-400"
                      }`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewingOrder(o)}
                          className="p-1.5 border border-white/5 bg-white/[0.012] hover:bg-white/[0.04] rounded-lg text-slate-300 cursor-pointer transition-colors"
                          title="Review profile"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {(role === "owner" || role === "manager") && (
                          <>
                            <button
                              onClick={() => triggerForm(o)}
                              className="p-1.5 border border-white/5 bg-white/[0.012] hover:border-indigo-500/25 text-slate-300 hover:text-indigo-400 rounded-lg cursor-pointer transition-colors"
                              title="Modify properties"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => toggleDelete(o)}
                              className={`p-1.5 border border-white/5 rounded-lg cursor-pointer transition-colors ${
                                o.isDeleted
                                  ? "hover:border-emerald-500/20 hover:bg-emerald-500/10 text-emerald-400"
                                  : "hover:border-red-500/20 hover:bg-red-500/10 text-red-400"
                              }`}
                              title={o.isDeleted ? "Unarchive order" : "Archive order"}
                            >
                              {o.isDeleted ? <RotateCcw className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
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

      {/* Save / Edit Order Modal Form */}
      {isOpenForm && (
        <div className="fixed inset-0 bg-[#060a1d]/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b122c] border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-indigo-400" />
              {editingOrder ? "Modify Custom Party Order Spec" : "Initialize Corporate Party Order Details"}
            </h3>

            {parties.length === 0 || items.length === 0 || shades.length === 0 ? (
              <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl text-center text-xs text-amber-400 space-y-2">
                <p>Dependency Masters are blank! Please generate at least one Party, Item and Shade in database first.</p>
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
                {/* 1. Party */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-404 text-slate-400 uppercase tracking-wider block">Target Corporate Party / client</label>
                  <select
                    value={partyId}
                    onChange={(e) => setPartyId(e.target.value)}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400 cursor-pointer"
                  >
                    {parties.map((p) => (
                      <option key={p.partyId} value={p.partyId} className="bg-[#0b122c]">
                        {p.partyName} ({p.city})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. PO Number & Count */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-404 text-slate-400 uppercase tracking-wider block">Purchase Order (PO) Number</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. PO-8854"
                      value={poNumber}
                      onChange={(e) => setPoNumber(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white uppercase focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-404 text-slate-400 uppercase tracking-wider block">Yarn Count Gauge Specifications</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., 2/40s Ne, 30s Carded"
                      value={count}
                      onChange={(e) => setCount(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                </div>

                {/* 3. Item & Shade Selector */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Yarn/Product Item Master</label>
                    <select
                      value={itemId}
                      onChange={(e) => setItemId(e.target.value)}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400 cursor-pointer"
                    >
                      {items.map((i) => (
                        <option key={i.itemId} value={i.itemId} className="bg-[#0b122c]">
                          {i.itemName} ({i.itemCode})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Shade recipe formula</label>
                    <select
                      value={shadeId}
                      onChange={(e) => setShadeId(e.target.value)}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400 cursor-pointer"
                    >
                      {shades.map((s) => (
                        <option key={s.shadeId} value={s.shadeId} className="bg-[#0b122c]">
                          {s.shadeName} ({s.shadeCode})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 4. Qty & Rate */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Quantity (Qty Kg)</label>
                    <input
                      type="number"
                      required
                      step="any"
                      min="0.1"
                      placeholder="e.g. 500.5"
                      value={qtyKg}
                      onChange={(e) => setQtyKg(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Negotiated Order Rate ($)</label>
                    <input
                      type="number"
                      required
                      step="any"
                      min="0"
                      placeholder="e.g. 15.20"
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                </div>

                {/* 5. Date & Priority */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Estimated Delivery Date</label>
                    <input
                      type="date"
                      required
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Process Dispatch Priority</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as any)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none cursor-pointer"
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p} className="bg-[#0b122c]">{p}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 6. Order Status */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">System order status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s} className="bg-[#0b122c]">{s}</option>
                    ))}
                  </select>
                </div>

                {/* Form Buttons */}
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
                    Save Order
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Review details dialog */}
      {viewingOrder && (
        <div className="fixed inset-0 bg-[#060a1d]/85 backdrop-blur-md flex items-center justify-center p-4 z-50 font-sans">
          <div className="bg-[#0b122c] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-3">
              <ShoppingBag className="w-4 h-4 text-cyan-400" />
              Corporate Party Order Specification Ledger Card
            </h3>

            <div className="space-y-3 text-xs font-mono text-slate-300">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Order System Code</span>
                <span className="text-cyan-400 font-bold">{viewingOrder.orderId}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Corporate Party Legal Name</span>
                <span className="text-white font-sans font-semibold text-right max-w-[210px] truncate" title={viewingOrder.partyName}>
                  {viewingOrder.partyName}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Authorized PO Number</span>
                <span className="text-white">{viewingOrder.poNumber}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Registered Yarn Item</span>
                <span className="text-white font-sans font-medium text-right max-w-[210px] truncate" title={viewingOrder.itemName}>
                  {viewingOrder.itemName}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Spec Count Gauge</span>
                <span className="text-amber-400 font-sans font-medium">{viewingOrder.count}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Selected Shade Formula</span>
                <span className="text-indigo-300 font-sans text-right max-w-[210px] truncate" title={viewingOrder.shadeName}>
                  {viewingOrder.shadeName}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Weighed Quantity (Kg)</span>
                <span className="text-white font-bold">{viewingOrder.qtyKg.toLocaleString()} Kg</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Price Rate per unit KG</span>
                <span className="text-emerald-400 font-semibold">${viewingOrder.rate.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Precalculated Net Value</span>
                <span className="text-emerald-400 font-extrabold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded text-[11px]">
                  ${(viewingOrder.qtyKg * viewingOrder.rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Committed Deadline</span>
                <span className="text-white flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  {viewingOrder.deliveryDate}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Process Dispatch Priority</span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${
                  viewingOrder.priority === "Urgent"
                    ? "bg-red-500/15 border-red-500/30 text-red-400"
                    : viewingOrder.priority === "High"
                      ? "bg-orange-500/15 border-orange-500/30 text-orange-400"
                      : "bg-blue-500/10 border-blue-500/20 text-blue-400"
                }`}>
                  {viewingOrder.priority}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Active Order Status</span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${
                  viewingOrder.status === "Completed"
                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                    : viewingOrder.status === "Processing"
                      ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-300"
                      : "bg-slate-500/10 border-slate-500/20 text-slate-400"
                }`}>
                  {viewingOrder.status}
                </span>
              </div>
            </div>

            {/* Modal Controls */}
            <div className="flex justify-end pt-3 border-t border-white/5">
              <button
                type="button"
                onClick={() => setViewingOrder(null)}
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
