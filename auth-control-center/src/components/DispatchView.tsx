import React, { useState, useEffect } from "react";
import { collection, onSnapshot, setDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError } from "../firebase";
import { DispatchTransaction, Party, PartyOrder, Item, Shade, ReadyStock, Rate, OperationType } from "../types";
import { 
  Plus, Search, Trash2, Eye, Truck, Calendar, User, ShoppingBag, 
  Layers, AlertCircle, FileText, X, Check, Printer, Scale, DollarSign, Filter
} from "lucide-react";

interface DispatchViewProps {
  role: string;
}

export const DispatchView: React.FC<DispatchViewProps> = ({ role }) => {
  const [dispatches, setDispatches] = useState<DispatchTransaction[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [orders, setOrders] = useState<PartyOrder[]>([]);
  const [shades, setShades] = useState<Shade[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [readyStocks, setReadyStocks] = useState<ReadyStock[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);

  // Filtering states
  const [search, setSearch] = useState("");
  const [partyFilter, setPartyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [partyId, setPartyId] = useState("");
  const [orderId, setOrderId] = useState("none");
  const [lotId, setLotId] = useState("");
  const [itemName, setItemName] = useState("");
  const [shade, setShade] = useState("");
  const [dispatchKg, setDispatchKg] = useState("");
  const [rate, setRate] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [lrNo, setLrNo] = useState("");

  // Print/View details Modal
  const [viewingDispatch, setViewingDispatch] = useState<DispatchTransaction | null>(null);

  const isStaff = role === "owner" || role === "manager";

  // Load backend data realtime
  useEffect(() => {
    setLoading(true);

    // 1. Dispatches
    const unsubscribeDispatches = onSnapshot(
      collection(db, "dispatches"),
      (snap) => {
        const list: DispatchTransaction[] = [];
        snap.forEach((docSnap) => {
          list.push(docSnap.data() as DispatchTransaction);
        });
        // Sort by invoice or date desc
        list.sort((a, b) => b.dispatchId.localeCompare(a.dispatchId));
        setDispatches(list);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, "dispatches");
      }
    );

    // 2. Parties
    const unsubscribeParties = onSnapshot(
      collection(db, "parties"),
      (snap) => {
        const list: Party[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as Party;
          if (!data.isDeleted) list.push(data);
        });
        setParties(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, "parties")
    );

    // 3. Orders
    const unsubscribeOrders = onSnapshot(
      collection(db, "party_orders"),
      (snap) => {
        const list: PartyOrder[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as PartyOrder;
          if (!data.isDeleted) list.push(data);
        });
        setOrders(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, "party_orders")
    );

    // 4. Products Master Items
    const unsubscribeItems = onSnapshot(
      collection(db, "items"),
      (snap) => {
        const list: Item[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as Item;
          if (!data.isDeleted) list.push(data);
        });
        setItems(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, "items")
    );

    // 5. Shades
    const unsubscribeShades = onSnapshot(
      collection(db, "shades"),
      (snap) => {
        const list: Shade[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as Shade;
          if (!data.isDeleted) list.push(data);
        });
        setShades(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, "shades")
    );

    // 6. Ready / Finished Stocks for quick lookup of lotId & weights
    const unsubscribeReady = onSnapshot(
      collection(db, "ready_stocks"),
      (snap) => {
        const list: ReadyStock[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as ReadyStock;
          if (!data.isDeleted) list.push(data);
        });
        setReadyStocks(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, "ready_stocks")
    );

    // 7. Rate directory to pull standard tariff
    const unsubscribeRates = onSnapshot(
      collection(db, "rates"),
      (snap) => {
        const list: Rate[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as Rate;
          if (!data.isDeleted) list.push(data);
        });
        setRates(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, "rates")
    );

    return () => {
      unsubscribeDispatches();
      unsubscribeParties();
      unsubscribeOrders();
      unsubscribeItems();
      unsubscribeShades();
      unsubscribeReady();
      unsubscribeRates();
    };
  }, []);

  // Set default form values based on selected Party and Order
  useEffect(() => {
    if (orderId !== "none") {
      const selectedOrder = orders.find((o) => o.orderId === orderId);
      if (selectedOrder) {
        setPartyId(selectedOrder.partyId);
        setItemName(selectedOrder.itemName);
        setShade(selectedOrder.shadeName);
        setRate(selectedOrder.rate.toString());
        
        // Find associated ready stock weight if any
        const associatedStocks = readyStocks.filter(
          (s) => s.lotId === selectedOrder.orderId || s.partyName.toLowerCase() === selectedOrder.partyName.toLowerCase()
        );
        if (associatedStocks.length > 0) {
          const totalWeight = associatedStocks.reduce((sum, s) => sum + (s.status === "Available" ? s.weightKg : 0), 0);
          if (totalWeight > 0) {
            setDispatchKg(totalWeight.toString());
          }
        }
      }
    }
  }, [orderId, orders, readyStocks]);

  // Autofill rate based on customized Party rates
  useEffect(() => {
    if (partyId && itemName && orderId === "none") {
      // Find matching item in master catalog
      const matchedItem = items.find(i => i.itemName.toLowerCase() === itemName.toLowerCase() || i.itemId === itemName);
      if (matchedItem) {
        // Find shadeId matches
        const matchedShade = shades.find(s => s.shadeName.toLowerCase() === shade.toLowerCase() || s.shadeId === shade);
        const sId = matchedShade ? matchedShade.shadeId : "none";
        
        const partyRate = rates.find(
          r => r.partyId === partyId && r.itemId === matchedItem.itemId && (r.shadeId === sId || r.shadeId === "none")
        );
        if (partyRate) {
          setRate(partyRate.rate.toString());
        }
      }
    }
  }, [partyId, itemName, shade, rates, items, shades, orderId]);

  // Handle Order Selection from Party Filter
  const partyOrders = partyId ? orders.filter(o => o.partyId === partyId && o.status !== "Completed") : orders;

  // Auto-generate invoice sequential recommendations
  const openNewDispatchForm = () => {
    const year = new Date().getFullYear();
    const nextNum = dispatches.length + 1;
    setInvoiceNo(`INV-${year}-${("000" + nextNum).slice(-4)}`);
    
    // Clear other states
    setPartyId("");
    setOrderId("none");
    setLotId("");
    setItemName("");
    setShade("");
    setDispatchKg("");
    setRate("");
    setVehicleNo("");
    setLrNo("");
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsOpenForm(true);
  };

  const handleCreateDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyId || !itemName || !dispatchKg || !rate) {
      setErrorMsg("Please complete all required fields (*).");
      return;
    }

    const numericKg = parseFloat(dispatchKg);
    const numericRate = parseFloat(rate);
    if (isNaN(numericKg) || numericKg <= 0) {
      setErrorMsg("Dispatch weight must be a valid positive number.");
      return;
    }
    if (isNaN(numericRate) || numericRate < 0) {
      setErrorMsg("Rate must be a non-negative number.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const selectedParty = parties.find((p) => p.partyId === partyId);
    const matchedOrderId = orderId === "none" ? "Manual" : orderId;
    const finalLotId = lotId || "manual";

    const nextIdVal = dispatches.length > 0 
      ? `DISP-${("000" + (Math.max(...dispatches.map(d => {
          const m = d.dispatchId.match(/\d+/);
          return m ? parseInt(m[0], 10) : 0;
        })) + 1)).slice(-4)}`
      : "DISP-0001";

    const newDispatch: DispatchTransaction = {
      dispatchId: nextIdVal,
      invoiceNo: invoiceNo || `INV-${new Date().getFullYear()}-${nextIdVal.split("-")[1]}`,
      partyId,
      partyName: selectedParty?.partyName || "Unknown Party",
      orderId: matchedOrderId,
      lotId: finalLotId,
      itemName,
      shade,
      dispatchKg: numericKg,
      rate: numericRate,
      amount: parseFloat((numericKg * numericRate).toFixed(2)),
      vehicleNo: vehicleNo || "N/A",
      lrNo: lrNo || "N/A",
      status: "Dispatched",
      isDeleted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, "dispatches", newDispatch.dispatchId), newDispatch);
      
      // If dispatch is linked to an order, update order quantity or check if complete
      if (orderId !== "none") {
        const orderDocRef = doc(db, "party_orders", orderId);
        const activeOrder = orders.find(o => o.orderId === orderId);
        if (activeOrder) {
          // If dispatch qty reaches or exceeds ordered qty, mark Order asCompleted
          const newStatus = activeOrder.qtyKg <= numericKg ? "Completed" : "Processing";
          await updateDoc(orderDocRef, {
            status: newStatus,
            updatedAt: serverTimestamp()
          });
        }
      }

      // If matching Lot and Bag ready stocks exist, we can mark them as Dispatched in warehouse!
      if (lotId) {
        const stockToUpdate = readyStocks.filter(s => s.lotId === lotId && s.status === "Available");
        for (const stock of stockToUpdate) {
          await updateDoc(doc(db, "ready_stocks", stock.stockId), {
            status: "Dispatched",
            updatedAt: serverTimestamp()
          });
        }
      }

      setSuccessMsg(`Dispatch invoice ${newDispatch.invoiceNo} generated successfully!`);
      setIsOpenForm(false);
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      setErrorMsg("Failed to generate dispatch transaction: " + err.message);
    }
  };

  const handleCancelDispatch = async (dispatchId: string) => {
    if (!window.confirm("Are you sure you want to cancel this dispatch transaction? This will reverse the invoicing.")) return;
    try {
      setLoading(true);
      await updateDoc(doc(db, "dispatches", dispatchId), {
        status: "Cancelled",
        updatedAt: serverTimestamp()
      });
      setSuccessMsg("Dispatch transaction successfully marked as Cancelled.");
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      setErrorMsg("Error canceling dispatch transaction: " + err.message);
    }
  };

  const handleDeleteDispatch = async (dispatchId: string) => {
    if (!window.confirm("Are you sure you want to softly delete this dispatch transaction record?")) return;
    try {
      setLoading(true);
      await updateDoc(doc(db, "dispatches", dispatchId), {
        isDeleted: true,
        updatedAt: serverTimestamp()
      });
      setSuccessMsg("Dispatch record soft-deleted.");
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      setErrorMsg("Error deleting dispatch: " + err.message);
    }
  };

  // Filters calculation
  const filteredDispatches = dispatches.filter((d) => {
    if (d.isDeleted) return false;
    
    const matchesSearch = 
      d.invoiceNo.toLowerCase().includes(search.toLowerCase()) ||
      d.partyName.toLowerCase().includes(search.toLowerCase()) ||
      d.lotId.toLowerCase().includes(search.toLowerCase()) ||
      d.itemName.toLowerCase().includes(search.toLowerCase()) ||
      d.shade.toLowerCase().includes(search.toLowerCase());

    const matchesParty = partyFilter === "all" || d.partyId === partyFilter;
    const matchesStatus = statusFilter === "all" || d.status === statusFilter;

    return matchesSearch && matchesParty && matchesStatus;
  });

  // Calculate totals
  const totalKgDispatched = filteredDispatches
    .filter(d => d.status === "Dispatched")
    .reduce((sum, d) => sum + d.dispatchKg, 0);

  const totalInvoicedValue = filteredDispatches
    .filter(d => d.status === "Dispatched")
    .reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="space-y-6">
      
      {/* Alert Banners */}
      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3 text-red-400 text-xs animate-fadeIn">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="ml-auto text-red-400 hover:text-white font-bold">&times;</button>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3 text-emerald-400 text-xs animate-fadeIn">
          <Check className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="ml-auto text-emerald-400 hover:text-white font-bold">&times;</button>
        </div>
      )}

      {/* KPI Stats Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-2">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10 rounded-2xl p-5 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span>TOTAL DISPATCHED WT</span>
            <Scale className="w-4 h-4 text-cyan-400 shrink-0" />
          </div>
          <div className="mt-2 space-y-1">
            <span className="text-2xl font-black text-white font-mono">{totalKgDispatched.toLocaleString(undefined, {maximumFractionDigits: 2})} <span className="text-xs font-sans text-cyan-400">Kg</span></span>
            <p className="text-[10px] text-slate-400">Sum of net dispatched weight.</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10 rounded-2xl p-5 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span>DISPATCH INVOICED VALUE</span>
            <DollarSign className="w-4 h-4 text-emerald-400 shrink-0" />
          </div>
          <div className="mt-2 space-y-1">
            <span className="text-2xl font-black text-white font-mono">₹{totalInvoicedValue.toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
            <p className="text-[10px] text-slate-400">Consolidated active billing invoicing.</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10 rounded-2xl p-5 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span>DISPATCH VOUCHERS</span>
            <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
          </div>
          <div className="mt-2 space-y-1">
            <span className="text-2xl font-black text-white font-mono">{filteredDispatches.length} <span className="text-xs font-sans text-indigo-400">Notes</span></span>
            <p className="text-[10px] text-slate-400">Active transport delivery logs.</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10 rounded-2xl p-5 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span>LOGISTICS STATUS</span>
            <Truck className="w-4 h-4 text-amber-400 shrink-0" />
          </div>
          <div className="mt-2 space-y-1">
            <span className="text-2xl font-black text-amber-400 font-mono">
              {filteredDispatches.filter(d => d.status === "Dispatched").length} Active
            </span>
            <p className="text-[10px] text-slate-400">Shipments out in transit carriers.</p>
          </div>
        </div>
      </div>

      {/* Control Actions & Searching */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-white/[0.02] border border-white/5 rounded-2xl p-4">
        
        {/* Left searching tools */}
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search Invoice, Party, Lot, Shade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900/60 border border-white/10 text-white rounded-xl py-2 pl-9 pr-4 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={partyFilter}
              onChange={(e) => setPartyFilter(e.target.value)}
              className="bg-slate-900 border border-white/10 text-white text-xs rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">Full Party Directory</option>
              {parties.map((p) => (
                <option key={p.partyId} value={p.partyId}>{p.partyName}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-white/10 text-white text-xs rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">Every Status</option>
              <option value="Dispatched">Dispatched</option>
              <option value="Pending">Pending</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Right side primary action button */}
        {isStaff && (
          <button
            onClick={openNewDispatchForm}
            className="bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            New Dispatch Invoice
          </button>
        )}
      </div>

      {/* Main Grid: Data table */}
      <div className="bg-slate-950 border border-white/15 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Invoice No</th>
                <th className="py-3 px-4">Party Client</th>
                <th className="py-3 px-4">Ref Order / Lot</th>
                <th className="py-3 px-4">Yarn Description</th>
                <th className="py-3 px-4">Weight (Kg)</th>
                <th className="py-3 px-4">Rate (₹)</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Logistics</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <Scale className="w-8 h-8 text-indigo-400 animate-spin" />
                      <span>Reading active dispatch records...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredDispatches.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500 font-sans">
                    No active dispatches found matching search filters.
                  </td>
                </tr>
              ) : (
                filteredDispatches.map((disp) => (
                  <tr key={disp.dispatchId} className="hover:bg-white/[0.01] transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-indigo-400">
                      {disp.invoiceNo}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-white">
                      {disp.partyName}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 uppercase">Order:</span>
                        <span className="font-bold text-slate-200">{disp.orderId}</span>
                        <span className="text-[9px] text-slate-400 mt-0.5">Lot: <span className="text-cyan-400">{disp.lotId}</span></span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-white">{disp.itemName}</span>
                        <span className="text-[10px] text-slate-500">Shade: <span className="text-slate-400 font-mono">{disp.shade || "None"}</span></span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-black text-white text-right pr-6">
                      {disp.dispatchKg.toFixed(2)} Kg
                    </td>
                    <td className="py-3.5 px-4 font-mono text-right pr-6">
                      ₹{disp.rate.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-400 text-right pr-6">
                      ₹{disp.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono">
                      <div className="flex flex-col text-[10px]">
                        <span>Veh: <span className="text-slate-200 font-bold">{disp.vehicleNo}</span></span>
                        <span>LR No: <span className="text-slate-400">{disp.lrNo}</span></span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded border uppercase tracking-wider ${
                        disp.status === "Dispatched" 
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                          : disp.status === "Cancelled"
                            ? "bg-red-500/10 border-red-500/25 text-red-400"
                            : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                      }`}>
                        {disp.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setViewingDispatch(disp)}
                          title="Print Draft/View details"
                          className="p-1 px-2.5 bg-slate-800 border border-white/5 rounded text-[11px] text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-1"
                        >
                          <Printer className="w-3 w-3" />
                          <span>Invoice</span>
                        </button>
                        
                        {isStaff && disp.status === "Dispatched" && (
                          <button
                            onClick={() => handleCancelDispatch(disp.dispatchId)}
                            title="Cancel Invoice"
                            className="p-1 text-amber-400 hover:bg-amber-500/10 rounded transition-colors"
                          >
                            <Calendar className="w-4.5 h-4.5" />
                          </button>
                        )}

                        {isStaff && (
                          <button
                            onClick={() => handleDeleteDispatch(disp.dispatchId)}
                            title="Delete Dispatch Entry"
                            className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* MODAL 1: ADD DISPATCH FORM */}
      {isOpenForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-slate-950">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Generate Finished Goods Dispatch Invoice</h3>
              </div>
              <button 
                onClick={() => setIsOpenForm(false)} 
                className="text-slate-400 hover:text-white transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDispatch} className="p-6 space-y-4 text-xs text-slate-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Invoice No */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Invoice No *</label>
                  <input 
                    type="text" 
                    required
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                    placeholder="e.g. INV-2026-0001"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
                  />
                </div>

                {/* Party Client */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Select Party Client *</label>
                  <select
                    required
                    value={partyId}
                    onChange={(e) => {
                      setPartyId(e.target.value);
                      setOrderId("none"); // reset order on parent change
                    }}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">-- Choose Party --</option>
                    {parties.map((p) => (
                      <option key={p.partyId} value={p.partyId}>{p.partyName}</option>
                    ))}
                  </select>
                </div>

                {/* Order Referencing */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">Reference Party Order</label>
                  <select
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
                  >
                    <option value="none">Manual Dispatch (No Linked Order)</option>
                    {partyOrders.map((o) => (
                      <option key={o.orderId} value={o.orderId}>
                        {o.orderId} - {o.itemName} ({o.shadeName}) - {o.qtyKg} Kg
                      </option>
                    ))}
                  </select>
                </div>

                {/* Lot Referencing */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Reference Yarn Stock Lot</label>
                  <input 
                    type="text" 
                    value={lotId}
                    onChange={(e) => setLotId(e.target.value)}
                    placeholder="e.g. L-001 or select from Warehouse"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
                  />
                </div>

                {/* Yarn Item description */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block animate-pulse">Item Specification *</label>
                  <input 
                    type="text" 
                    required
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="e.g. Cotton Hank 40s"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>

                {/* Shade description */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Shade Specification</label>
                  <input 
                    type="text" 
                    value={shade}
                    onChange={(e) => setShade(e.target.value)}
                    placeholder="e.g. Royal Indigo Sh-09"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>

                {/* Dispatch Weight Kg */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block text-cyan-400">Dispatch Kg *</label>
                  <input 
                    type="number" 
                    step="any"
                    required
                    value={dispatchKg}
                    onChange={(e) => setDispatchKg(e.target.value)}
                    placeholder="Net billing weight in Kg"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
                  />
                </div>

                {/* Rate per Kg */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block text-emerald-400">Rate (₹ per Kg) *</label>
                  <input 
                    type="number" 
                    step="any"
                    required
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    placeholder="e.g. 240.00"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
                  />
                </div>

                {/* Vehicle Carrier No */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Vehicle No</label>
                  <input 
                    type="text" 
                    value={vehicleNo}
                    onChange={(e) => setVehicleNo(e.target.value)}
                    placeholder="e.g. GJ-21-BA-9102"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
                  />
                </div>

                {/* LR Consignment No */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">LR No / Transport Receipt</label>
                  <input 
                    type="text" 
                    value={lrNo}
                    onChange={(e) => setLrNo(e.target.value)}
                    placeholder="e.g. LR-920801"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
                  />
                </div>

              </div>

              {/* Amount Preview calculation */}
              {dispatchKg && rate && !isNaN(parseFloat(dispatchKg)) && !isNaN(parseFloat(rate)) && (
                <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Estimated Invoice Amount:</span>
                  <span className="text-lg font-black text-emerald-400 font-mono">
                    ₹{(parseFloat(dispatchKg) * parseFloat(rate)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                  </span>
                </div>
              )}

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsOpenForm(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-xl transition-all"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl flex items-center gap-1 shadow-md hover:shadow-lg transition-all"
                >
                  {loading ? "Generating..." : "Generate & Post Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: INVOICE DECAL / PRINT DRAFT VIEW */}
      {viewingDispatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white text-slate-900 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl font-sans">
            
            {/* Header control buttons */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 bg-slate-50">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Finished Dispatch Delivery Challan Draft</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print challan
                </button>
                <button
                  onClick={() => setViewingDispatch(null)}
                  className="p-1 text-slate-400 hover:text-slate-900"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Print Area Layout */}
            <div className="p-8 space-y-6 max-h-[80vh] overflow-y-auto" id="printable-area">
              
              {/* Invoice Meta header */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-5">
                <div className="space-y-1">
                  <h1 className="text-xl font-black uppercase tracking-wider text-indigo-700 font-sans">Textile ERP Co.</h1>
                  <p className="text-xs text-slate-500 leading-normal">
                    Quality Processors & Hanks Yarn Dyers<br />
                    Main Industrial Zone Block 2C, Surat, Gujarat<br />
                    GSTIN: 24AAACT1002G1ZN
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <div className="bg-indigo-50 border border-indigo-100 font-mono text-[10px] font-bold text-indigo-700 px-2.5 py-1.5 rounded uppercase tracking-wider inline-block">
                    {viewingDispatch.status}
                  </div>
                  <h3 className="text-md font-bold text-slate-800 font-mono mt-1">{viewingDispatch.invoiceNo}</h3>
                  <p className="text-[10px] text-slate-500">Doc ID: {viewingDispatch.dispatchId}</p>
                </div>
              </div>

              {/* Bill To & Ship Details */}
              <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Party Client</span>
                  <div className="font-extrabold text-slate-900 text-sm">{viewingDispatch.partyName}</div>
                  <p className="text-slate-500 font-sans mt-1">
                    GSTIN: {parties.find(p => p.partyId === viewingDispatch.partyId)?.gst || "Pending Setup"}<br />
                    City: {parties.find(p => p.partyId === viewingDispatch.partyId)?.city || "Surat"}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Logistics & Carrier Details</span>
                  <div className="font-bold text-slate-800">
                    Vehicle: <span className="font-mono text-indigo-600 font-bold">{viewingDispatch.vehicleNo}</span>
                  </div>
                  <div className="font-bold text-slate-800">
                    LR No: <span className="font-mono text-indigo-600">{viewingDispatch.lrNo}</span>
                  </div>
                  <p className="text-slate-400 font-mono text-[10px] mt-1">
                    Order Ref: {viewingDispatch.orderId}<br />
                    Lot Ref: {viewingDispatch.lotId}
                  </p>
                </div>
              </div>

              {/* Items details Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden mt-4 text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-4">Yarn Item Description</th>
                      <th className="py-2.5 px-4">Shade Specs</th>
                      <th className="py-2.5 px-4 text-right pr-6">Weight (Kg)</th>
                      <th className="py-2.5 px-4 text-right pr-6">Rate (₹/Kg)</th>
                      <th className="py-2.5 px-4 text-right pr-4">Total Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-sans text-slate-800">
                    <tr>
                      <td className="py-4 px-4 font-extrabold">{viewingDispatch.itemName}</td>
                      <td className="py-4 px-4 font-mono text-slate-600">{viewingDispatch.shade || "None"}</td>
                      <td className="py-4 px-4 text-right pr-6 font-mono font-bold">{viewingDispatch.dispatchKg.toFixed(2)} Kg</td>
                      <td className="py-4 px-4 text-right pr-6 font-mono">₹{viewingDispatch.rate.toFixed(2)}</td>
                      <td className="py-4 px-4 text-right pr-4 font-mono font-extrabold text-indigo-700">₹{viewingDispatch.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    </tr>
                    <tr className="bg-slate-50 font-bold">
                      <td colSpan={2} className="py-3 px-4 text-slate-600 text-[10px] tracking-wider uppercase text-right">Invoice Sum Total</td>
                      <td className="py-3 px-4 text-right pr-6 font-mono">{viewingDispatch.dispatchKg.toFixed(2)} Kg</td>
                      <td></td>
                      <td className="py-3 px-4 text-right pr-4 font-mono text-sm text-indigo-700">₹{viewingDispatch.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Terms & Signatures */}
              <div className="grid grid-cols-2 gap-6 pt-12 text-[10px] text-slate-400">
                <div className="space-y-1">
                  <span className="font-bold uppercase text-slate-500 tracking-wider">Declarations & Rules</span>
                  <p className="leading-relaxed">
                    1. Goods once dispatched cannot be returned without verified dye lot inspection request.<br />
                    2. All payments must conform to standard commercial terms agreed in the party directory.
                  </p>
                </div>
                <div className="text-right flex flex-col justify-end pt-12">
                  <div className="border-t border-slate-300 w-36 ml-auto pt-2 text-center font-bold text-slate-500 uppercase tracking-widest text-[8px]">
                    Authorized Signature
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};
