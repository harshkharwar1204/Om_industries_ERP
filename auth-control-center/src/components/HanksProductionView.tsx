import React, { useState, useEffect } from "react";
import { collection, onSnapshot, setDoc, doc, serverTimestamp, updateDoc, deleteDoc } from "firebase/firestore";
import { db, handleFirestoreError } from "../firebase";
import { HanksProduction, GreyStock, WorkerMaster, OperationType } from "../types";
import { 
  Search, Plus, Edit2, Eye, Trash2, RotateCcw, Box, User, Layers, 
  AlertCircle, ChevronRight, Check, QrCode, Printer, CheckCircle, 
  TrendingDown, Activity, RefreshCw, X, SearchCode, Shield, Sparkles, Filter
} from "lucide-react";

interface HanksProductionViewProps {
  role: string;
}

const PRESET_PROCESSES = [
  "Reeling",
  "Hank Dyeing Prep",
  "Yarn Hank Mercerizing",
  "Hanks Drying",
  "Hank Cone Winding",
  "Quality Grading"
];

const PRESET_STATUSES = ["Pending", "Processing", "Completed", "Approved"];

export const HanksProductionView: React.FC<HanksProductionViewProps> = ({ role }) => {
  const [productions, setProductions] = useState<HanksProduction[]>([]);
  const [greyStocks, setGreyStocks] = useState<GreyStock[]>([]);
  const [workers, setWorkers] = useState<WorkerMaster[]>([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showSoftDeleted, setShowSoftDeleted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form modal states
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [editingProduction, setEditingProduction] = useState<HanksProduction | null>(null);

  // Input states
  const [lotId, setLotId] = useState("");
  const [bagNo, setBagNo] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [process, setProcess] = useState("Reeling");
  const [customProcess, setCustomProcess] = useState("");
  const [isCustomProcess, setIsCustomProcess] = useState(false);
  const [inputKg, setInputKg] = useState("");
  const [outputKg, setOutputKg] = useState("");
  const [status, setStatus] = useState<"Pending" | "Processing" | "Completed" | "Approved">("Pending");

  // Viewing detail states
  const [viewingProduction, setViewingProduction] = useState<HanksProduction | null>(null);
  const [printingTicket, setPrintingTicket] = useState<HanksProduction | null>(null);

  // QR Scanning Simulator search trigger
  const [trackingBagInput, setTrackingBagInput] = useState("");
  const [trackedProduction, setTrackedProduction] = useState<HanksProduction | null>(null);
  const [trackingError, setTrackingError] = useState("");
  const [isTrackingMode, setIsTrackingMode] = useState(false);

  // Load backend data realtime
  useEffect(() => {
    setLoading(true);

    // 1. Hanks Productions
    const unsubscribeProduction = onSnapshot(
      collection(db, "hanks_productions"),
      (snap) => {
        const list: HanksProduction[] = [];
        snap.forEach((docSnap) => {
          list.push(docSnap.data() as HanksProduction);
        });
        setProductions(list);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, "hanks_productions");
      }
    );

    // 2. Grey Stocks (Lot dependencies)
    const unsubscribeGrey = onSnapshot(
      collection(db, "grey_stocks"),
      (snap) => {
        const list: GreyStock[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as GreyStock;
          if (!data.isDeleted) {
            list.push(data);
          }
        });
        setGreyStocks(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "grey_stocks");
      }
    );

    // 3. Worker Masters
    const unsubscribeWorkers = onSnapshot(
      collection(db, "worker_masters"),
      (snap) => {
        const list: WorkerMaster[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as WorkerMaster;
          if (!data.isDeleted) {
            list.push(data);
          }
        });
        setWorkers(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "worker_masters");
      }
    );

    return () => {
      unsubscribeProduction();
      unsubscribeGrey();
      unsubscribeWorkers();
    };
  }, []);

  // Compute next available sequence bag ID under selected Lot ID
  const computeNextBagNo = (selectedLotId: string): string => {
    if (!selectedLotId) return "";
    
    // Find all bags starting with selected Lot number reference
    const relevantBags = productions.filter(
      (p) => p.lotId === selectedLotId && !p.isDeleted
    );

    let maxBagNum = 0;
    // Bag numbers come in format L-001-B01, L-001-B02 etc
    relevantBags.forEach((b) => {
      const parts = b.bagNo.split("-B");
      if (parts.length === 2) {
        const num = parseInt(parts[1], 10);
        if (!isNaN(num) && num > maxBagNum) {
          maxBagNum = num;
        }
      }
    });

    const nextBagNum = maxBagNum + 1;
    return `${selectedLotId}-B${String(nextBagNum).padStart(2, "0")}`;
  };

  // Trigger auto-bag update upon form lot change
  useEffect(() => {
    if (lotId && !editingProduction) {
      const generatedBag = computeNextBagNo(lotId);
      setBagNo(generatedBag);
    }
  }, [lotId, productions, editingProduction]);

  const generateNextProdId = (): string => {
    let maxIdNum = 0;
    productions.forEach((p) => {
      const match = p.productionId.match(/^HP-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxIdNum) maxIdNum = num;
      }
    });
    return `HP-${String(maxIdNum + 1).padStart(4, "0")}`;
  };

  const triggerForm = (prod: HanksProduction | null = null) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (prod) {
      setEditingProduction(prod);
      setLotId(prod.lotId);
      setBagNo(prod.bagNo);
      setWorkerId(prod.workerId);
      setStatus(prod.status);
      setInputKg(prod.inputKg.toString());
      setOutputKg(prod.outputKg.toString());

      if (PRESET_PROCESSES.includes(prod.process)) {
        setProcess(prod.process);
        setCustomProcess("");
        setIsCustomProcess(false);
      } else {
        setProcess("Other");
        setCustomProcess(prod.process);
        setIsCustomProcess(true);
      }
    } else {
      setEditingProduction(null);
      const firstLot = greyStocks[0]?.lotId || "";
      setLotId(firstLot);
      setBagNo(firstLot ? computeNextBagNo(firstLot) : "");
      setWorkerId(workers[0]?.workerId || "");
      setProcess("Reeling");
      setCustomProcess("");
      setIsCustomProcess(false);
      setInputKg("");
      setOutputKg("");
      setStatus("Pending");
    }
    setIsOpenForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const activeWorker = workers.find((w) => w.workerId === workerId);
    const resolvedProcess = isCustomProcess ? customProcess.trim() : process;
    const numInput = parseFloat(inputKg);
    const numOutput = parseFloat(outputKg);

    if (!lotId) {
      setErrorMsg("Please register at least one Grey Stock Inward Lot in the system first.");
      return;
    }

    if (!workerId || !activeWorker) {
      setErrorMsg("Please select an active worker from the list registry.");
      return;
    }

    if (!resolvedProcess) {
      setErrorMsg("Please specify the physical yarn production process.");
      return;
    }

    if (isNaN(numInput) || numInput <= 0) {
      setErrorMsg("Input yarn weight (Kg) must be a positive number.");
      return;
    }

    if (isNaN(numOutput) || numOutput < 0) {
      setErrorMsg("Output yarn weight (Kg) must be non-negative.");
      return;
    }

    if (numOutput > numInput) {
      setErrorMsg("Input weight cannot be smaller than output weight. Please re-confirm numeric metrics.");
      return;
    }

    // wastage percentage calculation
    const derivedLoss = ((numInput - numOutput) / numInput) * 100;

    try {
      const isNew = !editingProduction;
      const productionId = isNew ? generateNextProdId() : editingProduction!.productionId;
      const finalBagNo = isNew ? computeNextBagNo(lotId) : bagNo;

      const docRef = doc(db, "hanks_productions", productionId);

      const payload: HanksProduction = {
        productionId,
        lotId,
        bagNo: finalBagNo,
        workerId,
        workerName: activeWorker.workerName,
        process: resolvedProcess,
        inputKg: numInput,
        outputKg: numOutput,
        lossPercent: parseFloat(derivedLoss.toFixed(2)),
        status,
        isDeleted: isNew ? false : editingProduction!.isDeleted,
        updatedAt: serverTimestamp(),
        createdAt: isNew ? serverTimestamp() : editingProduction!.createdAt
      };

      await setDoc(docRef, payload);
      setSuccessMsg(`Hanks Production card ${productionId} [Bag: ${finalBagNo}] updated successfully.`);
      setIsOpenForm(false);
    } catch (err) {
      setErrorMsg("Failed to upload Hanks production details to Firestore databases.");
      handleFirestoreError(err, editingProduction ? OperationType.UPDATE : OperationType.CREATE, "hanks_productions");
    }
  };

  const handleSoftDelete = async (prod: HanksProduction) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const docRef = doc(db, "hanks_productions", prod.productionId);
      await updateDoc(docRef, {
        isDeleted: !prod.isDeleted,
        updatedAt: serverTimestamp()
      });
      setSuccessMsg(`Hanks production Bag ${prod.bagNo} has been ${prod.isDeleted ? "recovered" : "archived"}.`);
    } catch (err) {
      setErrorMsg("Archive toggle state could not resolve.");
      handleFirestoreError(err, OperationType.UPDATE, `hanks_productions/${prod.productionId}`);
    }
  };

  const handleTrackSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setTrackingError("");
    setTrackedProduction(null);

    const term = trackingBagInput.trim().toUpperCase();
    if (!term) {
      setTrackingError("Please enter a valid Bag identifier to scan.");
      return;
    }

    const found = productions.find(
      (p) => !p.isDeleted && (p.bagNo.toUpperCase() === term || p.productionId.toUpperCase() === term)
    );

    if (found) {
      setTrackedProduction(found);
    } else {
      setTrackingError(`Could not find any logged Active Hanks Bag matching "${term}". Please confirm code format.`);
    }
  };

  const quickScanBag = (p: HanksProduction) => {
    setTrackingBagInput(p.bagNo);
    setTrackedProduction(p);
    setTrackingError("");
  };

  const printTicketElement = (prod: HanksProduction) => {
    setPrintingTicket(prod);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // Filter list
  const filteredProductions = productions.filter((p) => {
    if (showSoftDeleted ? !p.isDeleted : p.isDeleted) return false;

    const term = search.toLowerCase();
    const matchesSearch =
      p.productionId.toLowerCase().includes(term) ||
      p.lotId.toLowerCase().includes(term) ||
      p.bagNo.toLowerCase().includes(term) ||
      p.workerName.toLowerCase().includes(term) ||
      p.process.toLowerCase().includes(term);

    const matchesStatus = statusFilter === "all" ? true : p.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Dynamic Notifications Banner */}
      {(successMsg || errorMsg) && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs animate-fadeIn ${
          successMsg ? "bg-[#10b981]/10 border-[#10b981]/25 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-500"
        }`}>
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg || errorMsg}</span>
        </div>
      )}

      {/* Mode Navigation Toggle */}
      <div className="border border-white/5 bg-slate-900/60 p-1.5 rounded-2xl flex max-w-md">
        <button
          onClick={() => {
            setIsTrackingMode(false);
            setTrackedProduction(null);
            setTrackingBagInput("");
          }}
          className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
            !isTrackingMode 
              ? "bg-indigo-600 text-white shadow" 
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          Production Batch Ledger
        </button>
        <button
          onClick={() => setIsTrackingMode(true)}
          className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
            isTrackingMode 
              ? "bg-indigo-600 text-white shadow" 
              : "text-slate-400 hover:text-white"
          }`}
        >
          <QrCode className="w-3.5 h-3.5" />
          QR Barcode Live Tracker
        </button>
      </div>

      {/* ======================================================== */}
      {/* 1. VIEW: QR STICKER/BARCODE LIVE TRACKER SIMULATION MODE */}
      {/* ======================================================== */}
      {isTrackingMode && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
          {/* Tracking control block */}
          <div className="lg:col-span-5 bg-[#0a1128]/50 backdrop-blur-xl border border-white/10 rounded-2xl p-5 space-y-5">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <SearchCode className="w-4 h-4 text-indigo-400" />
                Input Bag Label or Scan QR
              </h3>
              <p className="text-[11px] text-slate-400">
                Simulate physical barcode scanning. Type or paste any Bag sequence number or production ticket code (e.g., <span className="font-mono text-cyan-400">L-001-B01</span>) to locate its ledger history.
              </p>
            </div>

            <form onSubmit={handleTrackSearch} className="flex gap-2">
              <input
                type="text"
                placeholder="Type Bag No, e.g. L-001-B01..."
                value={trackingBagInput}
                onChange={(e) => setTrackingBagInput(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 font-mono"
              />
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 font-bold px-4 py-2 text-xs rounded-xl text-white transition-colors cursor-pointer"
              >
                Scan Lot
              </button>
            </form>

            {trackingError && (
              <p className="text-xs text-red-400 p-3 bg-red-500/10 border border-red-500/15 rounded-xl font-mono">
                {trackingError}
              </p>
            )}

            {/* Quick-Scan Suggestion Panel */}
            <div className="space-y-2.5 pt-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Quick Scan Suggestions</span>
              <div className="max-h-56 overflow-y-auto space-y-1.5 divide-y divide-white/5 pr-1 text-[11px]">
                {productions.filter(p => !p.isDeleted).slice(0, 6).map((item) => (
                  <button
                    key={item.productionId}
                    onClick={() => quickScanBag(item)}
                    className="w-full text-left py-2 hover:bg-white/[0.03] px-2 rounded-lg transition-all flex items-center justify-between font-mono group"
                  >
                    <div className="space-y-0.5">
                      <div className="text-cyan-400 font-bold flex items-center gap-1.5">
                        <Box className="w-3 h-3 text-slate-500 group-hover:text-cyan-400" />
                        {item.bagNo}
                      </div>
                      <div className="text-[10px] text-slate-400 font-sans">
                        {item.process} | {item.workerName}
                      </div>
                    </div>
                    <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-indigo-300">
                      Load Code
                    </span>
                  </button>
                ))}
                {productions.filter(p => !p.isDeleted).length === 0 && (
                  <p className="text-slate-500 italic py-3 text-center">No active bags available to scan. Inward some hanks data first.</p>
                )}
              </div>
            </div>
          </div>

          {/* Tracking output results */}
          <div className="lg:col-span-7 bg-[#0a1128]/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col justify-center min-h-[300px]">
            {trackedProduction ? (
              <div className="space-y-6 animate-fadeIn">
                {/* Header Profile */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Live QR Tracker System ID</span>
                    <h4 className="text-base font-extrabold text-white font-mono flex items-center gap-2">
                      <Box className="w-5 h-5 text-cyan-400" />
                      {trackedProduction.bagNo}
                    </h4>
                  </div>
                  <span className={`text-xs px-3 py-1 font-bold rounded-full ${
                    trackedProduction.status === "Approved" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                    trackedProduction.status === "Completed" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" :
                    trackedProduction.status === "Processing" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                    "bg-slate-500/15 text-slate-400 border border-white/10"
                  }`}>
                    Status: {trackedProduction.status}
                  </span>
                </div>

                {/* Tracking Specs layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span className="text-slate-400">Production Ticket</span>
                      <span className="text-slate-300 font-mono font-bold">{trackedProduction.productionId}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span className="text-slate-400">Associated Lot No</span>
                      <span className="text-slate-300 font-mono font-bold text-cyan-400">{trackedProduction.lotId}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span className="text-slate-400">Manufacturing Operator</span>
                      <span className="text-slate-300 font-bold">{trackedProduction.workerName}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span className="text-slate-400">Process Step Name</span>
                      <span className="text-indigo-400 font-bold">{trackedProduction.process}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span className="text-slate-400">Yarn Feedstock Input</span>
                      <span className="text-slate-200 font-mono font-semibold">{trackedProduction.inputKg.toFixed(2)} Kg</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span className="text-slate-400">Finished Hanks Output</span>
                      <span className="text-slate-200 font-mono font-semibold">{trackedProduction.outputKg.toFixed(2)} Kg</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span className="text-slate-400">Wastage / Weight Loss</span>
                      <span className="text-amber-400 font-mono font-bold">{trackedProduction.lossPercent}%</span>
                    </div>
                  </div>

                  {/* QR Image sticker generator */}
                  <div className="flex flex-col items-center justify-center p-4 bg-white/[0.02] border border-white/10 rounded-xl gap-2 text-center">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=115x115&bgcolor=0a1128&color=ffffff&qzone=1&data=${encodeURIComponent(trackedProduction.bagNo)}`}
                      alt="Batch QR Tracker"
                      className="w-28 h-28 border border-white/15 p-1 rounded bg-slate-950 object-contain shadow-md"
                      referrerPolicy="no-referrer"
                    />
                    <div className="space-y-1">
                      <span className="text-[9px] font-mono font-bold text-cyan-400 block tracking-widest">{trackedProduction.bagNo}</span>
                      <button
                        onClick={() => printTicketElement(trackedProduction)}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mx-auto mt-1"
                      >
                        <Printer className="w-3 h-3" />
                        Print Label
                      </button>
                    </div>
                  </div>
                </div>

                {/* Progress bar timeline steps representation */}
                <div className="space-y-2 pt-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Bag Status Timeline</span>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded bg-white/10 overflow-hidden relative">
                      <div className="absolute top-0 left-0 bottom-0 bg-emerald-500 transition-all duration-300" style={{
                        width: trackedProduction.status === "Approved" ? "100%" :
                               trackedProduction.status === "Completed" ? "75%" :
                               trackedProduction.status === "Processing" ? "50%" : "25%"
                      }}></div>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400">
                      {trackedProduction.status === "Approved" ? "100% Processed" :
                       trackedProduction.status === "Completed" ? "75% Completed" :
                       trackedProduction.status === "Processing" ? "50% Active" : "25% Pending"}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center p-6 text-slate-500 space-y-3">
                <QrCode className="w-12 h-12 text-slate-600 mx-auto stroke-[1.2]" />
                <div className="space-y-1 max-w-sm mx-auto">
                  <h4 className="text-slate-300 font-medium text-xs">Waiting for Scan Input...</h4>
                  <p className="text-[11px] text-slate-500">
                    Input a bag tracking code ID above or select one of our quick scan samples to view the comprehensive real-time processing status.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. VIEW: STANDARD PRODUCTION BATCH LEDGER (STANDARD CRUD) */}
      {/* ======================================================== */}
      {!isTrackingMode && (
        <div className="space-y-5 animate-fadeIn">
          {/* Query, Status, & Controls panel */}
          <div className="flex flex-col xl:flex-row items-center justify-between gap-4 bg-[#0a1128]/50 backdrop-blur-xl border border-white/5 rounded-2xl p-4">
            <div className="flex flex-col md:flex-row items-center gap-3 w-full xl:w-auto">
              {/* Query search */}
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search HP index, Lot, Bag No, Worker, Process..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              {/* Status filtering dropdown */}
              <div className="relative w-full md:w-48 flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-2.5" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500/50 cursor-pointer"
                >
                  <option value="all">All statuses</option>
                  {PRESET_STATUSES.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full xl:w-auto justify-end">
              <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showSoftDeleted}
                  onChange={(e) => setShowSoftDeleted(e.target.checked)}
                  className="rounded border-white/10 bg-white/5 text-indigo-600 focus:ring-0 focus:ring-offset-0"
                />
                <span>Show Archived Bills</span>
              </label>

              {(role === "owner" || role === "manager") && (
                <button
                  onClick={() => triggerForm()}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-3.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Log Hanks Output</span>
                </button>
              )}
            </div>
          </div>

          {/* Primary Table Ledger */}
          <div className="bg-[#0a1128]/50 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.012] text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">HP ID</th>
                    <th className="py-3 px-4">Lot ID</th>
                    <th className="py-3 px-4">Bag Barcode</th>
                    <th className="py-3 px-4">Manufacturing Worker</th>
                    <th className="py-3 px-4">Operation Process</th>
                    <th className="py-3 px-4 text-right">Input Qty</th>
                    <th className="py-3 px-4 text-right">Output Qty</th>
                    <th className="py-3 px-4 text-right">Weight Loss</th>
                    <th className="py-3 px-4">Job Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-slate-500 font-mono">
                        Syncing Hanks Productions realtime database master...
                      </td>
                    </tr>
                  ) : filteredProductions.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-slate-500">
                        No Hanks Production logs found in directory index.
                      </td>
                    </tr>
                  ) : (
                    filteredProductions.map((p) => (
                      <tr key={p.productionId} className="hover:bg-white/[0.018] transition-colors">
                        <td className="py-3 px-4 font-mono text-cyan-400 font-bold">{p.productionId}</td>
                        <td className="py-3 px-4 font-mono text-slate-400">{p.lotId}</td>
                        <td className="py-3 px-4 font-mono text-indigo-300 font-bold">{p.bagNo}</td>
                        <td className="py-3 px-4 font-medium text-white">{p.workerName}</td>
                        <td className="py-3 px-4 text-indigo-400 font-bold">{p.process}</td>
                        <td className="py-3 px-4 text-right font-mono">{p.inputKg.toFixed(2)} Kg</td>
                        <td className="py-3 px-4 text-right font-mono text-white">{p.outputKg.toFixed(2)} Kg</td>
                        <td className="py-3 px-4 text-right font-mono">
                          <span className={`font-bold ${p.lossPercent > 10 ? "text-amber-400" : "text-slate-400"}`}>
                            {p.lossPercent}%
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-semibold ${
                            p.status === "Approved" ? "bg-emerald-500/15 text-emerald-400" :
                            p.status === "Completed" ? "bg-cyan-500/15 text-cyan-400" :
                            p.status === "Processing" ? "bg-amber-500/15 text-amber-400 animate-pulse" :
                            "bg-slate-500/15 text-slate-400"
                          }`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setViewingProduction(p)}
                              className="p-1.5 border border-white/5 bg-white/[0.012] hover:bg-white/[0.05] rounded-l-lg rounded-r-lg text-slate-300 transition-colors cursor-pointer"
                              title="Detailed Audit card"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => printTicketElement(p)}
                              className="p-1.5 border border-white/5 bg-white/[0.012] hover:bg-white/[0.05] rounded-lg text-indigo-400 transition-colors cursor-pointer"
                              title="Print bag sticker"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            {(role === "owner" || role === "manager") && (
                              <>
                                <button
                                  onClick={() => triggerForm(p)}
                                  className="p-1.5 border border-white/5 hover:border-indigo-500/35 bg-white/[0.012] hover:bg-indigo-500/10 text-slate-300 hover:text-indigo-400 rounded-lg transition-colors cursor-pointer"
                                  title="Edit entry"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleSoftDelete(p)}
                                  className={`p-1.5 border border-white/5 rounded-lg transition-colors cursor-pointer ${
                                    p.isDeleted
                                      ? "hover:border-emerald-500/35 hover:bg-emerald-500/10 text-emerald-400"
                                      : "hover:border-red-500/35 hover:bg-red-500/10 text-red-400"
                                  }`}
                                  title={p.isDeleted ? "Recover folder" : "Archive folder"}
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
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. INPUT FORM POPUP MODAL (ADD & EDIT)                  */}
      {/* ======================================================== */}
      {isOpenForm && (
        <div className="fixed inset-0 bg-[#060a1d]/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b122c] border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                {editingProduction ? "Edit Hanks production card Specs" : "Add Hanks production entry specifications"}
              </h3>
              <button
                type="button"
                onClick={() => setIsOpenForm(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {greyStocks.length === 0 || workers.length === 0 ? (
              <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl text-center text-xs text-amber-400 space-y-2">
                <p>Dependency records are missing! Please log at least one Grey Stock Inward Lot and one Worker Master in database first to connect.</p>
                <button
                  type="button"
                  onClick={() => setIsOpenForm(false)}
                  className="bg-white/10 hover:bg-white/15 px-4 py-2 rounded-lg text-white"
                >
                  Close Window
                </button>
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-4 text-xs">
                {/* Lot No & Bag No layout */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Grey Inward Lot No</label>
                    <select
                      value={lotId}
                      onChange={(e) => setLotId(e.target.value)}
                      required
                      disabled={!!editingProduction}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400 disabled:opacity-50 cursor-pointer"
                    >
                      {greyStocks.map((v) => (
                        <option key={v.lotId} value={v.lotId} className="bg-[#0b122c]">
                          {v.lotId} - {v.itemName} ({v.partyName})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Bag sequence number (Auto-Generated)</label>
                    <input
                      type="text"
                      disabled
                      value={bagNo}
                      className="w-full bg-white/[0.02] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-indigo-300 font-mono font-bold disabled:opacity-60 cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Worker selection list */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Manufacturing Worker</label>
                  <select
                    value={workerId}
                    onChange={(e) => setWorkerId(e.target.value)}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400 cursor-pointer"
                  >
                    {workers.map((w) => (
                      <option key={w.workerId} value={w.workerId} className="bg-[#0b122c]">
                        {w.workerName} - {w.role} ({w.unit})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Process Step specification selection */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Operation Process Step</label>
                    <select
                      value={process}
                      onChange={(e) => {
                        const val = e.target.value;
                        setProcess(val);
                        setIsCustomProcess(val === "Other");
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400 cursor-pointer"
                    >
                      {PRESET_PROCESSES.map((pr) => (
                        <option key={pr} value={pr} className="bg-[#0b122c]">{pr}</option>
                      ))}
                      <option value="Other" className="bg-[#0b122c]">Other / Custom Operation</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Specify Other Process Name</label>
                    <input
                      type="text"
                      disabled={!isCustomProcess}
                      placeholder="e.g. Re-Reeling setup"
                      value={customProcess}
                      onChange={(e) => setCustomProcess(e.target.value)}
                      required={isCustomProcess}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400 disabled:opacity-30"
                    />
                  </div>
                </div>

                {/* Inputs & Outputs and calculation */}
                <div className="grid grid-cols-2 gap-3 bg-white/[0.01] border border-white/5 p-3 rounded-xl">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Input weight (Kg)</label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      placeholder="e.g. 50.0"
                      value={inputKg}
                      onChange={(e) => setInputKg(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Output weight (Kg)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      placeholder="e.g. 48.5"
                      value={outputKg}
                      onChange={(e) => setOutputKg(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                </div>

                {/* dynamic calculation indicator */}
                {parseFloat(inputKg) > 0 && parseFloat(outputKg) >= 0 && (
                  <div className="flex items-center justify-between p-3.5 bg-indigo-500/5 border border-indigo-500/10 rounded-xl">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-indigo-400" />
                      <span className="text-slate-400 font-medium">Automatic Weight Loss Ratio:</span>
                    </div>
                    <span className={`text-sm font-mono font-bold ${
                      (parseFloat(inputKg) - parseFloat(outputKg)) < 0 ? "text-red-400" :
                      ((parseFloat(inputKg) - parseFloat(outputKg)) / parseFloat(inputKg)) * 100 > 12 ? "text-amber-400" :
                      "text-emerald-400"
                    }`}>
                      {(((parseFloat(inputKg) - parseFloat(outputKg)) / parseFloat(inputKg)) * 100).toFixed(2)} % Loss
                    </span>
                  </div>
                )}

                {/* Job Status select list */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Batch status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-400 cursor-pointer"
                  >
                    {PRESET_STATUSES.map((st) => (
                      <option key={st} value={st} className="bg-[#0b122c]">{st}</option>
                    ))}
                  </select>
                </div>

                {/* Submit Actions panel controls */}
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
                    Save Production Entry
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. DETAILED AUDIT SPEC CARD POPUP MODAL                 */}
      {/* ======================================================== */}
      {viewingProduction && (
        <div className="fixed inset-0 bg-[#060a1d]/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b122c] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Box className="w-4 h-4 text-cyan-400" />
                Hanks production details Audit card
              </h3>
              <button
                type="button"
                onClick={() => setViewingProduction(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono text-slate-300">
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">Record index identifier</span>
                <span className="text-cyan-400 font-bold">{viewingProduction.productionId}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">Target Yarn Lot No</span>
                <span className="text-white">{viewingProduction.lotId}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">Bag sequence number</span>
                <span className="text-indigo-300 font-bold">{viewingProduction.bagNo}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">Assigned Operator</span>
                <span className="text-white font-sans font-semibold">{viewingProduction.workerName}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">Manufacturing step</span>
                <span className="text-indigo-400 font-medium">{viewingProduction.process}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">Unprocessed Input</span>
                <span className="text-white font-semibold">{viewingProduction.inputKg.toFixed(2)} Kg</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">Processed Output</span>
                <span className="text-emerald-400 font-semibold">{viewingProduction.outputKg.toFixed(2)} Kg</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">Calculated wastage/loss</span>
                <span className="text-amber-400 font-bold">{viewingProduction.lossPercent}%</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">Current job status</span>
                <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-semibold ${
                  viewingProduction.status === "Approved" ? "bg-emerald-500/15 text-emerald-400" :
                  viewingProduction.status === "Completed" ? "bg-cyan-500/15 text-cyan-400" :
                  viewingProduction.status === "Processing" ? "bg-amber-500/15 text-amber-400 animate-pulse" :
                  "bg-slate-500/15 text-slate-400"
                }`}>
                  {viewingProduction.status}
                </span>
              </div>
            </div>

            {/* QR block preview */}
            <div className="flex items-center gap-3 p-3.5 bg-white/[0.02] border border-white/5 rounded-xl">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=70x70&bgcolor=0b122c&color=ffffff&qzone=1&data=${encodeURIComponent(viewingProduction.bagNo)}`}
                alt="Quick scan ticket"
                className="w-16 h-16 border border-white/10 rounded object-contain"
                referrerPolicy="no-referrer"
              />
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Thermal barcode sticker</span>
                <p className="text-[11px] text-slate-300">Sticker barcode matches generated tag sequence ID securely.</p>
                <button
                  type="button"
                  onClick={() => printTicketElement(viewingProduction)}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mt-1 cursor-pointer font-sans"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Bag Label
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setViewingProduction(null)}
                className="bg-white/5 hover:bg-white/10 text-white font-bold py-2 px-5 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Close Audit Page
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. PRINTER STICKER GRAPHICAL CONTAINER                  */}
      {/* ======================================================== */}
      {printingTicket && (
        <div className="hidden print:block print:fixed print:inset-0 print:bg-white print:text-black print:p-8 print:z-[9999] print:font-mono text-xs space-y-6">
          <div className="border-4 border-black p-6 rounded-lg max-w-sm mx-auto space-y-4 text-center">
            <h1 className="text-lg font-black uppercase tracking-widest border-b-2 border-black pb-2">Hanks Production Tag</h1>
            
            <div className="flex justify-center py-2">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&bgcolor=ffffff&color=000000&data=${encodeURIComponent(printingTicket.bagNo)}`}
                alt="Barcode QR Ticket"
                className="w-36 h-36 border border-black p-1 object-contain"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="text-left space-y-1.5 text-[11px] uppercase">
              <div className="flex justify-between font-bold">
                <span>BAG NO:</span>
                <span className="text-sm font-black">{printingTicket.bagNo}</span>
              </div>
              <div className="flex justify-between">
                <span>HP BATCH:</span>
                <span>{printingTicket.productionId}</span>
              </div>
              <div className="flex justify-between">
                <span>LOT ID:</span>
                <span className="font-bold">{printingTicket.lotId}</span>
              </div>
              <div className="flex justify-between">
                <span>OPERATOR:</span>
                <span>{printingTicket.workerName}</span>
              </div>
              <div className="flex justify-between">
                <span>PROCESS:</span>
                <span className="font-bold">{printingTicket.process}</span>
              </div>
              <div className="flex justify-between">
                <span>INPUT YARN:</span>
                <span>{printingTicket.inputKg.toFixed(2)} Kg</span>
              </div>
              <div className="flex justify-between">
                <span>OUTPUT COMP:</span>
                <span className="font-bold">{printingTicket.outputKg.toFixed(2)} Kg</span>
              </div>
              <div className="flex justify-between">
                <span>LOSS RATIO:</span>
                <span className="font-bold">{printingTicket.lossPercent}%</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>STATUS:</span>
                <span>{printingTicket.status}</span>
              </div>
            </div>

            <div className="border-t border-black pt-3 text-[9px] text-slate-600">
              Printed on {new Date().toLocaleDateString()} | Smart Tag QR Code Tracking
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
