import React, { useState, useEffect } from "react";
import { collection, onSnapshot, setDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { ReadyStock, ConningProduction } from "../types";
import { 
  Search, Plus, Eye, Edit2, RotateCcw, Trash2, Box, Layers, 
  MapPin, CheckCircle, Package, ArrowUpRight, BarChart3,
  X, AlertCircle, ShoppingCart, Truck, Check, Grid, Printer
} from "lucide-react";

interface ReadyStockViewProps {
  role: string;
}

const STOCK_STATUSES = ["Available", "Reserved", "Dispatched"] as const;
const GRADE_OPTIONS = ["A Grade", "Standard Grade", "B Grade"] as const;

export const ReadyStockView: React.FC<ReadyStockViewProps> = ({ role }) => {
  const [stocks, setStocks] = useState<ReadyStock[]>([]);
  const [connings, setConnings] = useState<ConningProduction[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & filter states
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [showSoftDeleted, setShowSoftDeleted] = useState(false);

  // Error/Success messages
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal actions
  const [editingStock, setEditingStock] = useState<ReadyStock | null>(null);
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [viewingStock, setViewingStock] = useState<ReadyStock | null>(null);

  // Form parameters
  const [lotId, setLotId] = useState("");
  const [bagNo, setBagNo] = useState("");
  const [partyName, setPartyName] = useState("");
  const [shade, setShade] = useState("");
  const [conesCount, setConesCount] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [grade, setGrade] = useState<"A Grade" | "Standard Grade" | "B Grade">("A Grade");
  const [warehouseLocation, setWarehouseLocation] = useState("");
  const [status, setStatus] = useState<"Available" | "Reserved" | "Dispatched">("Available");

  // Dispatch Action Modal states
  const [dispatchTarget, setDispatchTarget] = useState<ReadyStock | null>(null);
  const [dispatchComments, setDispatchComments] = useState("");
  const [dispatchTicketNumber, setDispatchTicketNumber] = useState("");

  // Subscribing to Firestore data
  useEffect(() => {
    setLoading(true);
    const unsubscribeStocks = onSnapshot(
      collection(db, "ready_stocks"),
      (snap) => {
        const list: ReadyStock[] = [];
        snap.forEach((docSnap) => {
          list.push(docSnap.data() as ReadyStock);
        });
        setStocks(list);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        console.error("Firestore loading error:", err);
      }
    );

    const unsubscribeConning = onSnapshot(
      collection(db, "conning_productions"),
      (snap) => {
        const list: ConningProduction[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as ConningProduction;
          if (!data.isDeleted) list.push(data);
        });
        setConnings(list);
      }
    );

    return () => {
      unsubscribeStocks();
      unsubscribeConning();
    };
  }, []);

  // Compute next RS ID for manual inwarding
  const generateNextStockId = (): string => {
    let maxNum = 0;
    stocks.forEach((s) => {
      const match = s.stockId.match(/^RS-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    return `RS-${String(maxNum + 1).padStart(4, "0")}`;
  };

  // Open creation or edit form
  const triggerForm = (stk: ReadyStock | null = null) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setDispatchTarget(null);

    if (stk) {
      setEditingStock(stk);
      setLotId(stk.lotId);
      setBagNo(stk.bagNo);
      setPartyName(stk.partyName);
      setShade(stk.shade);
      setConesCount(stk.conesCount.toString());
      setWeightKg(stk.weightKg.toString());
      setGrade(stk.grade);
      setWarehouseLocation(stk.warehouseLocation);
      setStatus(stk.status);
    } else {
      setEditingStock(null);
      setLotId("");
      setBagNo("");
      setPartyName("");
      setShade("");
      setConesCount("40");
      setWeightKg("46.0");
      setGrade("A Grade");
      setWarehouseLocation("Zone B-1");
      setStatus("Available");
    }
    setIsOpenForm(true);
  };

  // Link details from Conning production run to pre-fill manual stock inward
  const handleConningLink = (conId: string) => {
    const found = connings.find((c) => c.conningId === conId);
    if (found) {
      setLotId(found.lotId);
      setBagNo(found.bagNo);
      setPartyName(found.partyName);
      setShade(found.shade);
      setConesCount(found.conesCount.toString());
      setWeightKg(found.outputKg.toString());
      setSuccessMsg(`Linked winding data CP run: ${conId} successfully! Values transferred.`);
    }
  };

  // Save changes to Ready Stock
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const parsedCones = parseInt(conesCount, 10);
    const parsedWeight = parseFloat(weightKg);

    if (!lotId || !bagNo) {
      setErrorMsg("Lot reference and finished bag code are required.");
      return;
    }
    if (!partyName) {
      setErrorMsg("Client party name is required.");
      return;
    }
    if (isNaN(parsedCones) || parsedCones <= 0) {
      setErrorMsg("Cones count must be a positive integer.");
      return;
    }
    if (isNaN(parsedWeight) || parsedWeight <= 0) {
      setErrorMsg("Wound net package weight (Kg) must be a positive decimal.");
      return;
    }

    try {
      const isNew = !editingStock;
      const stockId = isNew ? generateNextStockId() : editingStock!.stockId;
      const docRef = doc(db, "ready_stocks", stockId);

      const payload: ReadyStock = {
        stockId,
        lotId,
        bagNo,
        partyName,
        shade,
        conesCount: parsedCones,
        weightKg: parseFloat(parsedWeight.toFixed(3)),
        grade,
        warehouseLocation: warehouseLocation.trim() || "Zone B-1",
        status,
        conningIdReference: isNew ? "" : (editingStock!.conningIdReference || ""),
        isDeleted: isNew ? false : editingStock!.isDeleted,
        updatedAt: serverTimestamp(),
        createdAt: isNew ? serverTimestamp() : editingStock!.createdAt
      };

      await setDoc(docRef, payload);
      setSuccessMsg(`Ready stock ledger document successfully saved with key: ${stockId}.`);
      setIsOpenForm(false);
    } catch (err) {
      setErrorMsg("Failed to commit Ready Stock record to Firestore. Please verify your auth role.");
      console.error(err);
    }
  };

  // Dispatch processing
  const triggerDispatch = (stk: ReadyStock) => {
    setDispatchTarget(stk);
    setDispatchComments("Invoiced & Dispatch ready via truck liner.");
    setDispatchTicketNumber(`TX-${Math.floor(100000 + Math.random() * 900000)}`);
  };

  const executeDispatch = async () => {
    if (!dispatchTarget) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const docRef = doc(db, "ready_stocks", dispatchTarget.stockId);
      await updateDoc(docRef, {
        status: "Dispatched",
        warehouseLocation: `DISPATCHED (${dispatchTicketNumber})`,
        updatedAt: serverTimestamp()
      });

      setSuccessMsg(`Finished goods shipment dispatch sequence triggered successfully! Item ${dispatchTarget.stockId} marked as Dispatched.`);
      setDispatchTarget(null);
    } catch (err) {
      setErrorMsg("Could not process dispatch tracking for this item.");
    }
  };

  // Archive / Soft Delete Toggle
  const handleArchiveToggle = async (stk: ReadyStock) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const docRef = doc(db, "ready_stocks", stk.stockId);
      await updateDoc(docRef, {
        isDeleted: !stk.isDeleted,
        updatedAt: serverTimestamp()
      });
      setSuccessMsg(`Item ${stk.stockId} soft archive has been successfully ${stk.isDeleted ? "restored" : "archived"}.`);
    } catch (err) {
      setErrorMsg("Failed to update status on Firestore.");
    }
  };

  // Sticker Ticket Print helper for shipping dispatch label
  const printDispatchSticker = (stk: ReadyStock) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Ready Stock Dispatch Label - ${stk.stockId}</title>
          <style>
            body { font-family: 'Helvetica', sans-serif; margin: 25px; text-align: center; }
            .label-card { border: 5px solid #000; padding: 25px; border-radius: 12px; max-width: 450px; margin: 0 auto; text-transform: uppercase; }
            h1 { font-size: 24px; letter-spacing: 1px; border-bottom: 3px double #000; margin: 0 0 15px 0; padding-bottom: 5px; }
            .meta-item { display: flex; justify-content: space-between; margin: 10px 0; font-size: 15px; border-bottom: 1px dashed #555; }
            .qc-stamp { font-size: 16px; font-weight: bold; margin-top: 20px; color: #000; border: 3px dashed #000; display: inline-block; padding: 5px 15px; }
            .qr-tag { margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="label-card">
            <h1>Finished Goods Dispatch</h1>
            <div class="meta-item"><strong>Package Stock ID:</strong> <span>${stk.stockId}</span></div>
            <div class="meta-item"><strong>Lot ID:</strong> <span>${stk.lotId}</span></div>
            <div class="meta-item"><strong>Bag/Package Tag:</strong> <span>${stk.bagNo}</span></div>
            <div class="meta-item"><strong>Consignee Party:</strong> <span>${stk.partyName}</span></div>
            <div class="meta-item"><strong>Color Shade Specs:</strong> <span>${stk.shade}</span></div>
            <div class="meta-item"><strong>Total Cones:</strong> <span>${stk.conesCount} Pcs</span></div>
            <div class="meta-item"><strong>Physical Net Weight:</strong> <span>${stk.weightKg.toFixed(2)} Kg</span></div>
            <div class="meta-item"><strong>Sorting Grade:</strong> <span>${stk.grade}</span></div>
            <div class="meta-item"><strong>Storage aisle:</strong> <span>${stk.warehouseLocation}</span></div>

            <div class="qr-tag">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=115x115&data=${encodeURIComponent(stk.stockId)}" alt="goods label tracking barcode" />
            </div>
            <div class="qc-stamp">QC PASS & PACKED</div>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Compute stats metrics
  const totalItemCount = stocks.filter(s => !s.isDeleted && s.status !== "Dispatched").length;
  const totalWeightAvailable = stocks
    .filter(s => !s.isDeleted && s.status === "Available")
    .reduce((sum, s) => sum + s.weightKg, 0);

  const totalConesAvailable = stocks
    .filter(s => !s.isDeleted && s.status === "Available")
    .reduce((sum, s) => sum + s.conesCount, 0);

  const totalDispatchedCount = stocks
    .filter(s => !s.isDeleted && s.status === "Dispatched")
    .length;

  // Filter items in list
  const filteredStocks = stocks.filter((s) => {
    if (showSoftDeleted ? !s.isDeleted : s.isDeleted) return false;

    const term = search.toLowerCase();
    const matchesSearch =
      s.stockId.toLowerCase().includes(term) ||
      s.lotId.toLowerCase().includes(term) ||
      s.bagNo.toLowerCase().includes(term) ||
      s.partyName.toLowerCase().includes(term) ||
      s.shade.toLowerCase().includes(term);

    const matchesStatus = statusFilter === "all" ? true : s.status === statusFilter;
    const matchesGrade = gradeFilter === "all" ? true : s.grade === gradeFilter;

    return matchesSearch && matchesStatus && matchesGrade;
  });

  return (
    <div className="space-y-6">
      {/* 1. PHYSICAL STORAGE METRICS RIG */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-sans">
        
        <div className="bg-[#0c142e] border border-white/5 rounded-2xl p-5 flex items-center gap-4 shadow-xl">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-black block tracking-wider">Available Packages</span>
            <span className="text-xl font-bold text-white leading-tight mt-1 block">{totalItemCount} Box Units</span>
          </div>
        </div>

        <div className="bg-[#0c142e] border border-white/5 rounded-2xl p-5 flex items-center gap-4 shadow-xl">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-black block tracking-wider">Net Finished Weight</span>
            <span className="text-xl font-bold text-white leading-tight mt-1 block">{totalWeightAvailable.toFixed(2)} Kg</span>
          </div>
        </div>

        <div className="bg-[#0c142e] border border-white/5 rounded-2xl p-5 flex items-center gap-4 shadow-xl">
          <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-black block tracking-wider">Total Available Cones</span>
            <span className="text-xl font-bold text-white leading-tight mt-1 block">{totalConesAvailable} Cones</span>
          </div>
        </div>

        <div className="bg-[#0c142e] border border-white/5 rounded-2xl p-5 flex items-center gap-4 shadow-xl">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-black block tracking-wider">Total Dispatched</span>
            <span className="text-xl font-bold text-white transition-all leading-tight mt-1 block">{totalDispatchedCount} Runs</span>
          </div>
        </div>

      </div>

      {/* Trigger Dialog messages */}
      {(successMsg || errorMsg) && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs animate-fadeIn ${
          successMsg ? "bg-[#10b981]/10 border-[#10b981]/25 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-500"
        }`}>
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg || errorMsg}</span>
        </div>
      )}

      {/* 2. LEDGER FILTER ACTIONS */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4 bg-[#0a1128]/50 backdrop-blur-xl border border-white/5 rounded-2xl p-4 font-sans">
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* query search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search Lot, client, color or packing..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-slate-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
            >
              <option value="all">Processed state</option>
              {STOCK_STATUSES.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-slate-500">Grade:</span>
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
            >
              <option value="all">All Grades</option>
              {GRADE_OPTIONS.map((gr) => (
                <option key={gr} value={gr}>{gr}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showSoftDeleted}
              onChange={(e) => setShowSoftDeleted(e.target.checked)}
              className="rounded border-white/10 bg-white/5 text-indigo-600 focus:ring-0"
            />
            <span>Show Archived</span>
          </label>

          {(role === "owner" || role === "manager") && (
            <button
              onClick={() => triggerForm()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Manual Ready Entry</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. READY STOCK LEDGER LEDTABLE */}
      <div className="bg-[#0a1128]/50 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-lg font-sans">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.012] text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3.5 px-4 font-mono">Stock ID</th>
                <th className="py-3.5 px-4">Lot reference</th>
                <th className="py-3.5 px-4">Bag/Package sequence</th>
                <th className="py-3.5 px-4">Client party</th>
                <th className="py-3.5 px-4">Color Shade</th>
                <th className="py-3.5 px-4 text-center">Packing Grade</th>
                <th className="py-3.5 px-4 text-center">Cones Count</th>
                <th className="py-3.5 px-4 text-right">Net Weight</th>
                <th className="py-3.5 px-4">Warehouse Rack Aisle</th>
                <th className="py-3.5 px-4 text-center">Logistics State</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-slate-400 font-mono">
                    Syncing warehouse stock ledger databases...
                  </td>
                </tr>
              ) : filteredStocks.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-slate-500 italic">
                    No matching Ready stock items located.
                  </td>
                </tr>
              ) : (
                filteredStocks.map((s) => (
                  <tr key={s.stockId} className="hover:bg-white/[0.015] transition-colors">
                    <td className="py-3.5 px-4 font-mono font-black text-indigo-400">{s.stockId}</td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-white font-bold">{s.lotId}</td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">{s.bagNo}</td>
                    <td className="py-3.5 px-4 text-white font-semibold">{s.partyName}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold bg-white/5 border border-white/10 px-2 py-0.5 rounded text-cyan-300 text-[10px] font-mono">
                        {s.shade}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold">
                      <span className="text-slate-200 bg-white/5 border border-white/10 px-2 py-0.5 rounded">
                        {s.grade}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-semibold text-emerald-400">{s.conesCount} Cones</td>
                    <td className="py-3.5 px-4 text-right font-mono font-black text-white">{s.weightKg.toFixed(2)} Kg</td>
                    <td className="py-3.5 px-4 text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-red-400" />
                        <span className="text-[11px] font-bold text-slate-300">{s.warehouseLocation}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-black border ${
                        s.status === "Available" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                        s.status === "Reserved" ? "bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse" :
                        "bg-red-500/10 text-red-400 border-red-500/20"
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewingStock(s)}
                          className="p-1.5 border border-white/5 bg-white/[0.012] hover:bg-white/[0.05] rounded-lg text-slate-300 transition-colors cursor-pointer"
                          title="View Ledger Document"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => printDispatchSticker(s)}
                          className="p-1.5 border border-white/5 bg-white/[0.012] hover:bg-white/[0.05] rounded-lg text-indigo-400 transition-colors cursor-pointer"
                          title="Print Shipping Label"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        
                        {s.status === "Available" && (
                          <button
                            onClick={() => triggerDispatch(s)}
                            className="p-1.5 border border-[#10b981]/20 bg-emerald-500/5 hover:bg-[#10b981]/20 rounded-lg text-emerald-400 transition-all cursor-pointer"
                            title="Dispatch Package"
                          >
                            <Truck className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {(role === "owner" || role === "manager") && (
                          <>
                            <button
                              onClick={() => triggerForm(s)}
                              className="p-1.5 border border-white/5 hover:border-indigo-500/35 bg-white/[0.012] hover:bg-indigo-500/10 text-slate-300 hover:text-indigo-400 rounded-lg transition-colors cursor-pointer"
                              title="Edit specifications"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleArchiveToggle(s)}
                              className={`p-1.5 border border-white/5 rounded-lg transition-colors cursor-pointer ${
                                s.isDeleted
                                  ? "hover:border-emerald-500/35 hover:bg-emerald-500/10 text-emerald-400"
                                  : "hover:border-red-500/35 hover:bg-red-500/10 text-red-500"
                              }`}
                              title={s.isDeleted ? "Recover Item" : "Soft Archive"}
                            >
                              {s.isDeleted ? <RotateCcw className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
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

      {/* 4. DISPATCH SEQUENCE FLOW OVERLAY MODAL */}
      {dispatchTarget && (
        <div className="fixed inset-0 bg-[#060a1d]/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b122c] border border-white/15 rounded-2xl w-full max-w-md p-6 shadow-2xl relative space-y-4 font-sans text-xs">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-400" />
                Dispatch & Logistics Shipment Sequence
              </h3>
              <button
                type="button"
                onClick={() => setDispatchTarget(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-2 font-mono text-[11px] text-slate-300">
                <div><strong>Dispatching stock ID:</strong> <span className="text-white font-bold">{dispatchTarget.stockId}</span></div>
                <div><strong>Lot / Bag:</strong> <span className="text-white">{dispatchTarget.lotId} / {dispatchTarget.bagNo}</span></div>
                <div><strong>Party / Consignee:</strong> <span className="text-[#a5b4fc] font-bold">{dispatchTarget.partyName}</span></div>
                <div><strong>Goods Type:</strong> <span className="text-cyan-400">{dispatchTarget.shade} ({dispatchTarget.conesCount} Cones)</span></div>
                <div><strong>Shipment Weight:</strong> <span className="text-emerald-400 font-bold">{dispatchTarget.weightKg.toFixed(2)} Kg</span></div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 block font-bold">Logistics Courier / Transit ticket</label>
                <input
                  type="text"
                  value={dispatchTicketNumber}
                  onChange={(e) => setDispatchTicketNumber(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 block font-bold">Transit Waybill comments</label>
                <textarea
                  value={dispatchComments}
                  onChange={(e) => setDispatchComments(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-[11px]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
              <button
                type="button"
                onClick={() => setDispatchTarget(null)}
                className="bg-white/5 hover:bg-white/10 text-slate-300 font-bold py-2 px-4 rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDispatch}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Confirm Outward Dispatch Shipment</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. FORM OVERLAY: MANUAL READY STOCK INWARD */}
      {isOpenForm && (
        <div className="fixed inset-0 bg-[#060a1d]/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b122c] border border-white/15 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto font-sans text-xs">
            
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Grid className="w-4 h-4 text-indigo-400" />
                {editingStock ? `Modify Ready Stock Specifications [${editingStock.stockId}]` : "Inward New Finished Goods Ready Stock"}
              </h3>
              <button
                type="button"
                onClick={() => setIsOpenForm(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              
              {/* Optional: Fast Link to Conning / Winding run outputs */}
              {!editingStock && connings.length > 0 && (
                <div className="bg-[#0f193d] border border-indigo-500/15 p-4 rounded-xl space-y-2">
                  <span className="text-[9.5px] font-extrabold uppercase text-indigo-400 block tracking-wider">
                    Link/import from winding (Conning) production run
                  </span>
                  <div className="flex gap-2">
                    <select
                      onChange={(e) => handleConningLink(e.target.value)}
                      className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      <option value="">-- Choose active Conning run target --</option>
                      {connings
                        .filter((c) => c.quality === "Pass" && c.status === "Completed")
                        .map((c) => (
                          <option key={c.conningId} value={c.conningId}>
                            {c.conningId} (Party: {c.partyName} - Lot: {c.lotId} - Cones: {c.conesCount})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Grid 1: Basic identity fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Lot Reference ID</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. L-105"
                    value={lotId}
                    onChange={(e) => setLotId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Finished Bag ID / Barcode</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. L-105-B01"
                    value={bagNo}
                    onChange={(e) => setBagNo(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-mono text-xs text-white"
                  />
                </div>
              </div>

              {/* Grid 2: Client and Color details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Consignee Client Party Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Supplier or Client Name"
                    value={partyName}
                    onChange={(e) => setPartyName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Color Shade code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Emerald Green"
                    value={shade}
                    onChange={(e) => setShade(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 font-mono text-white"
                  />
                </div>
              </div>

              {/* Grid 3: Quantities and grade packing logistics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Cones Count (Pcs)</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 50"
                    value={conesCount}
                    onChange={(e) => setConesCount(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Wound Net weight (Kg)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="Net Kg weight"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-bold font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Finished Packing Grade</label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value as any)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white cursor-pointer"
                  >
                    {GRADE_OPTIONS.map((g) => (
                      <option key={g} value={g} className="bg-[#0b122c]">{g}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Grid 4: warehouse logistics location details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Warehouse Location Aisle</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Aisle D Rack 2"
                    value={warehouseLocation}
                    onChange={(e) => setWarehouseLocation(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Stock Logistics State</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-bold cursor-pointer"
                  >
                    {STOCK_STATUSES.map((sc) => (
                      <option key={sc} value={sc} className="bg-[#0b122c]">{sc}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* submit button row */}
              <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsOpenForm(false)}
                  className="bg-white/5 hover:bg-white/10 text-slate-400 font-bold py-2 px-4 rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 font-bold text-white py-2 px-5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Commit Goods Inward</span>
                  <Check className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. SIDEWAYS DETAIL DIALOG VIEW */}
      {viewingStock && (
        <div className="fixed inset-0 bg-[#060a1d]/85 backdrop-blur-md flex items-center justify-center p-4 z-50 font-mono text-slate-300">
          <div className="bg-[#0b122c] border border-white/15 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative space-y-4 text-xs">
            
            <div className="flex items-center justify-between border-b border-white/5 pb-3 font-sans">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                Finished Goods Stock Card
              </h3>
              <button
                type="button"
                onClick={() => setViewingStock(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>Stock UID ID:</span>
                <span className="text-white font-bold">{viewingStock.stockId}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>Yarn Lot Reference:</span>
                <span className="text-[#818cf8] font-bold">{viewingStock.lotId}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>Finished Box Tag:</span>
                <span className="text-slate-200">{viewingStock.bagNo}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>Target Client Party:</span>
                <span className="text-white font-sans font-bold">{viewingStock.partyName}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>Yarn Shade color:</span>
                <span className="text-cyan-400 font-bold">{viewingStock.shade}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>Pack Sorting Grade:</span>
                <span className="text-white font-bold">{viewingStock.grade}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>Physical Cones:</span>
                <span className="text-emerald-400 font-bold">{viewingStock.conesCount} Pcs</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>Total Net Weight:</span>
                <span className="text-white font-black">{viewingStock.weightKg.toFixed(2)} Kg</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>Aisle location rack:</span>
                <span className="text-[#fda4af] font-bold">{viewingStock.warehouseLocation}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>Winding source link:</span>
                <span className="text-slate-400 font-mono text-[10px]">{viewingStock.conningIdReference || "Manual Inward"}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>Shipment Logistics State:</span>
                <span className="text-white font-bold">{viewingStock.status}</span>
              </div>
            </div>

            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => {
                  printDispatchSticker(viewingStock);
                  setViewingStock(null);
                }}
                className="bg-indigo-600 hover:bg-indigo-500 font-sans font-bold text-white py-2 px-5 rounded-xl text-xs transition-colors tracking-wide cursor-pointer flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>Print Finished Pack Label</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
